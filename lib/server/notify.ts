/**
 * 운영자 알림 — 디스코드 웹훅 하나(봇·토큰 없음, decisions 2026-09-10 #20). 제보·신고·사장님 요청·신고 누적(3회째).
 * 본문은 상호·지역·사유·가게/관리자 링크뿐 — **연락처 같은 개인정보는 싣지 않는다**(채널이 새면 같이 샌다).
 * 상호는 사용자 입력이라 멘션(@everyone)을 끈다. 워커에서는 `waitUntil`로 응답을 막지 않고, 실패는 로그만(커밋 9 Sentry).
 */
import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { env } from "@/lib/env";
import { REPORT_KIND_LABEL, REPORT_REASON_LABEL } from "@/lib/report-labels";
import { siteUrl } from "@/lib/seo";

export type AdminAlert =
  | { kind: "report"; placeId: string; name: string; gu: string; duplicateSuspect: boolean }
  | { kind: "place_flag" | "place_report" | "photo_report"; placeId: string; name: string; reason: string }
  | { kind: "owner_request"; placeId: string; name: string; ownerKind: "edit" | "remove" }
  | { kind: "attention"; placeId: string; name: string; count: number };

const HEAD: Record<AdminAlert["kind"], string> = { ...REPORT_KIND_LABEL, report: "새 제보", attention: "신고 누적" };

function detail(alert: AdminAlert): string {
  switch (alert.kind) {
    case "report":
      return alert.duplicateSuspect ? `${alert.gu} · 중복 의심` : alert.gu;
    case "owner_request":
      return alert.ownerKind === "remove" ? "게재 삭제 요청" : "정보 수정 요청";
    case "attention":
      return `열린 신고 ${alert.count}건`;
    default:
      return `사유: ${REPORT_REASON_LABEL[alert.reason] ?? alert.reason}`;
  }
}

/** 웹훅 본문 — 테스트가 이걸 본다. 링크는 절대 URL(디스코드가 자동 링크). */
export function webhookPayload(alert: AdminAlert, site: URL): { content: string; allowed_mentions: { parse: never[] } } {
  const place = new URL(`/place/${alert.placeId}`, site).toString();
  const admin = new URL("/admin", site).toString();
  return {
    content: `[${HEAD[alert.kind]}] ${alert.name} · ${detail(alert)}\n가게 ${place}\n관리자 ${admin}`,
    allowed_mentions: { parse: [] },
  };
}

export async function notifyAdmin(alert: AdminAlert): Promise<void> {
  const url = env.DISCORD_WEBHOOK_URL;
  if (url === undefined) return;
  const task = fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(webhookPayload(alert, siteUrl(env.SITE_URL))),
  }).then(
    (res) => {
      if (!res.ok) console.error("discord webhook refused", res.status);
    },
    (e: unknown) => {
      console.error("discord webhook failed", e instanceof Error ? e.message : e);
    },
  );
  try {
    // 바인딩 타입(workers-types)은 이 리포에 없다 — 쓰는 한 메서드만 적는다(edge-rate-limit·photos와 같은 방식)
    const { ctx } = (await getCloudflareContext({ async: true })) as { ctx: { waitUntil(promise: Promise<unknown>): void } };
    ctx.waitUntil(task);
  } catch {
    await task; // next dev — 워커 밖. 로컬은 응답이 조금 늦어도 된다
  }
}
