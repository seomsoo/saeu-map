"use client";

import { useEffect } from "react";
import { preconnect, preload } from "react-dom";
import { NavermapsProvider } from "react-naver-maps";
import { NAVER_MAPS_ORIGIN, NAVER_MAPS_SUBMODULES, naverMapsScriptUrl } from "@/lib/naver-sdk";

interface NaverMapProviderProps {
  children: React.ReactNode;
  /** NEXT_PUBLIC_NCP_CLIENT_ID가 빌드에 없을 때 — 화면이 에러 상태로 전환한다 (4상태 계약). */
  onMissingConfig: () => void;
}

export default function NaverMapProvider({
  children,
  onMissingConfig,
}: NaverMapProviderProps) {
  const clientId = process.env["NEXT_PUBLIC_NCP_CLIENT_ID"];
  const missing = !clientId;

  // SDK를 HTML 단계에서 미리 받는다(plan perf-diet A5): 렌더 중 호출이라 SSR이 head에 <link rel="preload">를 넣고,
  // 하이드레이션 뒤 로더가 꽂는 <script>(같은 주소, lib/naver-sdk 테스트가 보장)가 그 응답을 재사용한다. 브라우저에선 중복 호출이 무시된다.
  // 타일 호스트(pstatic)는 걸지 않는다 — 규칙 3의 도메인이라 코드에 이름을 두지 않는다(SDK가 알아서 연다).
  if (clientId) {
    preconnect(NAVER_MAPS_ORIGIN);
    preload(naverMapsScriptUrl(clientId), { as: "script" });
  }

  useEffect(() => {
    if (missing) onMissingConfig();
  }, [missing, onMissingConfig]);

  if (missing || !clientId) return null;

  // geocoder: 제보 2단계 주소 검색(핀 이동 보조). 응답은 표시용으로만 쓰고 저장하지 않는다(규칙 2).
  // submodules는 모듈 상수 — 렌더마다 새 배열이면 로더가 스크립트를 다시 끼울 수 있다
  return (
    <NavermapsProvider ncpKeyId={clientId} submodules={NAVER_MAPS_SUBMODULES}>
      {children}
    </NavermapsProvider>
  );
}
