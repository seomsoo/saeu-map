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
        // scripts/*.mjs는 Next 앱 tsconfig 밖이라 기본 프로젝트로 검사한다 (CI 보조 스크립트, 2026-09-08)
        projectService: { allowDefaultProject: ["scripts/*.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
  {
    // CI 보조 스크립트 — lhci가 만든 JSON을 읽는다. 타입 소스가 없어 `JSON.parse`가 전부 any이고
    // strict-type-checked의 unsafe-* 가 다 걸린다. 앱 코드가 아니고(번들에 안 들어간다) 형식이 어긋나면
    // 그 자리에서 예외가 나 CI 로그에 드러나므로, **이 파일들에서만** 끈다. 나머지 규칙은 그대로 적용된다.
    files: ["scripts/*.mjs"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
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
  {
    /* 경계 JSON을 읽는 함수는 lib/data.ts만 부른다 (CLAUDE.md 절대 규칙 1).
       boundaries 플러그인은 components → lib을 통째로 허용하고 데이터 차단이 lib/mock에만 걸려 있어
       lib/gu.ts를 못 잡는다. 같은 파일에 getGuOfPoint를 이미 import해 두고도 lib/gu를 직접 부르는
       일이 실제로 났다(Codex PR #13). 나머지 export(SEOUL_GU·isSeoulGu·GU_SLUGS·guSlug·guFromSlug)는
       순수 상수·매핑이라 app에서 직접 써도 된다 — 그래서 모듈이 아니라 이름 단위로 막는다. */
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**", "**/*.test.*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/gu",
              importNames: ["guOfPoint", "guCenter"],
              message:
                "경계 파일을 읽는 함수는 lib/data.ts 경유 (절대 규칙 1) — getGuOfPoint·getGuCenter를 쓴다.",
            },
          ],
        },
      ],
    },
  },
);
