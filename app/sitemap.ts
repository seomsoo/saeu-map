import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getPlaces } from "@/lib/data";
import { env } from "@/lib/env";
import { sitemapEntries, siteUrl } from "@/lib/seo";

/** 홈 + 가게 전부 + 서울 25구 (spec 4.6). 요청 시 생성 — 가게 목록·확인일이 빌드에 얼어붙지 않게 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const now = new Date().toISOString();
  return sitemapEntries(siteUrl(env.SITE_URL), await getPlaces({}, now), now);
}
