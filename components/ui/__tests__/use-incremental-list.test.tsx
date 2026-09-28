import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIncrementalList } from "../use-incremental-list";

/** 가짜 IntersectionObserver — 마지막 인스턴스의 콜백을 테스트가 직접 부른다 */
let callbacks: IntersectionObserverCallback[] = [];
let observed: Element[] = [];
class FakeObserver {
  constructor(cb: IntersectionObserverCallback) {
    callbacks.push(cb);
  }
  observe(el: Element) {
    observed.push(el);
  }
  disconnect() {}
  unobserve() {}
}
function reachEnd() {
  const cb = callbacks.at(-1);
  if (!cb) throw new Error("no observer");
  act(() => {
    cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

function List({ items, step }: { items: readonly string[]; step?: number }) {
  const { visible, done, sentinelRef } = useIncrementalList(items, items.join("\n"), step);
  return (
    <ul aria-label="목록">
      {visible.map((v) => (
        <li key={v}>{v}</li>
      ))}
      {!done && <li ref={sentinelRef} aria-hidden="true" data-testid="sentinel" />}
    </ul>
  );
}
const items = (n: number, prefix = "가게") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const shown = () => screen.getAllByRole("listitem").length;

describe("useIncrementalList — 처음 step장, 끝이 보이면 step장씩 더", () => {
  beforeEach(() => {
    callbacks = [];
    observed = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("처음엔 step장 + 감시 요소, 끝에 닿으면 늘고 다 그리면 감시 요소가 사라진다", () => {
    render(<List items={items(70)} step={30} />);
    expect(shown()).toBe(30);
    expect(screen.getByTestId("sentinel")).toBeInTheDocument();
    expect(observed).toHaveLength(1);
    reachEnd();
    expect(shown()).toBe(60);
    reachEnd();
    expect(shown()).toBe(70);
    expect(screen.queryByTestId("sentinel")).not.toBeInTheDocument();
  });

  it("목록이 step보다 짧으면 전부 그리고 감시 요소가 없다", () => {
    render(<List items={items(5)} step={30} />);
    expect(shown()).toBe(5);
    expect(screen.queryByTestId("sentinel")).not.toBeInTheDocument();
  });

  it("목록 배열이 바뀌면(필터·정렬) 처음 step장부터 다시 센다", () => {
    const { rerender } = render(<List items={items(70)} step={30} />);
    reachEnd();
    expect(shown()).toBe(60);
    rerender(<List items={items(50, "집")} step={30} />);
    expect(shown()).toBe(30);
    expect(screen.getByText("집1")).toBeInTheDocument();
  });

  it("같은 id 순서의 새 배열(찜 토글·지도 idle)이면 한도를 유지한다 — reviewer P2", () => {
    const first = items(70);
    const { rerender } = render(<List items={first} step={30} />);
    reachEnd();
    expect(shown()).toBe(60);
    rerender(<List items={[...first]} step={30} />); // 내용 같고 identity만 다르다
    expect(shown()).toBe(60);
  });

  it("IntersectionObserver가 없는 브라우저는 마운트 뒤 전부 그린다", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<List items={items(70)} step={30} />);
    expect(shown()).toBe(70);
    expect(screen.queryByTestId("sentinel")).not.toBeInTheDocument();
  });

  it("서버 렌더(IO 없음)도 첫 step장 + 감시 요소 — 브라우저 첫 렌더와 같은 DOM이라 hydration이 어긋나지 않는다 (Codex PR #27 P1)", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const html = renderToString(<List items={items(70)} step={30} />);
    expect(html.match(/<li>/g)?.length ?? 0).toBe(30);
    expect(html).toContain('data-testid="sentinel"');
  });
});
