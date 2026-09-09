import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PeelMatchView } from "@/components/peel-test/match-view";
import { TestFrame } from "@/components/peel-test/test-frame";
import { getPeelMatchPlaces, getPeelTest, getPeelType } from "@/lib/data";
import { decodePeelSlug, matchKey } from "@/lib/peel-test";
import { peelMatchMeta } from "@/lib/seo";
import type { PeelMatch, PeelType } from "@/lib/types";

interface MatchPageProps {
  params: Promise<{ type: string; other: string }>;
}

/** 두 슬러그를 읽고 궁합 카피까지 찾는다. 하나라도 어긋나면 null → 404 */
async function resolve(
  params: MatchPageProps["params"],
): Promise<{ mine: PeelType; partner: PeelType; match: PeelMatch } | null> {
  const { type, other } = await params;
  const mineSlug = decodePeelSlug(type);
  const partnerSlug = decodePeelSlug(other);
  if (!mineSlug || !partnerSlug) return null;
  const [mine, partner, content] = await Promise.all([
    getPeelType(mineSlug),
    getPeelType(partnerSlug),
    getPeelTest(),
  ]);
  if (!mine || !partner) return null;
  const key = matchKey(mine, partner);
  const match = content.matches.find((m) => m.key === key);
  return match ? { mine, partner, match } : null;
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const resolved = await resolve(params);
  if (!resolved) return { title: "찾을 수 없는 궁합이에요", robots: { index: false } };
  return peelMatchMeta(resolved.mine, resolved.partner, resolved.match);
}

/**
 * 궁합 결과 `/test/[type]/[other]` — 앞이 방금 푼 사람, 뒤가 초대한 사람이다(design 화면 11-5).
 * 16조합 전부가 R1~R4 중 하나로 떨어지므로 조합마다 카피를 쓰지 않는다(decisions 2026-09-09).
 * 색인하지 않는다(`peelMatchMeta`) — 공유 링크로만 사는 얇은 페이지다.
 *
 * `generateStaticParams`·`dynamicParams`가 없는 것은 의도다: 추천 카드의 상대 시간 때문에 `connection()`으로
 * 요청 시 렌더해야 한다(결과 페이지와 같은 이유). 슬러그 밖 404는 위 `resolve()`의 `notFound()`가 보장한다.
 */
export default async function PeelMatchPage({ params }: MatchPageProps) {
  const resolved = await resolve(params);
  if (!resolved) notFound();

  await connection();
  const now = new Date().toISOString();
  const places = await getPeelMatchPlaces(resolved.mine.slug, resolved.partner.slug, now);

  return (
    <TestFrame>
      <PeelMatchView
        mine={resolved.mine}
        partner={resolved.partner}
        match={resolved.match}
        places={places}
        now={now}
      />
    </TestFrame>
  );
}
