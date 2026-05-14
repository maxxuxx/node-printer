import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// 테스트에서 빌드 산출물 대신 각 패키지의 현재 소스를 직접 바라보게 합니다
const workspacePackages = {
  "@node-printer/printer"         : "./packages/printer/src/index.ts",
  "@node-printer/printer-core"    : "./packages/printer-core/src/index.ts",
  "@node-printer/printer-cups"    : "./packages/printer-cups/src/index.ts",
  "@node-printer/printer-network" : "./packages/printer-network/src/index.ts",
  "@node-printer/printer-serial"  : "./packages/printer-serial/src/index.ts",
  "@node-printer/printer-winspool": "./packages/printer-winspool/src/index.ts"
};

const alias = Object.fromEntries(
  // Vite alias는 절대 경로가 필요하므로 파일 URL을 로컬 경로로 변환합니다
  Object.entries(workspacePackages).map(([name, path]) => [
    name,
    fileURLToPath(new URL(path, import.meta.url))
  ])
);

export default defineConfig({
  resolve: {
    alias
  }
});
