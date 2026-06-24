import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");

describe("serial native package", () => {
  it("does not depend on the native serialport package directly", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(packageRoot, "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).not.toHaveProperty("serialport");
    expect(packageJson.dependencies).toHaveProperty("@serialport/stream");
  });

  it("ships serialport prebuilds for supported Windows architectures", () => {
    const architectures = ["win32-x64", "win32-ia32", "win32-arm64"];

    for (const architecture of architectures) {
      expect(
        existsSync(
          resolve(packageRoot, "prebuilds", architecture, "@node-printer+serialport.node")
        )
      ).toBe(true);
    }
  });
});
