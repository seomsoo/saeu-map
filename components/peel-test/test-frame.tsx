import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 화면 11의 그릇 — 지도가 없는 "읽는 한 장"(design 화면 11). 공유 링크로 **처음 오는 사람이 주 진입**이라
 * 지도를 띄우지 않는다. 모바일은 좌우 여백 한 컬럼, 480부터 중앙 고정(읽는 폭이라 태블릿에서도 안 늘린다).
 *
 * **앱 본체(흰 바탕 정보형)와 다른 톤이다**(2026-09-09): 바탕이 브랜드 틴트고 내용은 흰 카드로 떠 있다.
 * 바이럴 장치라 정보 화면과 같은 결이면 "테스트를 하러 온 기분"이 안 난다. 새 색은 만들지 않았다 —
 * 틴트·헤어라인·그림자 전부 기존 토큰이고, 그라데이션·이모지는 쓰지 않는다(spec 7 금지 목록).
 */
export function TestFrame({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-tint pt-safe-top pb-safe-bottom-or-3">
      {/* 배경 장식 — `shrimp.webp` 알파 마스크를 red-50으로 칠한 실루엣. 별점 마크와 같은 문법이라
          새 에셋이 필요 없고, 카드 뒤에 깔려 화면이 비어 보이지 않게 한다. */}
      <span
        aria-hidden="true"
        className="shrimp-mask pointer-events-none absolute -top-10 -left-12 size-44 -rotate-12 text-red-50"
      />
      <span
        aria-hidden="true"
        className="shrimp-mask pointer-events-none absolute -right-14 bottom-20 size-52 rotate-12 text-red-50"
      />

      <header className="relative flex h-12 shrink-0 items-center justify-center">
        <Link href="/" aria-label="새우맵 홈">
          {/* next.config images.unoptimized — 에셋을 그대로 그린다 */}
          <Image
            src="/wordmark.webp"
            alt="새우맵"
            width={137}
            height={60}
            priority
            draggable={false}
            className="h-5.5 w-auto"
          />
        </Link>
      </header>

      <div className="relative mx-auto flex w-full max-w-120 flex-1 flex-col px-4 pb-3">
        <div className="flex flex-1 flex-col rounded-20 bg-bg px-5 py-6 shadow-card">{children}</div>
      </div>
    </main>
  );
}
