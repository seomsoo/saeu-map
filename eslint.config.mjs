import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      ".next/",
      ".open-next/",
      ".wrangler/",
      "node_modules/",
      "coverage/",
      "*.config.*",
      "cloudflare-env.d.ts",
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
  {
    plugins: { "jsx-a11y": jsxA11y },
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs["recommended-latest"].rules,
  },
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: { boundaries },
    settings: {
      // `@/…` 별칭을 실제 파일로 해석해야 boundaries가 발화한다 (node 리졸버만 있으면 external로 오인).
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
      // 테스트·셋업 파일은 경계 검사 제외 (fixture·mock 자유 import)
      "boundaries/ignore": ["**/__tests__/**", "**/*.test.*", "vitest.setup.ts"],
      // v7: 요소 = 폴더. 첫 매치가 이기므로 구체적인 폴더를 먼저. partialMatch:false = 루트 기준 경로.
      "boundaries/elements": [
        { type: "mock", pattern: "lib/mock", partialMatch: false },
        { type: "app", pattern: "app", partialMatch: false },
        { type: "components", pattern: "components", partialMatch: false },
        { type: "lib", pattern: "lib", partialMatch: false },
      ],
      // 단일 파일 분류: lib/data.ts만 mock JSON을 읽을 수 있다.
      "boundaries/files": [{ pattern: "lib/data.ts", category: "data" }],
    },
    rules: {
      // 의존 방향: app → components → lib. 데이터는 lib/data.ts 경유(절대 규칙 1), 목 JSON은 data.ts만 읽는다.
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "{{ from.element.type }} → {{ to.element.type }} import 금지 (CLAUDE.md 절대 규칙 1: 데이터는 lib/data.ts 경유)",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: [
                { to: { element: { type: "components" } } },
                { to: { element: { type: "lib" } } },
              ],
            },
            {
              from: { element: { type: "components" } },
              allow: [
                { to: { element: { type: "components" } } },
                { to: { element: { type: "lib" } } },
              ],
            },
            {
              from: {
                element: { type: "lib" },
                file: { categories: { noneOf: ["data"] } },
              },
              allow: [{ to: { element: { type: "lib" } } }],
            },
            {
              from: { element: { type: "lib" }, file: { categories: ["data"] } },
              allow: [
                { to: { element: { type: "lib" } } },
                { to: { element: { type: "mock" } } },
              ],
            },
          ],
        },
      ],
    },
  },
);
