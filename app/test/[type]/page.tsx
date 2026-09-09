import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PeelResultView } from "@/components/peel-test/result-view";
import { TestFrame } from "@/components/peel-test/test-frame";
import { getPeelTest, getPeelType, getPeelTypePlaces } from "@/lib/data";
import { decodePeelSlug } from "@/lib/peel-test";
import { peelTypeMeta } from "@/lib/seo";

interface ResultPageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: ResultPageProps): Promise<Metadata> {
  const { type } = await params;
  const slug = decodePeelSlug(type);
  const found = slug ? await getPeelType(slug) : null;
  if (!found) return { title: "찾을 수 없는 유형이에요", robots: { index: false } };
  return peelTypeMeta(found);
}

/**
 * 결과 `/test/[type]` — 유형 카드 + 어울리는 가게 3곳(design 화면 11-3). 공유 링크의 착지점이다.
 *
 * **슬러그 4개 밖은 `notFound()`로 진짜 404**다. `generateStaticParams`를 두지 않는 이유는
 * 추천 카드가 "어제 확인" 같은 상대 시간을 그리기 때문 — `connection()`으로 요청 시 렌더해야
 * 배포 시각에 얼어붙지 않는다(`/gu/[name]`과 같은 이유). 정적으로 구워야 하는 건 OG 카드뿐이다.
 */
export default async function PeelResultPage({ params }: ResultPageProps) {
  const { type } = await params;
  const slug = decodePeelSlug(type);
  if (!slug) notFound();
  const found = await getPeelType(slug);
  if (!found) notFound();

  await connection();
  const now = new Date().toISOString();
  const [places, partner, content] = await Promise.all([
    getPeelTypePlaces(slug, now),
    getPeelType(found.partner),
    getPeelTest(),
  ]);
  if (!partner) notFound();

  return (
    <TestFrame>
      <PeelResultView
        type={found}
        partner={partner}
        types={content.types}
        places={places}
        now={now}
      />
    </TestFrame>
  );
}
