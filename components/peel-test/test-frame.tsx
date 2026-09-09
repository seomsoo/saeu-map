import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 화면 11의 그릇 — 지도가 없는 "읽는 한 장"(design 화면 11). 공유 링크로 **처음 오는 사람이 주 진입**이라
 * 지도를 띄우지 않는다. 모바일은 좌우 20 여백 한 컬럼, 1024부터 중앙 480(중앙 모달과 같은 폭 —
 * 읽는 폭이지 패널이 아니다). 헤더의 워드마크 하나가 홈 입구다.
 */
export function TestFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg pt-safe-top pb-safe-bottom-or-3">
      <header className="flex h-12 shrink-0 items-center justify-center">
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
      <div className="mx-auto flex w-full max-w-120 flex-1 flex-col px-5">{children}</div>
    </main>
  );
}
