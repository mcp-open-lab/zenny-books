import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid/client";
import { PlaidEnvironments } from "plaid";

export async function GET() {
  const env = process.env.PLAID_ENV || "sandbox";
  const clientId = process.env.PLAID_CLIENT_ID ? "set" : "not set";
  const secret = process.env.PLAID_SECRET ? "set" : "not set";
  
  // Get the actual basePath being used
  const basePath = PlaidEnvironments[env as keyof typeof PlaidEnvironments];
  
  return NextResponse.json({
    PLAID_ENV: env,
    PLAID_CLIENT_ID: clientId,
    PLAID_SECRET: secret,
    basePath: basePath,
    isProduction: env === "production",
    isSandbox: env === "sandbox",
    isDevelopment: env === "development",
  });
}

