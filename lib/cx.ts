/** 클래스명 결합. falsy는 버린다 (clsx 대체, 의존성 없음). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
