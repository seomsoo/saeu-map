import type { CSSProperties, ReactNode } from "react";

/**
 * 공유 카드 1200×630 (spec 4.6, design 공통 블록 데스크탑 문단·decisions 2026-09-07) — next/og(satori)가 그린다.
 * satori는 Tailwind 클래스·CSS 변수를 모르므로 **인라인 스타일 + hex**다. 값은 docs/design.md 토큰 표를 그대로 옮긴 것
 * (gray-900 #191F28 · gray-600 #6B7684 · gray-500 #8B95A1 · gray-100 #F2F4F6 · red-500 #F04A28 · coral #F0885C · teal #14957B).
 * 셋 다 같은 뼈대: 위 = 작은 눈썹 줄 + 큰 제목 + 보조 두 줄 / 아래 = 왼쪽 브랜드(레드 점 + 새우맵), 오른쪽 마커 모티프.
 * 사진은 넣지 않는다(외부 fetch 없음, 로고 에셋 대기).
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

const INK = "#191F28";
const GRAY_600 = "#6B7684";
const GRAY_500 = "#8B95A1";
const GRAY_100 = "#F2F4F6";
const RED = "#F04A28";
const CATEGORY_COLOR = { grill: "#F0885C", raw: "#14957B" } as const;

export type ShareCardProps =
  | {
      variant: "place";
      name: string;
      /** "마포구 · 새우구이 · 생새우회" */
      meta: string;
      /** "생새우소금구이 1kg 60,000원" (없으면 null). 상대 시간("어제 확인")은 넣지 않는다 — 카드는 배포 시점에 굽힌다 */
      menu: string | null;
      category: keyof typeof CATEGORY_COLOR;
    }
  | { variant: "gu"; name: string; count: number; /** 상호 최대 3곳, 없으면 null */ names: string | null }
  | { variant: "root"; /** 배포 시점의 가게 수 */ count: number };

const root: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: 72,
  background: "#FFFFFF",
  color: INK,
  fontFamily: "Pretendard",
  letterSpacing: "-0.02em",
};

function Text({ size, weight = 400, color = INK, children, style }: {
  size: number;
  weight?: 400 | 700;
  color?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ fontSize: size, fontWeight: weight, color, lineHeight: 1.3, display: "flex", ...style }}>
      {children}
    </div>
  );
}

/** 한 줄 제목 — 길면 말줄임 (상호는 대개 15자 안) */
const oneLine: CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 1056,
};

/** 화면 1의 개별 핀(카테고리색 링 + 색점)을 160px로 키운 모티프 */
function PinMotif({ category }: { category: keyof typeof CATEGORY_COLOR }) {
  const color = CATEGORY_COLOR[category];
  return (
    <div
      style={{
        width: 160,
        height: 160,
        borderRadius: 9999,
        border: `10px solid ${color}`,
        background: GRAY_100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 9999, background: color, display: "flex" }} />
    </div>
  );
}

/** 클러스터 마커(레드 원 + 가게 수)를 160px로 */
function ClusterMotif({ count }: { count: number }) {
  return (
    <div
      style={{
        width: 160,
        height: 160,
        borderRadius: 9999,
        background: RED,
        color: "#FFFFFF",
        fontSize: count >= 100 ? 56 : 68,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {count}
    </div>
  );
}

function Brand({ caption }: { caption: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 16, height: 16, borderRadius: 9999, background: RED, display: "flex" }} />
        <Text size={34} weight={700}>새우맵</Text>
      </div>
      <Text size={24} color={GRAY_500}>{caption}</Text>
    </div>
  );
}

export function ShareCard(props: ShareCardProps) {
  if (props.variant === "place") {
    return (
      <div style={root}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Text size={28} color={GRAY_600}>{props.meta}</Text>
          <Text size={76} weight={700} style={oneLine}>{props.name}</Text>
          {props.menu && <Text size={36} color={INK} style={oneLine}>{props.menu}</Text>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Brand caption="서울 새우구이 지도" />
          <PinMotif category={props.category} />
        </div>
      </div>
    );
  }
  if (props.variant === "gu") {
    return (
      <div style={root}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Text size={28} color={GRAY_600}>서울</Text>
          <Text size={76} weight={700}>{props.name}</Text>
          <Text size={40}>새우구이 {props.count}곳</Text>
          {props.names && <Text size={28} color={GRAY_500} style={oneLine}>{props.names}</Text>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Brand caption="서울 새우구이 지도" />
          {/* 0곳인 구에 "0" 클러스터는 말이 안 된다 — 모티프 없이 */}
          {props.count > 0 && <ClusterMotif count={props.count} />}
        </div>
      </div>
    );
  }
  return (
    <div style={root}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Text size={28} color={GRAY_600}>서울 새우구이 지도</Text>
        <Text size={96} weight={700}>새우맵</Text>
        <Text size={36} color={GRAY_600}>다녀온 사람들의 확인과 제보로 갱신돼요</Text>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Brand caption={`가게 ${props.count}곳`} />
        <ClusterMotif count={props.count} />
      </div>
    </div>
  );
}
