import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, OPERATOR_NAME } from "@/lib/legal";

/**
 * 화면 12의 그릇 — 지도가 없는 "읽는 한 장"이지만 **톤은 앱 본체(흰 바탕 정보형)**다(design 화면 12).
 * 화면 11(까주기 테스트)과 달리 틴트·실루엣·모션이 없고, 뷰포트에 묶지 않고 페이지가 그냥 스크롤한다 —
 * 고정할 일러스트가 없고 긴 문서는 브라우저 스크롤이 맞다. 컬럼은 640에서 캡(문서 읽는 폭).
 */
export function DocFrame({
  title,
  kind,
  children,
}: {
  title: string;
  /** 바닥 줄에서 지금 보는 문서는 링크가 아니라 잉크 글자다 */
  kind: "privacy" | "terms";
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-bg pt-safe-top pb-safe-bottom">
      <header className="flex h-12 items-center justify-center">
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

      <article className="mx-auto w-full max-w-160 px-5 pt-2 pb-10">
        <h1 className="text-title-m-bold">{title}</h1>
        <p className="mt-1 text-caption-l-regular text-fg-tertiary tabular-nums">시행일 {LEGAL_EFFECTIVE_DATE}</p>

        {children}

        <aside className="mt-8 rounded-12 bg-bg-sunken p-4">
          <p className="text-body-m-semibold">문의</p>
          <p className="mt-1 text-body-m-regular">
            {OPERATOR_NAME} ·{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </aside>

        <footer className="mt-8 text-caption-l-regular text-fg-tertiary">
          <p className="flex items-center gap-2">
            {kind === "terms" ? <span>이용약관</span> : <Link href="/terms" className="underline">이용약관</Link>}
            <span aria-hidden="true" className="h-3 w-px bg-line-hairline" />
            {kind === "privacy" ? (
              <span>개인정보처리방침</span>
            ) : (
              <Link href="/privacy" className="underline">
                개인정보처리방침
              </Link>
            )}
          </p>
          <p className="mt-2">
            <Link href="/" className="underline">
              ← 지도로 돌아가기
            </Link>
          </p>
        </footer>
      </article>
    </main>
  );
}

/* ── 본문 조각 — 절·문단·목록·표. 문서 두 장이 같은 문법을 쓴다 ── */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-title-s-semibold">{title}</h2>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-body-m-regular">{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-body-m-regular text-fg-secondary">{children}</p>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-4 text-body-m-regular">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** 열이 있는 것만 표로(수집 항목·위탁·보관). 화면 10 표 문법 — 모바일에서는 바깥이 가로 스크롤 */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-120 border-collapse text-left">
        <thead>
          <tr className="border-b border-line-hairline">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 text-caption-l-semibold text-fg-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-b border-line-hairline align-top">
              {cells.map((cell, c) => (
                <td key={c} className="px-3 py-2.5 text-body-m-regular">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
