import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// 테스트에서 빌드 산출물 대신 각 패키지의 현재 소스를 직접 바라보게 합니다
const workspacePackages = {
  "#core"    : "./apps/printer/src/core/index.ts",
  "#cups"    : "./apps/printer/src/transports/cups/index.ts",
  "#network" : "./apps/printer/src/transports/network/index.ts",
  "#serial"  : "./apps/printer/src/transports/serial/index.ts",
  "#winspool": "./apps/printer/src/transports/winspool/index.ts"
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
