import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// 테스트에서 빌드 산출물 대신 각 패키지의 현재 소스를 직접 바라보게 합니다
const workspacePackages = {
  "#core"                         : "./libs/core/src/index.ts",
  "#cups"                         : "./apps/cups/src/index.ts",
  "#network"                      : "./apps/network/src/index.ts",
  "#serial"                       : "./apps/serial/src/index.ts",
  "#winspool"                     : "./apps/winspool/src/index.ts",
  "@node-printer/core"            : "./libs/core/src/index.ts"
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
