"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  testLoggingAction,
  testErrorAction,
  testPublicAction,
} from "@/app/(app)/app/test-logging/actions";

export default function TestLoggingPage() {
  const [status, setStatus] = useState<string>("");

  const handleTestSuccess = async () => {
    setStatus("Testing successful action... Check console for logs.");
    try {
      await testLoggingAction("test-param", 42);
      setStatus("✅ Success! Check console for action logs.");
    } catch (e) {
      setStatus(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleTestError = async () => {
    setStatus("Testing error action... Check console for logs.");
    try {
      await testErrorAction();
    } catch (e) {
      setStatus("✅ Error logged! Check console for error logs.");
    }
  };

  const handleTestPublic = async () => {
    setStatus("Testing public action (no auth)... Check console for logs.");
    try {
      await testPublicAction();
      setStatus("✅ Public action logged! Check console.");
    } catch (e) {
      setStatus(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Logging Test Page</CardTitle>
          <CardDescription>
            Test the logging architecture. Open your browser console and server
            logs to see the output.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Open browser console and server terminal to see logs
            </p>
          </div>

          <div className="space-y-2">
            <Button onClick={handleTestSuccess} className="w-full">
              Test Successful Action
            </Button>
            <p className="text-xs text-muted-foreground">
              Tests: action start, success, duration, correlation ID
            </p>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleTestError}
              variant="destructive"
              className="w-full"
            >
              Test Error Action
            </Button>
            <p className="text-xs text-muted-foreground">
              Tests: error logging (dev + prod), full context
            </p>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleTestPublic}
              variant="outline"
              className="w-full"
            >
              Test Public Action (No Auth)
            </Button>
            <p className="text-xs text-muted-foreground">
              Tests: optional auth, public action logging
            </p>
          </div>

          {status ? <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm">{status}</p>
            </div> : null}

          <div className="mt-6 p-4 bg-muted rounded-md">
            <h3 className="font-semibold mb-2">What to Check:</h3>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Browser console for client-side logs</li>
              <li>Server terminal for server action logs</li>
              <li>Correlation IDs match across start/success/error logs</li>
              <li>Safe serialization handles complex data</li>
              <li>TOON format vs JSON fallback for nested structures</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
