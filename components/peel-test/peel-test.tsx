"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { QUESTION_ART, peelMatchPath, peelTypePath, scoreAnswers } from "@/lib/peel-test";
import type { PeelTest as PeelTestContent, PeelType } from "@/lib/types";
import { ShrimpArt, TypeArt } from "./type-art";

/**
 * 표지 → 문항 6개 → "결과 만드는 중" (design 화면 11-1·2·변형 a).
 * 진행 상태는 **컴포넌트 메모리**다(규칙 4: localStorage 금지). 히스토리도 건드리지 않는다 —
 * 문항마다 엔트리를 쌓는 것보다 [이전] 버튼이 싸고, 브라우저 뒤로가기는 표지로 나가는 게 자연스럽다.
 *
 * `partner`가 있으면 궁합 초대(`/test/with/[type]`)로 들어온 것이라 결과가 궁합으로 떨어진다.
 */
export function PeelTest({
  content,
  partner = null,
}: {
  content: PeelTestContent;
  partner?: PeelType | null;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();

  const question = content.questions[index];
  const art = question ? QUESTION_ART[question.id] : undefined;

  function choose(choice: number) {
    const next = [...answers.slice(0, index), choice];
    setAnswers(next);
    if (index + 1 < content.questions.length) {
      setIndex(index + 1);
      return;
    }
    const slug = scoreAnswers(content.questions, next);
    const path = partner ? peelMatchPath(slug, partner.slug) : peelTypePath(slug);
    startTransition(() => {
      router.push(path);
    });
  }

  function back() {
    if (index === 0) {
      setStarted(false);
      return;
    }
    setIndex(index - 1);
    setAnswers(answers.slice(0, index - 1));
  }

  if (pending) {
    return (
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 pb-16">
        <ShrimpArt bob className="saeu-pop" />
        <p className="saeu-rise saeu-rise-2 text-body-m-medium text-fg-secondary">결과 만드는 중</p>
      </div>
    );
  }

  if (!started || !question) {
    return (
      <div className="flex flex-1 flex-col">
        {/* 본문은 남는 높이의 가운데, CTA는 바닥 — 제보 퍼널과 같은 문법이다(design 화면 3·11) */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <ShrimpArt className="saeu-pop" />
          {partner && (
            <p className="saeu-rise saeu-rise-2 rounded-max bg-brand-tint px-3 py-1.5 text-caption-l-medium text-brand-fg">
              {content.invite.eyebrow.replace("{name}", partner.name)}
            </p>
          )}
          <div className="saeu-rise saeu-rise-2 flex flex-col items-center gap-2">
            <h1 className="text-display-l text-fg text-balance break-keep">{content.title}</h1>
            <p className="text-body-l-medium text-fg-secondary">
              {partner ? content.invite.subtitle : content.subtitle}
            </p>
            {/* 소요 시간은 문장이 아니라 배지다 — 회색 한 줄로 두면 안 읽히고, 짧다는 게 시작의 이유다 */}
            <p className="flex items-center gap-1 rounded-max bg-bg-sunken px-3 py-1 text-caption-l-medium text-fg-secondary">
              <span aria-hidden="true" className="icon-[ci--timer] size-3.5" />
              {content.duration}
            </p>
          </div>
          {/* 유형 미리보기 — 뭘 받게 되는지 보여야 시작 버튼을 누른다. 표지 아래 공백도 이걸로 채운다 */}
          <div className="saeu-rise saeu-rise-3 mt-2 flex flex-col items-center gap-2">
            <ul className="flex items-center justify-center gap-2">
              {content.types.map((type) => (
                <li key={type.slug}>
                  <TypeArt slug={type.slug} size="sm" />
                </li>
              ))}
            </ul>
            <p className="text-caption-l-regular text-fg-tertiary">
              {content.types.length}가지 유형 중 하나가 나와요
            </p>
          </div>
        </div>
        <Button
          variant="brand"
          size="xl"
          className="saeu-rise saeu-rise-4 mb-2 w-full"
          onClick={() => {
            setStarted(true);
          }}
        >
          시작하기
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-2">
      {/* 숫자 "3/6"이 아니라 칸으로 읽힌다 — 제보 퍼널의 진행 세그먼트와 같은 문법(design 화면 3·11) */}
      <div
        role="progressbar"
        aria-label="테스트 진행"
        aria-valuemin={1}
        aria-valuemax={content.questions.length}
        aria-valuenow={index + 1}
        className="flex shrink-0 gap-1"
      >
        {content.questions.map((q, i) => (
          <span
            key={q.id}
            className={cx(
              "h-1 flex-1 rounded-max transition-colors duration-300",
              i <= index ? "bg-brand" : "bg-bg-sunken",
            )}
          />
        ))}
      </div>

      {/* key가 문항 id라 넘어갈 때마다 새로 마운트되며 떠오른다 — 6문항이 같은 자리에서 갈아끼워지는 화면이라
          전환이 없으면 글자만 바뀐 것처럼 보인다(2026-09-09) */}
      <div key={question.id} className="flex min-h-0 flex-1 flex-col justify-center gap-5">
        {/* 문항마다 그 장면의 일러스트. 없는 문항은 그림 없이 그린다(엉뚱한 장면보다 낫다) */}
        {art && (
          // 남는 세로를 일러스트가 가져간다: 702에서 크게, 480에서 알아서 줄어 [이전]까지 한 화면에 든다.
          // 고정 높이는 둘 중 하나를 포기하게 된다(2026-09-09). max-h-64는 데스크탑에서 너무 커지지 않게.
          <span className="flex min-h-0 flex-1 items-center justify-center">
            <Image
              src={art}
              alt=""
              width={400}
              height={400}
              priority
              draggable={false}
              className="saeu-rise h-full max-h-64 min-h-16 w-auto object-contain"
            />
          </span>
        )}
        <div className="saeu-rise flex flex-col gap-1">
          <p className="flex items-center gap-1 text-caption-l-medium text-brand-fg tabular-nums">
            질문 {index + 1}
            <span className="text-fg-placeholder">/ {content.questions.length}</span>
          </p>
          <h1 className="text-display-m text-fg break-keep">{question.text}</h1>
        </div>
        <div className="saeu-rise saeu-rise-2 flex flex-col gap-2">
          {question.choices.map((choice, i) => (
            <button
              key={choice}
              type="button"
              onClick={() => {
                choose(i);
              }}
              className="press group flex h-16 items-center gap-3 rounded-16 border border-line bg-bg px-4 text-left text-body-l-medium text-fg transition-colors hover:border-brand-fg hover:bg-brand-tint hover:text-brand-fg active:border-brand-fg active:bg-brand-tint active:text-brand-fg"
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-max bg-bg-sunken text-caption-l-semibold text-fg-tertiary transition-colors group-hover:bg-brand group-hover:text-fg-on-brand group-active:bg-brand group-active:text-fg-on-brand"
              >
                {i + 1}
              </span>
              <span className="flex-1">{choice}</span>
              <span
                aria-hidden="true"
                className="icon-[ci--chevron-right] size-4 shrink-0 text-fg-placeholder transition-colors group-hover:text-brand-fg"
              />
            </button>
          ))}
        </div>
      </div>

      {/* 되돌아가기는 실수했을 때 유일한 출구다 — 12px 회색 글자로 두면 안 보이고 안 눌린다(2026-09-09) */}
      <Button variant="outline" size="pill" className="mt-6 mb-1 self-start" onClick={back}>
        <span aria-hidden="true" className="icon-[ci--chevron-left] -ml-1 size-4" />
        이전
      </Button>
    </div>
  );
}
