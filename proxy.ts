import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
]);

const isUploadThingRoute = createRouteMatcher(["/api/uploadthing(.*)"]);
const isInngestRoute = createRouteMatcher(["/api/inngest(.*)"]);
const isPlaidWebhookRoute = createRouteMatcher(["/api/plaid/webhook(.*)"]);
const isBillingRoute = createRouteMatcher(["/app/settings/billing(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // Don't bypass UploadThing routes - let them handle auth in their own middleware
  // UploadThing needs the request body intact, and its middleware runs before body consumption
  if (isUploadThingRoute(request)) {
    return NextResponse.next();
  }

  // Bypass Inngest routes - they're called by Inngest infrastructure
  // These routes need to be publicly accessible for Inngest webhooks
  if (isInngestRoute(request)) {
    return NextResponse.next();
  }

  // Bypass Plaid webhook routes - they're called by Plaid infrastructure
  // Webhook verification is handled in the route handler itself
  if (isPlaidWebhookRoute(request)) {
    return NextResponse.next();
  }

  if (!isPublicRoute(request)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return redirectToSignIn();
    }

    // Coarse beta gate (avoids rendering the billing UI for non-allowlisted users).
    if (isBillingRoute(request)) {
      const allowlist = (process.env.BILLING_BETA_USER_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (allowlist.length > 0 && !allowlist.includes(userId)) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/settings";
        return NextResponse.redirect(url);
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|json)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

