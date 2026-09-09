/**
 * Supabase 클라이언트 — **이 폴더(lib/server)만 Supabase를 안다.** 컴포넌트·훅은 lib/data.ts만 부른다(규칙 1).
 * 브라우저에는 supabase-js가 없다(decisions 2026-09-10) — 그래서 URL·publishable 키도 NEXT_PUBLIC_이 아니다.
 *
 * userClient: 요청의 쿠키 세션으로. RLS가 적용된다(사용자 읽기·쓰기 전부 이걸로).
 * adminClient: secret key(서비스 역할) — RLS를 우회한다. 병합·탈퇴·임포트·크론뿐. 프리뷰 워커에는 키가 없다.
 *   **뷰(places_public)도 이 클라이언트로 읽으면 숨긴 가게가 나온다** — 읽기에 절대 쓰지 않는다.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/database.types";
import { env } from "@/lib/env";

export type Db = SupabaseClient<Database>;

export async function userClient(): Promise<Db> {
  const store = await cookies();
  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 못 쓴다 — 갱신된 토큰은 다음 액션·라우트 핸들러가 저장한다(proxy 없음, decisions 2026-09-10)
        }
      },
    },
  });
}

export function adminClient(): Db {
  if (!env.SUPABASE_SECRET_KEY) {
    // 프리뷰 워커·로컬 .env 누락 — 병합·탈퇴가 여기서 막힌다(읽기 전용 프리뷰의 의도)
    throw new Error("secret key not configured");
  }
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
