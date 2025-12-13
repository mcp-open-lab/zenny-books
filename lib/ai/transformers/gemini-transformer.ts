/**
 * Gemini Schema Transformer
 * Transforms JSON schemas to be compatible with Gemini's responseSchema
 * 
 * Gemini's responseSchema supports a subset of JSON Schema:
 * - "type" must be a single string, NEVER an array (e.g., not ["string", "null"])
 * - Enums ARE supported: {"type": "string", "enum": [...]}
 * - Nullability: use "nullable": true, NOT "type": ["string", "null"]
 * - No anyOf/oneOf/allOf, $ref, definitions, $schema, additionalProperties
 */

import type { SchemaTransformer } from "./base-transformer";

export class GeminiSchemaTransformer implements SchemaTransformer {
  supports(provider: string): boolean {
    return provider === "gemini";
  }

  transform(schema: any): any {
    return this.cleanSchemaForGemini(schema);
  }

  private cleanSchemaForGemini(
    schema: any,
    definitions?: Record<string, any>
  ): any {
    if (typeof schema !== "object" || schema === null) {
      return schema;
    }

    // Extract definitions if present at top level
    const topLevelDefinitions = schema.definitions || definitions;

    // If this is a $ref, resolve it from definitions
    if (schema.$ref && topLevelDefinitions) {
      const refPath = schema.$ref.replace("#/definitions/", "");
      const resolved = topLevelDefinitions[refPath];
      if (resolved) {
        return this.cleanSchemaForGemini(resolved, topLevelDefinitions);
      }
    }

    // CRITICAL: Handle "type" as array - Gemini doesn't support this
    // zod-to-json-schema creates ["string", "null"] for nullable fields
    if (Array.isArray(schema.type)) {
      const nonNullType =
        schema.type.find((t: string) => t !== "null") || schema.type[0];
      const isNullable = schema.type.includes("null");

      const cleaned: any = {
        type: nonNullType,
      };

      // Preserve enum if present
      if (schema.enum && Array.isArray(schema.enum)) {
        cleaned.enum = schema.enum;
      }

      // Set nullable flag if needed
      if (isNullable) {
        cleaned.nullable = true;
      }

      // Preserve description
      if (schema.description) {
        cleaned.description = schema.description;
      }

      // Recursively clean any nested properties
      if (schema.properties) {
        cleaned.properties = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          cleaned.properties[key] = this.cleanSchemaForGemini(
            value,
            topLevelDefinitions
          );
        }
      }

      if (schema.items) {
        cleaned.items = this.cleanSchemaForGemini(
          schema.items,
          topLevelDefinitions
        );
      }

      if (Array.isArray(schema.required)) {
        cleaned.required = schema.required;
      }

      return cleaned;
    }

    // Handle anyOf/oneOf/allOf - Gemini doesn't support these
    // Common pattern: zod nullable creates anyOf: [{type: "string", enum: [...]}, {type: "null"}]
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      const enumOption = schema.anyOf.find(
        (option: any) =>
          option.enum ||
          (option.type &&
            option.type !== "null" &&
            !Array.isArray(option.type))
      );
      const nullOption = schema.anyOf.find(
        (option: any) =>
          option.type === "null" ||
          (Array.isArray(option.type) && option.type.includes("null"))
      );

      if (enumOption) {
        const cleaned: any = {
          type: Array.isArray(enumOption.type)
            ? enumOption.type.find((t: string) => t !== "null")
            : enumOption.type,
        };

        // Preserve enum if present
        if (enumOption.enum && Array.isArray(enumOption.enum)) {
          cleaned.enum = enumOption.enum;
        }

        // Set nullable if null option exists
        if (nullOption) {
          cleaned.nullable = true;
        }

        if (enumOption.description) {
          cleaned.description = enumOption.description;
        }

        return cleaned;
      }
    }

    // Handle oneOf/allOf similarly (though less common)
    if (
      (schema.oneOf || schema.allOf) &&
      Array.isArray(schema.oneOf || schema.allOf)
    ) {
      const options = schema.oneOf || schema.allOf;
      const firstValid = options.find(
        (opt: any) =>
          opt.type && opt.type !== "null" && !Array.isArray(opt.type)
      );
      if (firstValid) {
        return this.cleanSchemaForGemini(firstValid, topLevelDefinitions);
      }
    }

    // Enums ARE supported by Gemini - keep them as-is, but ensure type is string (not array)
    if (schema.enum && Array.isArray(schema.enum)) {
      const cleaned: any = {
        type: Array.isArray(schema.type)
          ? schema.type.find((t: string) => t !== "null") || "string"
          : schema.type || "string",
        enum: schema.enum,
      };
      if (schema.description) {
        cleaned.description = schema.description;
      }
      // Handle nullable - check if type array contains "null" or if nullable flag exists
      if (
        schema.nullable ||
        (Array.isArray(schema.type) && schema.type.includes("null"))
      ) {
        cleaned.nullable = true;
      }
      return cleaned;
    }

    // Remove metadata fields that Gemini rejects
    const {
      $ref: _ref,
      definitions: _definitions,
      $schema: _schema,
      additionalProperties: _additionalProperties,
      anyOf: _anyOf,
      oneOf: _oneOf,
      allOf: _allOf,
      ...cleaned
    } = schema;

    // Ensure type is never an array in the cleaned result (should be handled above, but double-check)
    if (cleaned.type && Array.isArray(cleaned.type)) {
      const originalTypeArray = cleaned.type;
      const nonNullType =
        originalTypeArray.find((t: string) => t !== "null") ||
        originalTypeArray[0];
      cleaned.type = nonNullType;
      if (originalTypeArray.includes("null")) {
        cleaned.nullable = true;
      }
    }

    // Recursively clean nested objects and arrays
    const result: any = {};
    for (const [key, value] of Object.entries(cleaned)) {
      if (key === "properties" && typeof value === "object" && value !== null) {
        // Special handling for properties object - clean each property value
        result[key] = {};
        for (const [propKey, propValue] of Object.entries(
          value as Record<string, any>
        )) {
          result[key][propKey] = this.cleanSchemaForGemini(
            propValue,
            topLevelDefinitions
          );
        }
      } else if (
        key === "items" &&
        typeof value === "object" &&
        value !== null
      ) {
        // Special handling for array items schema - clean the item schema
        result[key] = this.cleanSchemaForGemini(value, topLevelDefinitions);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          this.cleanSchemaForGemini(item, topLevelDefinitions)
        );
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.cleanSchemaForGemini(value, topLevelDefinitions);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

