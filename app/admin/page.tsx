import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminScreen } from "@/components/admin/admin-screen";
import { SITE_NAME } from "@/lib/seo";

/**
 * 관리자 화면 (spec 4.5 · design 화면 10). **검색에 절대 노출하지 않는다.**
 * 권한 판정은 화면 안에서 한다 — 목 단계의 세션이 클라이언트 메모리라 서버가 알 수 없기 때문이다.
 * Phase 6에서 `profiles.is_admin`을 서버가 읽으면 여기서 `notFound()`로 **진짜 404**를 낸다.
 */
export const metadata: Metadata = {
  /**
   * **제목으로도 알리지 않는다.** 메타데이터는 서버가 정하는데 목 단계의 세션은 클라이언트에만 있어서
   * 비관리자에게도 이 제목이 나간다 — 탭 제목이 "새우맵 관리"면 404 위장이 깨진다(2026-09-08 실측).
   * Phase 6에서 서버가 `profiles.is_admin`을 읽으면 그때 관리자에게만 제목을 준다.
   */
  title: { absolute: SITE_NAME },
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // 요청 시 렌더: "오늘"·"N일 전"이 빌드 시각에 얼어붙지 않게 (홈과 같은 이유)
  await connection();
  return <AdminScreen now={new Date().toISOString()} />;
}
