"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlaceCard } from "@/components/map-screen/place-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast } from "@/components/ui/toast";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { useNotice } from "@/components/ui/use-notice";
import { peelMatchPath, peelTypePath } from "@/lib/peel-test";
import { sharePath, shareUrl } from "@/lib/share";
import type { PeelMatch, PeelType, Place } from "@/lib/types";
import { TypeArt } from "./type-art";

/**
 * 궁합 수가 0에서 차오른다 — 결과를 여는 순간의 재미가 이 화면의 값이다.
 * 모션을 끈 사용자에게는 처음부터 최종값이다(서버 렌더도 최종값이라 하이드레이션이 흔들리지 않는다).
 */
function useCountUp(target: number): number {
  const animate = useMediaQuery("(prefers-reduced-motion: no-preference)");
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (!animate) return;
    const DURATION_MS = 800;
    const started = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - started) / DURATION_MS);
      // ease-out cubic — 끝에서 천천히 멎어야 숫자가 읽힌다
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [animate, target]);

  return value;
}

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
  const score = useCountUp(match.score);

  return (
    <div className="flex flex-1 flex-col gap-6 pt-2 pb-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center">
          <TypeArt slug={mine.slug} size="md" className="saeu-pop" />
          {/* 점수는 두 아트 사이에 얹힌다 — 채운 레드 원은 클러스터 마커·별점과 같은 결이고
              "화면당 채운 레드 하나"는 버튼 규칙이라 여기 걸리지 않는다(design 26줄) */}
          <span
            className="saeu-pop -mx-3 z-1 flex size-17 items-center justify-center rounded-max bg-brand text-title-s-semibold text-fg-on-brand tabular-nums shadow-card"
            aria-label={`궁합 ${match.score}점`}
          >
            {score}
          </span>
          <TypeArt slug={partner.slug} size="md" className="saeu-pop" />
        </div>
        {/* 두 이름은 가운데 점으로 잇지 않는다(spec 7 카피 톤) — 세로 헤어라인으로 나눈다 */}
        <p className="saeu-rise saeu-rise-2 flex items-center justify-center gap-2 text-caption-l-regular text-fg-tertiary">
          <span>{mine.name}</span>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-line" />
          <span>{partner.name}</span>
        </p>
        <div className="saeu-rise saeu-rise-2 flex flex-col gap-2">
          <h1 className="text-title-m-bold text-fg">{match.title}</h1>
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
          className={buttonVariants({ variant: "outline", size: "xl" })}
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
