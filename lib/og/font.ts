import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * OG 카드(next/og = satori) 폰트 — Pretendard **KS X 1001 subset woff**(Bold·Regular 각 350KB, SIL OFL, public/fonts/og/).
 * satori는 woff2를 못 읽고 전체 otf는 1.5MB라 subset woff를 쓴다(decisions 2026-09-07).
 * 워커 번들에 넣지 않고 런타임에 읽는다: Cloudflare에선 정적 에셋 바인딩(ASSETS — OpenNext 내부 정적 캐시와 같은
 * `http://assets.local/…` 패턴), 컨텍스트가 없는 곳(`next build` 프리렌더·`next dev`)에선 public/에서 fs로.
 * 모듈 캐시라 워커 인스턴스마다 한 번만 읽는다.
 */
export interface OgFont {
  name: "Pretendard";
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

const OG_FONT_DIR = "fonts/og";
const FILES: Record<OgFont["weight"], string> = {
  400: "Pretendard-Regular.subset.woff",
  700: "Pretendard-Bold.subset.woff",
};

interface AssetFetcher {
  fetch(input: string): Promise<Response>;
}

/** 워커 env의 ASSETS 바인딩 — 전역 Cloudflare 타입에 기대지 않고 런타임 형태로 확인한다 */
function assetsBinding(env: unknown): AssetFetcher | null {
  if (typeof env !== "object" || env === null) return null;
  const assets: unknown = (env as { ASSETS?: unknown }).ASSETS;
  if (typeof assets !== "object" || assets === null) return null;
  return typeof (assets as { fetch?: unknown }).fetch === "function" ? (assets as AssetFetcher) : null;
}

async function readViaAssets(file: string): Promise<ArrayBuffer | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const assets = assetsBinding(env);
    if (!assets) return null;
    const res = await assets.fetch(`http://assets.local/${OG_FONT_DIR}/${file}`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null; // 컨텍스트 없음(빌드·dev) → fs 폴백
  }
}

async function readViaFs(file: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(process.cwd(), "public", OG_FONT_DIR, file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function loadFont(weight: OgFont["weight"]): Promise<OgFont> {
  const file = FILES[weight];
  const data = (await readViaAssets(file)) ?? (await readViaFs(file));
  return { name: "Pretendard", data, weight, style: "normal" };
}

let cached: Promise<OgFont[]> | null = null;

/** Bold(제목)·Regular(본문) 두 벌. 실패하면 캐시를 비워 다음 요청이 다시 시도한다 */
export function ogFonts(): Promise<OgFont[]> {
  cached ??= Promise.all([loadFont(700), loadFont(400)]).catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}
