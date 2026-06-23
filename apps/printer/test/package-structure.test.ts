import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("package structure", () => {
  it("keeps printer transports inside the public package", () => {
    const workspace = readFileSync(join(rootDir, "pnpm-workspace.yaml"), "utf8");
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, "apps", "printer", "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
    };

    expect(workspace).not.toContain("apps/serial");
    expect(workspace).not.toContain("apps/network");
    expect(workspace).not.toContain("apps/cups");
    expect(workspace).not.toContain("apps/winspool");
    expect(workspace).not.toContain("libs/core");

    expect(packageJson.dependencies).toMatchObject({
      "iconv-lite": expect.any(String),
      serialport  : expect.any(String)
    });
    expect(Object.keys(packageJson.dependencies ?? {})).not.toContain("#core");

    expect(existsSync(join(rootDir, "apps", "printer", "src", "core"))).toBe(true);
    expect(existsSync(join(rootDir, "apps", "printer", "src", "transports", "serial"))).toBe(true);
    expect(existsSync(join(rootDir, "apps", "printer", "src", "transports", "network"))).toBe(true);
    expect(existsSync(join(rootDir, "apps", "printer", "src", "transports", "cups"))).toBe(true);
    expect(existsSync(join(rootDir, "apps", "printer", "src", "transports", "winspool"))).toBe(true);

    expect(existsSync(join(rootDir, "apps", "serial", "package.json"))).toBe(false);
    expect(existsSync(join(rootDir, "apps", "network", "package.json"))).toBe(false);
    expect(existsSync(join(rootDir, "apps", "cups", "package.json"))).toBe(false);
    expect(existsSync(join(rootDir, "apps", "winspool", "package.json"))).toBe(false);
    expect(existsSync(join(rootDir, "libs", "core", "package.json"))).toBe(false);
  });

  it("uses method-style APIs from the test server", () => {
    const server = readFileSync(join(rootDir, "apps", "test-server", "server.mjs"), "utf8");

    expect(server).toContain("listPrinters");
    expect(server).toContain("print(");
    expect(server).not.toContain("createPrinter");
    expect(server).not.toContain("listSerialPorts");
    expect(server).not.toContain("listCupsPrinters");
    expect(server).not.toContain("listWinspoolPrinters");
  });
});
