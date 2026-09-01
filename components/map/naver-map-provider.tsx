"use client";

import { useEffect } from "react";
import { NavermapsProvider } from "react-naver-maps";

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

  return <NavermapsProvider ncpKeyId={clientId}>{children}</NavermapsProvider>;
}
