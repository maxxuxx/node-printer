import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // 생성 산출물은 사람이 읽는 소스가 아니므로 lint 대상에서 제외합니다
  {
    ignores: ["**/dist/**", "**/coverage/**", "apps/test-server/public/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 타입 전용 import 규칙은 TypeScript 소스에만 적용합니다
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error"
    }
  }
);
