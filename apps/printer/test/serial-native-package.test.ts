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

  it("generates and checks native prebuilds during pack", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(packageRoot, "package.json"), "utf8")
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      "prebuild:check"     : "node scripts/check-prebuilds.cjs",
      "prebuild:serialport": "node scripts/prebuild-serialport.cjs"
    });
    expect(packageJson.scripts?.prepack).toContain("prebuild:serialport");
    expect(packageJson.scripts?.prepack).toContain("prebuild:check");
    expect(existsSync(resolve(packageRoot, "scripts", "check-prebuilds.cjs"))).toBe(true);
    expect(existsSync(resolve(packageRoot, "scripts", "prebuild-serialport.cjs"))).toBe(true);
  });
});
