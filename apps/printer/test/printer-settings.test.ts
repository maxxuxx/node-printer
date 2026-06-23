import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

describe("printer settings", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it("requires a configured settings file before using saved printers", async () => {
    vi.resetModules();
    const { listSavedPrinters } = await import("../src/index.js");

    await expect(listSavedPrinters()).rejects.toMatchObject({
      code: "ERR_PRINTER_SETTINGS_NOT_CONFIGURED"
    });
  });

  it("saves usb printers with a generated id and platform target", async () => {
    const { filePath, printer } = await loadConfiguredPrinterModule();
    const saved = await printer.savePrinter({
      name       : "Counter",
      type       : "usb",
      printerName: "Receipt",
      receipt    : {
        encoding    : "cp949",
        paperWidth  : 80,
        charsPerLine: 48
      }
    });

    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(saved).toMatchObject({
      name   : "Counter",
      type   : "usb",
      receipt: {
        encoding    : "cp949",
        paperWidth  : 80,
        charsPerLine: 48
      }
    });
    expect(saved.target).toMatchObject(
      process.platform === "win32"
        ? { type: "winspool", printerName: "Receipt" }
        : { type: "cups", printerName: "Receipt" }
    );
    await expect(printer.getSavedPrinter(saved.id)).resolves.toEqual(saved);
    await expect(printer.listSavedPrinters()).resolves.toEqual([saved]);

    const file = JSON.parse(await readFile(filePath, "utf8")) as { printers: unknown[] };

    expect(file.printers).toEqual([saved]);
  });

  it("saves serial and network printers and can remove or clear them", async () => {
    const { printer } = await loadConfiguredPrinterModule();
    const serial = await printer.savePrinter({
      name    : "Serial",
      type    : "serial",
      path    : "COM3",
      baudRate: 9600,
      receipt : {
        encoding    : "cp949",
        paperWidth  : 58,
        charsPerLine: 32
      }
    });
    const network = await printer.savePrinter({
      name   : "Kitchen",
      type   : "network",
      host   : "192.168.0.50",
      port   : 9100,
      receipt: {
        encoding    : "cp949",
        paperWidth  : 80,
        charsPerLine: 48
      }
    });

    expect(serial.target).toMatchObject({ type: "serial", path: "COM3", baudRate: 9600 });
    expect(network.target).toMatchObject({ type: "network", host: "192.168.0.50", port: 9100 });
    await expect(printer.listSavedPrinters()).resolves.toEqual([serial, network]);

    await printer.removeSavedPrinter(serial.id);
    await expect(printer.getSavedPrinter(serial.id)).resolves.toBeUndefined();
    await expect(printer.listSavedPrinters()).resolves.toEqual([network]);

    await printer.clearSavedPrinters();
    await expect(printer.listSavedPrinters()).resolves.toEqual([]);
  });
});

// Test helpers

async function loadConfiguredPrinterModule() {
  vi.resetModules();
  const dir = await mkdtemp(join(tmpdir(), "node-printer-"));

  tempDirs.push(dir);

  const filePath = join(dir, "printers.json");
  const printer  = await import("../src/index.js");

  printer.configurePrinterSettings({ filePath });

  return { filePath, printer };
}
