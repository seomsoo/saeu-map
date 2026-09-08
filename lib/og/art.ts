import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * 공유 카드(root)의 새우 아트 — satori는 외부 URL을 못 가져오므로 data URI로 인라인한다.
 * 루트 OG는 **빌드 시 한 번** 굽는다(decisions 2026-09-07: Workers Free는 요청당 CPU 10ms라
 * satori+resvg를 매 요청 돌릴 수 없다) → 폰트(lib/og/font.ts)와 달리 워커 런타임에서 불리지 않아
 * ASSETS 바인딩 경로가 필요 없다. 모듈 캐시라 빌드 중 여러 번 그려도 파일은 한 번만 읽는다.
 */
const FILE = "og-shrimp-pot.png";

let cached: Promise<string> | null = null;

export function shrimpPotArt(): Promise<string> {
  cached ??= readFile(join(process.cwd(), "public", FILE))
    .then((buf) => `data:image/png;base64,${buf.toString("base64")}`)
    .catch((error: unknown) => {
      cached = null; // 다음 호출이 다시 시도한다
      throw error;
    });
  return cached;
}
