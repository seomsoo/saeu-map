import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { isPreviewHost, siteUrl } from "@/lib/seo";

/** 빌드 시 정적 생성(요청 API 없음) — CI가 빌드 env로 SITE_URL을 준다. 프리뷰 호스트면 전부 막아 프로덕션과 중복 색인되지 않게 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl(env.SITE_URL);
  if (isPreviewHost(base)) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
