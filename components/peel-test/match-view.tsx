"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlaceCard } from "@/components/map-screen/place-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast } from "@/components/ui/toast";
import { useNotice } from "@/components/ui/use-notice";
import { peelMatchPath, peelTypePath } from "@/lib/peel-test";
import { sharePath, shareUrl } from "@/lib/share";
import type { PeelMatch, PeelType, Place } from "@/lib/types";
import { TypeArt } from "./type-art";

/**
 * 궁합 결과 (design 화면 11-5). 두 유형을 나란히 놓고 가운데에 궁합 수를 둔다.
 * **취향이 갈린 조합(R2)에서는 구이·회를 둘 다 하는 집이 온다** — 궁합이 쓸모를 낳는 자리다.
 */
export function PeelMatchView({
  mine,
  partner,
  match,
  places,
  now,
}: {
  mine: PeelType;
  partner: PeelType;
  match: PeelMatch;
  places: Place[];
  now: string;
}) {
  const router = useRouter();
  const { notice, showNotice } = useNotice();

  return (
    <div className="flex flex-1 flex-col gap-6 pt-2 pb-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <TypeArt slug={mine.slug} size="md" />
          <span className="text-title-m-bold text-brand-fg tabular-nums" aria-label={`궁합 ${match.score}점`}>
            {match.score}
          </span>
          <TypeArt slug={partner.slug} size="md" />
        </div>
        {/* 두 이름은 가운데 점으로 잇지 않는다(spec 7 카피 톤) — 세로 헤어라인으로 나눈다 */}
        <p className="flex items-center justify-center gap-2 text-caption-l-regular text-fg-tertiary">
          <span>{mine.name}</span>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-line" />
          <span>{partner.name}</span>
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-title-s-semibold text-fg">{match.title}</h1>
          <p className="text-body-m-regular text-fg-secondary">{match.description}</p>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-body-l-semibold text-fg">둘이 같이 갈 새우집</h2>
        {places.length === 0 ? (
          <EmptyState
            title="아직 둘 다 만족할 집을 못 찾았어요"
            description="지도에서 직접 골라보세요"
            action={
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  router.push("/");
                }}
              >
                지도 보기
              </Button>
            }
          />
        ) : (
          <ul className="-mx-3">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                now={now}
                origin={null}
                selected={false}
                onSelect={(id) => {
                  router.push(sharePath(id));
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <Button
          variant="brand"
          size="xl"
          onClick={() => {
            shareUrl(
              {
                title: `${mine.name}과 ${partner.name}의 궁합`,
                path: peelMatchPath(mine.slug, partner.slug),
              },
              showNotice,
            );
          }}
        >
          궁합 공유하기
        </Button>
        <Link
          href={peelTypePath(mine.slug)}
          className="press inline-flex h-12 items-center justify-center rounded-12 border border-line bg-bg text-body-m-semibold text-fg"
        >
          내 결과 보기
        </Link>
        <Link
          href="/test"
          className="hit-44 self-center py-1 text-caption-l-regular text-fg-tertiary"
        >
          다시 하기
        </Link>
      </div>

      {notice && (
        <div className="fixed inset-x-0 bottom-6 flex justify-center px-5">
          <Toast message={notice} />
        </div>
      )}
    </div>
  );
}
