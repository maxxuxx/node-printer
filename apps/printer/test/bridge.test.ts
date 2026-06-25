import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  configurePrinterSettings,
  createPrinterBridge,
  exposePrinterBridge,
  PRINTER_BRIDGE_NAME,
  type PrinterBridge,
  type PrinterBridgeContext,
  type SerialOpenOptions,
  type SerialPortConnection
} from "../src/index.js";

const tempDirs: string[] = [];

describe("printer bridge", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it("exposes the module bridge through an Electron-compatible contextBridge", async () => {
    const SerialPort = FakeSerialPort.withPorts([{ path: "COM3", manufacturer: "Test" }]);
    const exposed: Array<{ name: string; api: PrinterBridge }> = [];
    const contextBridge: PrinterBridgeContext = {
      exposeInMainWorld: (name, api) => {
        exposed.push({ name, api });
      }
    };

    exposePrinterBridge(contextBridge, { serial: { SerialPort } });

    expect(exposed[0]?.name).toBe(PRINTER_BRIDGE_NAME);
    await expect(exposed[0]?.api.listPrinters("serial")).resolves.toEqual([
      { path: "COM3", manufacturer: "Test" }
    ]);
  });

  it("prints array data through the bridge without redefining printer methods", async () => {
    const SerialPort = FakeSerialPort.withPorts([]);
    const bridge     = createPrinterBridge({ serial: { SerialPort } });
    const result     = await bridge.print(
      {
        type: "serial",
        path: "COM3"
      },
      [1, 2, 3]
    );

    expect(result.bytesWritten).toBe(3);
    expect(SerialPort.instances[0]?.written).toEqual([1, 2, 3]);
    expect(SerialPort.instances[0]?.closed).toBe(true);
  });

  it("exposes saved printer settings through the bridge object", async () => {
    await configureTempSettings();

    const bridge = createPrinterBridge();
    const saved  = await bridge.savePrinter({
      name    : "Counter",
      type    : "serial",
      path    : "COM3",
      baudRate: 9600,
      receipt : {
        encoding: "ascii",
        columns : 4
      }
    });

    await expect(bridge.getSavedPrinter(saved.id)).resolves.toEqual(saved);
    await expect(bridge.listSavedPrinters()).resolves.toEqual([saved]);

    await bridge.removeSavedPrinter(saved.id);
    await expect(bridge.listSavedPrinters()).resolves.toEqual([]);
  });

  it("builds one receipt command list and prints it for every saved printer and copy", async () => {
    await configureTempSettings();

    const SerialPort = FakeSerialPort.withPorts([]);
    const bridge     = createPrinterBridge({ serial: { SerialPort } });
    const counter    = await bridge.savePrinter({
      name    : "Counter",
      type    : "serial",
      path    : "COM3",
      baudRate: 9600,
      receipt : {
        encoding: "ascii",
        columns : 4
      }
    });
    const kitchen    = await bridge.savePrinter({
      name    : "Kitchen",
      type    : "serial",
      path    : "COM4",
      baudRate: 9600,
      receipt : {
        encoding: "ascii",
        columns : 6
      }
    });

    const results = await bridge
      .createReceipt([counter.id, kitchen.id])
      .divider()
      .print({ copies: 2 });

    expect(results.map(({ printerId, copy, result }) => ({
      printerId,
      copy,
      bytesWritten: result.bytesWritten
    }))).toEqual([
      { printerId: counter.id, copy: 1, bytesWritten: 5 },
      { printerId: counter.id, copy: 2, bytesWritten: 5 },
      { printerId: kitchen.id, copy: 1, bytesWritten: 7 },
      { printerId: kitchen.id, copy: 2, bytesWritten: 7 }
    ]);
    expect(
      FakeSerialPort.instances.map((instance) => ({
        path: instance.options.path,
        text: new TextDecoder().decode(Uint8Array.from(instance.written))
      }))
    ).toEqual([
      { path: "COM3", text: "----\n" },
      { path: "COM3", text: "----\n" },
      { path: "COM4", text: "------\n" },
      { path: "COM4", text: "------\n" }
    ]);
  });
});

// Test helpers

async function configureTempSettings(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "node-printer-bridge-"));

  tempDirs.push(dir);
  configurePrinterSettings({ filePath: join(dir, "printers.json") });
}

// Test doubles

class FakeSerialPort implements SerialPortConnection {
  static instances: FakeSerialPort[] = [];
  static ports: Array<{ path: string; manufacturer?: string }> = [];

  isOpen  = false;
  written : number[] = [];
  closed  = false;

  constructor(readonly options: SerialOpenOptions) {
    FakeSerialPort.instances.push(this);
  }

  static withPorts(ports: Array<{ path: string; manufacturer?: string }>): typeof FakeSerialPort {
    FakeSerialPort.instances = [];
    FakeSerialPort.ports     = ports;

    return FakeSerialPort;
  }

  static async list(): Promise<Array<{ path: string; manufacturer?: string }>> {
    return FakeSerialPort.ports;
  }

  open(callback: (error?: Error | null) => void): void {
    this.isOpen = true;
    callback();
  }

  write(data: Uint8Array, callback: (error?: Error | null) => void): void {
    this.written = Array.from(data);
    callback();
  }

  drain(callback: (error?: Error | null) => void): void {
    callback();
  }

  close(callback: (error?: Error | null) => void): void {
    this.isOpen = false;
    this.closed = true;
    callback();
  }
}
