"use client";

import { NavermapsProvider } from "react-naver-maps";

export default function NaverMapProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientId = process.env["NEXT_PUBLIC_NCP_CLIENT_ID"];

  if (!clientId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface-dim text-ink-secondary">
        <p>
          NEXT_PUBLIC_NCP_CLIENT_ID 환경변수를 설정해주세요.
          <br />
          .env.local에 NCP Maps Client ID를 넣으면 지도가 표시됩니다.
        </p>
      </div>
    );
  }

  return <NavermapsProvider ncpKeyId={clientId}>{children}</NavermapsProvider>;
}
