import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: {
    compilerOptions: {
      ignoreDeprecations: "6.0"
    },
    resolve: true
  },
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  shims: true,
  sourcemap: true,
  tsconfig: "tsconfig.build.json"
});
