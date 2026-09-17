import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminScreen } from "@/components/admin/admin-screen";
import { getSession } from "@/lib/data";
import { SITE_NAME } from "@/lib/seo";

/**
 * 관리자 화면 (spec 4.5 · design 화면 10). **검색에 절대 노출하지 않는다.**
 * 서버가 세션 쿠키로 `profiles.is_admin`을 읽어 아니면 `notFound()` — **진짜 404**(이 세그먼트엔 로딩 경계가 없다).
 * 제목도 관리자에게만 준다: 비관리자에게 "새우맵 관리"가 나가면 404 위장이 깨진다(2026-09-08 실측).
 * 화면 안의 세션 체크는 장식이고 진짜 게이트는 여기와 RLS다.
 */
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const session = await getSession();
  return {
    title: session.isAdmin === true ? "새우맵 관리" : { absolute: SITE_NAME },
    robots: { index: false, follow: false },
  };
}

export default async function AdminPage() {
  // 요청 시 렌더: "오늘"·"N일 전"이 빌드 시각에 얼어붙지 않게 (홈과 같은 이유)
  await connection();
  const session = await getSession();
  if (session.isAdmin !== true) notFound();
  return <AdminScreen now={new Date().toISOString()} />;
}
