import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PrinterError } from "#core";

import {
  createWinspoolPrinter,
  getDefaultWinspoolPrinter,
  listWinspoolPrinters,
  printRaw,
  resolveWinspoolPackageRoot
} from "../../src/transports/winspool/index.js";

// Windows가 아닌 환경에서만 platform guard 동작을 검증함
const describeNonWindows = process.platform === "win32" ? describe.skip : describe;
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("printer-winspool package root", () => {
  it("resolves source and dist paths to the printer package root", () => {
    expect(resolveWinspoolPackageRoot(join(packageRoot, "src", "transports", "winspool")))
      .toBe(packageRoot);
    expect(resolveWinspoolPackageRoot(join(packageRoot, "dist")))
      .toBe(packageRoot);
  });

  it("resolves the installed package root when winspool code is bundled elsewhere", () => {
    const bundledOutputDir      = resolve(packageRoot, "..", "..", "electron-app", "out", "main");
    const installedPackageEntry = resolve(packageRoot, "dist", "index.cjs");

    expect(
      resolveWinspoolPackageRoot(bundledOutputDir, () => installedPackageEntry)
    ).toBe(packageRoot);
  });
});

describeNonWindows("printer-winspool on non-Windows", () => {
  it("rejects printer listing with ERR_UNSUPPORTED_PLATFORM", async () => {
    await expect(listWinspoolPrinters()).rejects.toMatchObject({
      code: "ERR_UNSUPPORTED_PLATFORM",
      message: "Winspool printing is only supported on Windows"
    });
  });

  it("rejects default printer lookup with ERR_UNSUPPORTED_PLATFORM", async () => {
    await expect(getDefaultWinspoolPrinter()).rejects.toBeInstanceOf(PrinterError);
  });

  it("rejects raw printing with ERR_UNSUPPORTED_PLATFORM", async () => {
    await expect(
      printRaw({
        printerName: "Test Printer",
        data       : Uint8Array.from([1])
      })
    ).rejects.toMatchObject({
      code: "ERR_UNSUPPORTED_PLATFORM"
    });
  });

  it("rejects transport creation with ERR_UNSUPPORTED_PLATFORM", () => {
    expect(() =>
      createWinspoolPrinter({
        type       : "winspool",
        printerName: "Test Printer"
      })
    ).toThrow(PrinterError);
  });
});
