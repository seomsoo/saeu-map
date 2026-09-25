import { describe, expect, it } from "vitest";
// 패키지 exports 밖의 내부 모듈 — 라이브러리와 우리 주소가 갈리면 프리로드가 버려지고 SDK를 두 번 받는다. 그래서 라이브러리 함수와 직접 대조한다
import { buildUrl } from "../../node_modules/react-naver-maps/dist/load-script.js";
import { NAVER_MAPS_SUBMODULES, naverMapsScriptUrl } from "../naver-sdk";

describe("naverMapsScriptUrl — react-naver-maps buildUrl과 바이트 단위로 같다 (preload 재사용 조건)", () => {
  it("같은 키·같은 서브모듈이면 같은 문자열", () => {
    const clientId = "abc123";
    expect(naverMapsScriptUrl(clientId)).toBe(buildUrl({ ncpKeyId: clientId, submodules: NAVER_MAPS_SUBMODULES }));
  });

  it("특수문자 키도 같은 인코딩", () => {
    const clientId = "a b+c/d";
    expect(naverMapsScriptUrl(clientId)).toBe(buildUrl({ ncpKeyId: clientId, submodules: NAVER_MAPS_SUBMODULES }));
  });
});
