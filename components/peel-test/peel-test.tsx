"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { scoreAnswers } from "@/lib/peel-test";
import type { PeelTest as PeelTestContent, PeelType } from "@/lib/types";
import { ShrimpArt } from "./type-art";

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

  function choose(choice: number) {
    const next = [...answers.slice(0, index), choice];
    setAnswers(next);
    if (index + 1 < content.questions.length) {
      setIndex(index + 1);
      return;
    }
    const slug = scoreAnswers(content.questions, next);
    const path = partner ? `/test/${slug}/${partner.slug}` : `/test/${slug}`;
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
        <ShrimpArt className="saeu-pop" />
        <p className="text-caption-l-regular text-fg-tertiary">결과 만드는 중</p>
      </div>
    );
  }

  if (!started || !question) {
    return (
      <div className="flex flex-1 flex-col">
        {/* 본문은 남는 높이의 가운데, CTA는 바닥 — 제보 퍼널과 같은 문법이다(design 화면 3·11) */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <ShrimpArt />
          {partner && (
            <p className="rounded-12 bg-brand-tint px-3 py-1.5 text-caption-l-regular text-brand-fg">
              {partner.name}이 궁합을 신청했어요
            </p>
          )}
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-title-m-bold text-fg">{content.title}</h1>
            <p className="text-body-l-regular text-fg-secondary">
              {partner ? "질문 6개를 풀면 둘의 궁합이 나와요" : content.subtitle}
            </p>
            <p className="text-caption-l-regular text-fg-tertiary">{content.duration}</p>
          </div>
        </div>
        <Button
          variant="brand"
          size="xl"
          className="mb-2 w-full"
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
    <div className="flex flex-1 flex-col pt-2">
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
            className={cx("h-0.5 flex-1 rounded-max", i <= index ? "bg-brand" : "bg-line-hairline")}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6 pb-16">
        <h1 className="text-title-s-semibold text-fg">{question.text}</h1>
        <div className="flex flex-col gap-2">
          {question.choices.map((choice, i) => (
            <button
              key={choice}
              type="button"
              onClick={() => {
                choose(i);
              }}
              className="press h-14 rounded-12 border border-line bg-bg px-4 text-left text-body-l-medium text-fg active:border-brand-fg active:bg-brand-tint active:text-brand-fg"
            >
              {choice}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={back}
        className="hit-44 mb-2 self-start text-caption-l-regular text-fg-tertiary"
      >
        이전
      </button>
    </div>
  );
}
