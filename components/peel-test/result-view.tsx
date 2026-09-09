"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlaceCard } from "@/components/map-screen/place-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ShrimpIcon } from "@/components/ui/icons/shrimp-icon";
import { Toast } from "@/components/ui/toast";
import { useNotice } from "@/components/ui/use-notice";
import { peelInvitePath } from "@/lib/peel-test";
import { cx } from "@/lib/cx";
import { sharePath, shareUrl } from "@/lib/share";
import type { PeelType, Place } from "@/lib/types";
import { useTookTest } from "./session-flag";
import { TypeArt } from "./type-art";
import { TypeMatrix } from "./type-matrix";

/**
 * 결과 (design 화면 11-3). 유형 캐릭터로 공유를 얻고 **추천 3곳으로 지도에 흘려보낸다** —
 * 국내 사례에서 확인한 구조다(decisions 2026-09-09).
 *
 * 공유 버튼이 둘인 이유: [결과 공유하기]는 내 카드를 보내고, [친구와 궁합 보기]는 **초대 링크**를 보낸다.
 * 뒤의 것이 링크 하나로 다음 테스트를 부른다.
 */
export function PeelResultView({
  type,
  partner,
  types,
  places,
  now,
}: {
  type: PeelType;
  partner: PeelType;
  /** 매트릭스에 네 유형이 다 필요하다 */
  types: PeelType[];
  places: Place[];
  now: string;
}) {
  const router = useRouter();
  const { notice, showNotice } = useNotice();
  // 방금 푼 사람에게 "나도 해보기"는 말이 안 된다 — 그 자리를 [다시 하기]로 바꾼다
  const tookTest = useTookTest();

  return (
    <div className="flex flex-1 flex-col gap-6 pt-2 pb-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <TypeArt slug={type.slug} className="saeu-pop" />
        <div className="saeu-rise saeu-rise-2 flex flex-col items-center gap-1">
          <p className="text-caption-l-medium text-fg-tertiary">당신은</p>
          <h1 className="text-display-l text-fg text-balance break-keep">{type.name}</h1>
          <p className="text-body-l-medium text-fg-secondary">{type.tagline}</p>
        </div>
        {/* 해시태그 — 국내 유형 테스트의 공통 문법이고, 캡처 한 장에 성격이 다 담긴다 */}
        <ul className="saeu-rise saeu-rise-3 flex flex-wrap justify-center gap-1.5">
          {type.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-max border border-line-brand bg-brand-tint px-2.5 py-1 text-caption-l-medium text-brand-fg"
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>

      {/* 결과 본문은 읽히는 게 값이다 — 14px/1.4(정보형)에서 16px/1.7(읽기용 read-l)로 올렸다 */}
      <div className="saeu-rise saeu-rise-4 flex flex-col gap-3 rounded-16 bg-bg-dim px-4 py-4">
        <p className="text-read-l text-fg">{type.description}</p>
        <p className="flex flex-col gap-0.5 text-read-l text-fg-secondary">
          <span className="text-caption-l-semibold text-fg-tertiary">조심할 점</span>
          {type.caution}
        </p>
      </div>

      <p className="flex items-center gap-2 rounded-16 border border-line-brand bg-brand-tint px-4 py-3.5 text-body-l-medium text-brand-fg">
        <ShrimpIcon className="size-4 shrink-0" />
        잘 맞는 유형은 {partner.name}
      </p>

      <TypeMatrix types={types} mine={type.slug} />

      <section className="flex flex-col gap-2">
        <h2 className="text-title-s-semibold text-fg">이 유형에 어울리는 새우집</h2>
        {places.length === 0 ? (
          <EmptyState
            title="아직 어울리는 집을 못 찾았어요"
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
          // 카드는 지도 목록과 같은 것을 쓴다 — 결과 전용 카드를 새로 만들지 않는다
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
        {/* 공유는 **하나만** 둔다(2026-09-09): 결과 링크와 초대 링크를 나란히 두니 만든 사람도 차이를 못 읽었다.
            보내는 건 초대 링크다 — 공유 카드에는 그대로 내 유형과 캐릭터가 뜨고(자랑은 그대로),
            친구가 열면 풀게 되고 궁합까지 나온다. 링크 하나가 다음 테스트를 부르는 쪽을 남긴다. */}
        <Button
          variant="brand"
          size="xl"
          onClick={() => {
            shareUrl(
              { title: `${type.name}과 궁합 보기`, path: peelInvitePath(type.slug) },
              showNotice,
            );
          }}
        >
          친구에게 보내기
        </Button>
        <p className="text-center text-caption-l-regular text-fg-tertiary">
          친구가 풀면 둘의 궁합이 나와요
        </p>
        {/* 공유 링크로 들어온 사람의 입구. 이게 없으면 "당신은 ○○형"만 보고 나간다.
            방금 푼 사람에게는 필요 없으므로 아래 텍스트 줄의 [다시 하기]가 대신한다. */}
        {!tookTest && (
          <Link
            href="/test"
            className={cx(buttonVariants({ variant: "outline", size: "xl" }), "mt-1")}
          >
            나도 해보기
          </Link>
        )}
        <div className="flex items-center justify-center">
          {tookTest && (
            <>
              <Link href="/test" className="hit-44 py-1 text-caption-l-regular text-fg-tertiary">
                다시 하기
              </Link>
              <span aria-hidden="true" className="mx-3 h-3 w-px bg-line" />
            </>
          )}
          <Link href="/" className="hit-44 py-1 text-caption-l-regular text-fg-tertiary">
            지도에서 더 보기
          </Link>
        </div>
      </div>

      {notice && (
        <div className="fixed inset-x-0 bottom-6 flex justify-center px-5">
          <Toast message={notice} />
        </div>
      )}
    </div>
  );
}
