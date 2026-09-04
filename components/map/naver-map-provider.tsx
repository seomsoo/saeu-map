"use client";

import { useEffect } from "react";
import { NavermapsProvider } from "react-naver-maps";

/** 렌더마다 새 배열이면 로더가 스크립트를 다시 끼울 수 있어 모듈 상수로 */
const GEOCODER_SUBMODULES = ["geocoder"];

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

  useEffect(() => {
    if (missing) onMissingConfig();
  }, [missing, onMissingConfig]);

  if (missing || !clientId) return null;

  // geocoder: 제보 2단계 주소 검색(핀 이동 보조). 응답은 표시용으로만 쓰고 저장하지 않는다(규칙 2).
  return (
    <NavermapsProvider ncpKeyId={clientId} submodules={GEOCODER_SUBMODULES}>
      {children}
    </NavermapsProvider>
  );
}
