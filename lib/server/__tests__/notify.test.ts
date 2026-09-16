import { describe, expect, it } from "vitest";
import { webhookPayload } from "../notify";

const SITE = new URL("https://saeu-map.saeu-map.workers.dev");

describe("디스코드 알림 본문 (plan 결정 20)", () => {
  it("상호·요청 종류·가게/관리자 링크만 — 연락처는 없고 멘션은 끈다", () => {
    const payload = webhookPayload({ kind: "owner_request", placeId: "p1", name: "@everyone 새우집", ownerKind: "remove" }, SITE);
    expect(payload.content).toContain("[사장님 요청] `@everyone 새우집` · 게재 삭제 요청");
    expect(payload.content).toContain("https://saeu-map.saeu-map.workers.dev/place/p1");
    expect(payload.content).toContain("https://saeu-map.saeu-map.workers.dev/admin");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
  });

  it("종류별 한 줄 — 제보(중복 의심)·신고 사유(사람 말로)·신고 누적", () => {
    expect(webhookPayload({ kind: "report", placeId: "p2", name: "새집", gu: "마포구", duplicateSuspect: true }, SITE).content).toContain(
      "[새 제보] `새집` · 마포구 · 중복 의심",
    );
    expect(webhookPayload({ kind: "report", placeId: "p2", name: "새집", gu: "마포구", duplicateSuspect: false }, SITE).content).toContain(
      "[새 제보] `새집` · 마포구\n",
    );
    expect(webhookPayload({ kind: "place_report", placeId: "p2", name: "새집", reason: "fake" }, SITE).content).toContain(
      "[가게 신고] `새집` · 사유: 허위·광고성 등록",
    );
    expect(webhookPayload({ kind: "attention", placeId: "p2", name: "새집", count: 3 }, SITE).content).toContain(
      "[신고 누적] `새집` · 열린 신고 3건",
    );
  });
});
