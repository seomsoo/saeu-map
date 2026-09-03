import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // tsconfig의 jsx: "preserve"는 Next 전용. 테스트 변환기(oxc)에는 automatic 런타임을 명시한다.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "jsdom",
    // 기본 5초는 머신이 놀 때의 값이다 — dev 서버·Playwright 브라우저가 같이 돌면 렌더가 무거운
    // 상세 테스트가 5초를 넘겨 훅이 false failure를 낸다. 진짜 멈춘 테스트는 10초 늦게 잡히면 된다.
    testTimeout: 15_000,
    include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", ".open-next/**", ".wrangler/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "."),
    },
  },
});
