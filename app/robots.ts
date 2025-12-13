import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/api/", "/sign-in", "/sign-up"],
      },
    ],
    sitemap: "https://zennybooks.com/sitemap.xml",
  };
}


