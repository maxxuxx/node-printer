import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

describe("printer settings", () => {
  afterEach(async () => {
    vi.doUnmock("node:os");
    vi.resetModules();
    await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it("uses the user home fallback settings file when not configured", async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "node-printer-home-"));

    tempDirs.push(dir);
    vi.doMock("node:os", async () => ({
      ...(await vi.importActual("node:os")),
      homedir: () => dir
    }));

    const printer = await import("../src/index.js");
    const saved   = await printer.savePrinter({
      name    : "Serial",
      type    : "serial",
      path    : "COM3",
      baudRate: 9600,
      receipt : {
        encoding: "cp949",
        columns : 42
      }
    });

    await expect(printer.listSavedPrinters()).resolves.toEqual([saved]);

    const file = JSON.parse(await readFile(join(dir, ".node-printer", "printers.json"), "utf8")) as {
      printers: unknown[];
    };

    expect(file.printers).toEqual([saved]);
  });

  it("saves usb printers with a generated id and platform target", async () => {
    const { filePath, printer } = await loadConfiguredPrinterModule();
    const saved = await printer.savePrinter({
      name       : "Counter",
      type       : "usb",
      printerName: "Receipt",
      receipt    : {
        encoding: "cp949",
        columns : 42
      }
    });

    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(saved).toMatchObject({
      name   : "Counter",
      type   : "usb",
      receipt: {
        encoding: "cp949",
        columns : 42
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
        encoding: "cp949",
        columns : 32
      }
    });
    const network = await printer.savePrinter({
      name   : "Kitchen",
      type   : "network",
      host   : "192.168.0.50",
      port   : 9100,
      receipt: {
        encoding: "cp949",
        columns : 42
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

  it("updates a saved printer while keeping the id", async () => {
    const { filePath, printer } = await loadConfiguredPrinterModule();
    const saved = await printer.savePrinter({
      name    : "Serial",
      type    : "serial",
      path    : "COM3",
      baudRate: 9600,
      receipt : {
        encoding: "cp949",
        columns : 32
      }
    });

    const updated = await printer.updatePrinter(saved.id, {
      name   : "Kitchen",
      type   : "network",
      host   : "192.168.0.50",
      port   : 9100,
      receipt: {
        encoding: "cp949",
        columns : 42
      }
    });

    expect(updated).toEqual({
      id     : saved.id,
      name   : "Kitchen",
      type   : "network",
      target : {
        type: "network",
        host: "192.168.0.50",
        port: 9100
      },
      receipt: {
        encoding: "cp949",
        columns : 42
      }
    });
    await expect(printer.getSavedPrinter(saved.id)).resolves.toEqual(updated);
    await expect(printer.listSavedPrinters()).resolves.toEqual([updated]);

    const file = JSON.parse(await readFile(filePath, "utf8")) as { printers: unknown[] };

    expect(file.printers).toEqual([updated]);
  });

  it("throws when updating a missing printer", async () => {
    const { printer } = await loadConfiguredPrinterModule();

    await expect(printer.updatePrinter("missing", {
      name    : "Serial",
      type    : "serial",
      path    : "COM3",
      baudRate: 9600,
      receipt : {
        encoding: "cp949",
        columns : 42
      }
    })).rejects.toMatchObject({
      code   : "ERR_PRINTER_NOT_FOUND",
      message: "Saved printer was not found: missing"
    });
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
