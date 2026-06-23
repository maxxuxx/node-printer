import { describe, expect, it } from "vitest";

import {
  listPrinters,
  type CupsCommandRequest,
  type CupsCommandResult,
  type CupsCommandRunner,
  type WinspoolBinding
} from "../src/index.js";

describe("listPrinters discovery types", () => {
  it("lists usb printers through the platform spooler", async () => {
    if (process.platform === "win32") {
      await expect(
        listPrinters("usb" as never, { winspool: new FakeWinspoolBinding() })
      ).resolves.toEqual([
        {
          name     : "Receipt",
          isDefault: true
        }
      ]);

      return;
    }

    const runner = new FakeCupsRunner(
      "printer Receipt is idle. enabled since today\nsystem default destination: Receipt\n"
    );

    await expect(
      listPrinters("usb" as never, {
        cups: {
          runner,
          platform: process.platform
        }
      })
    ).resolves.toEqual([
      {
        name     : "Receipt",
        isDefault: true,
        state    : "idle",
        raw      : "printer Receipt is idle. enabled since today"
      }
    ]);
  });

  it("lists network printers by scanning IP hosts", async () => {
    const checkedHosts: string[] = [];

    await expect(
      listPrinters("network" as never, {
        network: {
          discoveryConcurrency: 1,
          discoveryHosts      : ["192.168.0.10", "192.168.0.11"],
          discoveryPort       : 9100,
          discoveryTimeoutMs  : 25,
          isPortOpen          : async (host, port, timeoutMs) => {
            checkedHosts.push(`${host}:${port}:${timeoutMs}`);

            return host === "192.168.0.11";
          }
        }
      })
    ).resolves.toEqual([
      {
        host: "192.168.0.11",
        port: 9100
      }
    ]);

    expect(checkedHosts).toEqual([
      "192.168.0.10:9100:25",
      "192.168.0.11:9100:25"
    ]);
  });
});

// Test doubles

class FakeCupsRunner implements CupsCommandRunner {
  readonly requests: CupsCommandRequest[] = [];

  constructor(private readonly stdout: string) {}

  async run(request: CupsCommandRequest): Promise<CupsCommandResult> {
    this.requests.push(request);

    return {
      stdout  : this.stdout,
      stderr  : "",
      exitCode: 0,
      signal  : null
    };
  }
}

class FakeWinspoolBinding implements WinspoolBinding {
  async listPrinters(): Promise<Array<{ name: string }>> {
    return [{ name: "Receipt" }];
  }

  async getDefaultPrinter(): Promise<string> {
    return "Receipt";
  }

  async printRaw(): Promise<{ bytesWritten: number }> {
    return { bytesWritten: 0 };
  }
}
