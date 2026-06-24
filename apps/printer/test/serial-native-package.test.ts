import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getSerialPlatformBindingKind,
  getSerialPrebuildSearch,
  resolveSerialPackageRoot
} from "../src/transports/serial/internal/bundled-serialport.js";

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

  it("resolves the installed package root when serial code is bundled elsewhere", () => {
    const bundledOutputDir      = resolve(packageRoot, "..", "..", "electron-app", "out", "main");
    const installedPackageEntry = resolve(packageRoot, "dist", "index.cjs");

    expect(
      resolveSerialPackageRoot(bundledOutputDir, () => installedPackageEntry)
    ).toBe(packageRoot);
  });

  it("selects serial binding layers for Windows, macOS, Linux, and Android", () => {
    expect(getSerialPlatformBindingKind("win32")).toBe("windows");
    expect(getSerialPlatformBindingKind("darwin")).toBe("darwin");
    expect(getSerialPlatformBindingKind("linux")).toBe("linux");
    expect(getSerialPlatformBindingKind("android")).toBe("linux");
  });

  it("searches serial prebuilds by platform, architecture, and libc", () => {
    expect(getSerialPrebuildSearch({ platform: "darwin", arch: "arm64" })).toEqual({
      directories: ["darwin-arm64", "darwin-x64+arm64"],
      fileNames  : ["@node-printer+serialport.node"]
    });
    expect(getSerialPrebuildSearch({ platform: "linux", arch: "x64", libc: "musl" })).toEqual({
      directories: ["linux-x64"],
      fileNames  : ["@node-printer+serialport.musl.node", "@node-printer+serialport.node"]
    });
    expect(getSerialPrebuildSearch({ platform: "android", arch: "arm64" })).toEqual({
      directories: ["android-arm64"],
      fileNames  : ["@node-printer+serialport.armv8.node", "@node-printer+serialport.node"]
    });
  });

  it("packages serial prebuilds beyond Windows", async () => {
    const copyScript = await readFile(resolve(packageRoot, "scripts", "prebuild-serialport.cjs"), "utf8");
    const checkScript = await readFile(resolve(packageRoot, "scripts", "check-prebuilds.cjs"), "utf8");

    expect(copyScript).toContain("readdirSync(serialportPrebuild");
    expect(checkScript).toContain("darwin-x64+arm64");
    expect(checkScript).toContain("linux-x64");
    expect(checkScript).toContain("android-arm64");
  });
});
