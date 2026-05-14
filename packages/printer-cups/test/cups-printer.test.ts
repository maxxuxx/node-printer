import { describe, expect, it } from "vitest";

import { PrinterError } from "@node-printer/printer-core";

import {
  createCupsPrinter,
  listCupsPrinters,
  parseLpstatPrinters,
  printRaw
} from "../src/index.js";
import type { CupsCommandRequest, CupsCommandResult, CupsCommandRunner } from "../src/types.js";

describe("printer-cups", () => {
  it("parses lpstat printer output", () => {
    const printers = parseLpstatPrinters(`
printer Receipt_1 is idle.  enabled since Wed May 13 10:00:00 2026
printer Kitchen disabled since Wed May 13 10:00:00 2026
system default destination: Receipt_1
`);

    expect(printers).toEqual([
      {
        name     : "Receipt_1",
        isDefault: true,
        state    : "idle",
        raw      : "printer Receipt_1 is idle.  enabled since Wed May 13 10:00:00 2026"
      },
      {
        name     : "Kitchen",
        isDefault: false,
        state    : "disabled",
        raw      : "printer Kitchen disabled since Wed May 13 10:00:00 2026"
      }
    ]);
  });

  it("lists printers through lpstat", async () => {
    const runner   = new FakeRunner();
    runner.results = [
      {
        stdout  : "printer Receipt is idle. enabled since today\nsystem default destination: Receipt\n",
        stderr  : "",
        exitCode: 0,
        signal  : null
      }
    ];

    const printers = await listCupsPrinters({
      runner,
      platform: "darwin"
    });

    expect(printers).toEqual([
      {
        name     : "Receipt",
        isDefault: true,
        state    : "idle",
        raw      : "printer Receipt is idle. enabled since today"
      }
    ]);
    expect(runner.requests[0]).toMatchObject({
      command: "lpstat",
      args   : ["-p", "-d"]
    });
  });

  it("prints raw bytes with lp by default", async () => {
    const runner = new FakeRunner();
    const result = await printRaw(
      {
        type        : "cups",
        printerName : "Receipt",
        documentName: "Test receipt",
        timeoutMs   : 1000
      },
      Uint8Array.from([1, 2, 3]),
      {
        runner,
        platform: "linux"
      }
    );

    expect(result.bytesWritten).toBe(3);
    expect(runner.requests[0]).toMatchObject({
      command  : "lp",
      args     : ["-d", "Receipt", "-o", "raw", "-t", "Test receipt"],
      input    : Uint8Array.from([1, 2, 3]),
      timeoutMs: 1000
    });
  });

  it("can print raw bytes with lpr", async () => {
    const runner  = new FakeRunner();
    const printer = createCupsPrinter(
      {
        type       : "cups",
        printerName: "Receipt"
      },
      {
        runner,
        platform    : "linux",
        printCommand: "lpr"
      }
    );

    await printer.print(Uint8Array.from([4, 5, 6]));

    expect(runner.requests[0]).toMatchObject({
      command: "lpr",
      args   : ["-P", "Receipt", "-l"]
    });
  });

  it("rejects unsupported platforms", async () => {
    const printer = createCupsPrinter(
      {
        type       : "cups",
        printerName: "Receipt"
      },
      {
        runner  : new FakeRunner(),
        platform: "win32"
      }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code: "ERR_UNSUPPORTED_PLATFORM"
    });
  });

  it("includes stdout and stderr when commands fail", async () => {
    const runner   = new FakeRunner();
    runner.results = [
      {
        stdout  : "request failed",
        stderr  : "printer not found",
        exitCode: 1,
        signal  : null
      }
    ];

    const printer = createCupsPrinter(
      {
        type       : "cups",
        printerName: "Missing"
      },
      {
        runner,
        platform: "linux"
      }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code   : "ERR_CUPS_COMMAND_FAILED",
      message: "CUPS lp failed with exit code 1, stdout: request failed, stderr: printer not found"
    });
  });

  it("throws PrinterError when printerName is missing", () => {
    expect(() =>
      createCupsPrinter({
        type       : "cups",
        printerName: ""
      })
    ).toThrow(PrinterError);
  });
});

// 준비된 CUPS 명령 결과를 순서대로 반환해 성공과 실패 분기를 재현한다
class FakeRunner implements CupsCommandRunner {
  requests: CupsCommandRequest[] = [];
  results : CupsCommandResult[]  = [
    {
      stdout  : "request id is Receipt-42 (1 file(s))\n",
      stderr  : "",
      exitCode: 0,
      signal  : null
    }
  ];

  // 요청을 기록한 뒤 다음 결과를 소비해 command 흐름을 검증한다
  async run(request: CupsCommandRequest): Promise<CupsCommandResult> {
    this.requests.push(request);

    const result = this.results.shift();

    if (!result) {
      throw new Error("missing fake command result");
    }

    return result;
  }
}
