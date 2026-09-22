import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata as privacyMeta } from "@/app/privacy/page";
import TermsPage, { metadata as termsMeta } from "@/app/terms/page";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

/** 화면 12 — 두 문서가 같은 그릇을 쓰고 서로를 가리킨다. 정적 페이지라 4상태는 없다 */
describe("약관·방침 페이지 (design 화면 12)", () => {
  it("방침: 제목·시행일·수집 표·위탁 표·문의 블록, 바닥 줄은 약관만 링크", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "개인정보처리방침" })).toBeInTheDocument();
    expect(screen.getByText(`시행일 ${LEGAL_EFFECTIVE_DATE}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "1. 수집하는 개인정보와 목적" })).toBeInTheDocument();
    const tables = screen.getAllByRole("table");
    expect(tables.length).toBeGreaterThanOrEqual(3); // 수집·보유·위탁
    expect(within(tables[0] as HTMLElement).getByRole("columnheader", { name: "항목" })).toBeInTheDocument();
    expect(screen.getByText("Supabase, Inc.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@/ })).toHaveAttribute("href", expect.stringMatching(/^mailto:/));
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms");
    expect(within(footer).queryByRole("link", { name: "개인정보처리방침" })).toBeNull();
    expect(within(footer).getByRole("link", { name: "← 지도로 돌아가기" })).toHaveAttribute("href", "/");
  });

  it("약관: 제목·10개 절·바닥 줄은 방침만 링크, 홈 워드마크", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "이용약관" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(10);
    expect(screen.getByRole("heading", { level: 2, name: "3. 이용자가 올린 내용" })).toBeInTheDocument();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).queryByRole("link", { name: "이용약관" })).toBeNull();
    expect(screen.getByRole("link", { name: "새우맵 홈" })).toHaveAttribute("href", "/");
  });

  it("메타: 제목은 루트 템플릿이 붙이므로 문서 이름만, canonical은 자기 경로", () => {
    expect(privacyMeta).toMatchObject({ title: "개인정보처리방침", alternates: { canonical: "/privacy" } });
    expect(termsMeta).toMatchObject({ title: "이용약관", alternates: { canonical: "/terms" } });
  });
});
