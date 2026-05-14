import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// 예제 서버 기준 경로에서 UI 루트와 public 출력 경로를 계산
const exampleDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  root   : resolve(exampleDir, "ui"),
  build  : {
    assetsDir: "assets",
    emptyOutDir: true,
    outDir: resolve(exampleDir, "public")
  }
});
