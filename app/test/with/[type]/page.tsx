import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PeelTest } from "@/components/peel-test/peel-test";
import { TestFrame } from "@/components/peel-test/test-frame";
import { getPeelTest, getPeelType } from "@/lib/data";
import { PEEL_SLUGS, decodePeelSlug } from "@/lib/peel-test";
import { peelInviteMeta } from "@/lib/seo";

interface InvitePageProps {
  params: Promise<{ type: string }>;
}

/** 슬러그 4개 밖은 렌더하지 않는다 — 그 밖은 진짜 404 */
export const dynamicParams = false;

export function generateStaticParams() {
  return PEEL_SLUGS.map((type) => ({ type }));
}

export async function generateMetadata({ params }: InvitePageProps): Promise<Metadata> {
  const { type } = await params;
  const slug = decodePeelSlug(type);
  const partner = slug ? await getPeelType(slug) : null;
  if (!partner) return { title: "찾을 수 없는 유형이에요", robots: { index: false } };
  return peelInviteMeta(partner);
}

/**
 * 궁합 초대 `/test/with/[type]` — **친구가 보낸 링크로 들어오는 자리**(design 화면 11-4).
 * 표지와 같은 화면이되 "OO형이 궁합을 신청했어요"가 붙고, 6문항을 풀면 `/test/<내유형>/<상대>`로 떨어진다.
 * 정적 세그먼트 `with`가 `[type]`보다 우선하므로 결과 라우트와 충돌하지 않는다.
 */
export default async function PeelInvitePage({ params }: InvitePageProps) {
  const { type } = await params;
  const slug = decodePeelSlug(type);
  if (!slug) notFound();
  const [content, partner] = await Promise.all([getPeelTest(), getPeelType(slug)]);
  if (!partner) notFound();
  return (
    <TestFrame>
      <PeelTest content={content} partner={partner} />
    </TestFrame>
  );
}
