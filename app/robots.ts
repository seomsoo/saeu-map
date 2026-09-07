import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteUrl(env.SITE_URL)).toString(),
  };
}
