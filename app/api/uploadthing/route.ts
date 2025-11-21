import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/app/api/uploadthing/core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});

// Export runtime config to help with ArrayBuffer issues
export const runtime = 'nodejs';
export const maxDuration = 30;

