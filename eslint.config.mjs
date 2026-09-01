import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [".next/", "node_modules/", "coverage/", "*.config.*"],
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
      "boundaries/elements": [
        { type: "app", pattern: ["app/*"] },
        { type: "components", pattern: ["components/*"] },
        { type: "lib", pattern: ["lib/*"] },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
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
              from: { element: { type: "lib" } },
              allow: [{ to: { element: { type: "lib" } } }],
            },
          ],
        },
      ],
    },
  },
);
