/**
 * Supabase 클라이언트 — **이 폴더(lib/server)만 Supabase를 안다.** 컴포넌트·훅은 lib/data.ts만 부른다(규칙 1).
 * 브라우저에는 supabase-js가 없다(decisions 2026-09-10) — 그래서 URL·publishable 키도 NEXT_PUBLIC_이 아니다.
 *
 * userClient: 요청의 쿠키 세션으로. RLS가 적용된다(사용자 읽기·쓰기 전부 이걸로).
 * adminClient: secret key(서비스 역할) — RLS를 우회한다. 병합·탈퇴·임포트·크론뿐. 프리뷰 워커에는 키가 없다.
 *   **뷰(places_public)도 이 클라이언트로 읽으면 숨긴 가게가 나온다** — 읽기에 절대 쓰지 않는다.
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/database.types";
import { env } from "@/lib/env";

export type Db = SupabaseClient<Database>;

/**
 * Next는 전역 fetch를 가로채 `unstable_cache` 안의 응답을 다시 캐시한다 — PostgREST 응답이 거기 걸리면
 * 태그를 만료해도 콜백이 옛 응답을 돌려받아 **옛 값이 새 시각으로 다시 캐시된다**(workerd 실측 2026-09-10).
 * 캐시 층은 unstable_cache 하나여야 한다: Supabase 요청은 항상 no-store.
 */
const BUILDING = process.env["NEXT_PHASE"] === "phase-production-build";
const uncachedFetch: typeof fetch = (input, init) =>
  // `next build`의 정적 렌더(OG 카드) 안에서 no-store는 DynamicServerError를 던진다 — 빌드에선 기본 fetch(그 결과는 산출물에 안 남는다: actions.ts의 BUILDING 우회)
  fetch(input, BUILDING ? init : { ...init, cache: "no-store" });

/** `ipHash`는 쓰기 문(write-gate)이 준다 — PostgREST가 request.headers로 넘기고 DB의 rate_ok가 읽는다 */
export async function userClient(options: { ipHash?: string } = {}): Promise<Db> {
  const store = await cookies();
  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: uncachedFetch, ...(options.ipHash !== undefined && { headers: { "x-ip-hash": options.ipHash } }) },
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

let anon: Db | null = null;
/**
 * 세션 없는 공개 읽기 — anon 역할. places_public·reviews_public·season_stats처럼 누구에게나 같은 값은 쿠키를 읽을 이유가 없고,
 * **빌드 시(OG 카드 generateStaticParams)에는 cookies()를 부를 수 없다**(2026-09-10 빌드 실패에서 드러남). 요청마다 JWT 검증도 아낀다.
 */
export function anonClient(): Db {
  anon ??= createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: uncachedFetch },
  });
  return anon;
}

export function adminClient(): Db {
  if (!env.SUPABASE_SECRET_KEY) {
    // 프리뷰 워커·로컬 .env 누락 — 병합·탈퇴가 여기서 막힌다(읽기 전용 프리뷰의 의도)
    throw new Error("secret key not configured");
  }
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: uncachedFetch },
  });
}
