import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import * as printerApi from "../src/index.js";
import {
  createReceipt,
  type CupsCommandRequest,
  type CupsCommandResult,
  type CupsCommandRunner,
  type CupsPrinterDependencies,
  type CupsPrinterInfo,
  type NetworkPrinterDependencies,
  type NetworkSocket,
  type PrinterTarget,
  type PrintResult,
  type SerialOpenOptions,
  type SerialPortConnection,
  type SerialPrinterDependencies,
  type SerialPortInfo,
  type WinspoolBinding,
  type WinspoolPrinterInfo
} from "../src/index.js";

const itWindows    = process.platform === "win32" ? it : it.skip;
const itNonWindows = process.platform === "win32" ? it.skip : it;

type PrinterApi = typeof printerApi & {
  print(
    target: PrinterTarget,
    data: Uint8Array,
    options?: PrinterMethodOptions
  ): Promise<PrintResult>;
  listPrinters(
    type: ListPrinterType,
    options?: PrinterMethodOptions
  ): Promise<SerialPortInfo[] | CupsPrinterInfo[] | WinspoolPrinterInfo[]>;
};

interface PrinterMethodOptions {
  cups    ?: CupsPrinterDependencies;
  network ?: NetworkPrinterDependencies;
  serial  ?: SerialPrinterDependencies;
  winspool?: WinspoolBinding;
}

type ListPrinterType = "serial" | "cups" | "winspool";

const api = printerApi as PrinterApi;

// 재내보내기 계약
describe("public API", () => {
  it("exports method-style APIs and hides transport factories", () => {
    const exports = printerApi as Record<string, unknown>;

    expect(exports.print).toBeTypeOf("function");
    expect(exports.listPrinters).toBeTypeOf("function");
    expect(exports.createReceipt).toBeTypeOf("function");
    expect(exports.createPrinter).toBeUndefined();
    expect(exports.createSerialPrinter).toBeUndefined();
    expect(exports.createNetworkPrinter).toBeUndefined();
    expect(exports.createCupsPrinter).toBeUndefined();
    expect(exports.createWinspoolPrinter).toBeUndefined();
    expect(exports.printCupsRaw).toBeUndefined();
    expect(exports.printWinspoolRaw).toBeUndefined();
    expect(exports.listSerialPorts).toBeUndefined();
    expect(exports.listCupsPrinters).toBeUndefined();
    expect(exports.listWinspoolPrinters).toBeUndefined();
    expect(exports.getDefaultWinspoolPrinter).toBeUndefined();
  });

  it("re-exports createReceipt from printer-core", () => {
    const bytes = createReceipt({ encoding: "ascii" }).text("Hi").encode();

    expect(new TextDecoder().decode(bytes)).toBe("Hi\n");
  });
});

// 통합 출력 메서드 계약
describe("print", () => {
  it("prints serial targets through injected serialport and closes after one-shot print", async () => {
    const SerialPort = FakeSerialPort.withPorts([]);
    const result     = await api.print(
      {
        type: "serial",
        path: "COM3"
      },
      Uint8Array.from([1, 2, 3]),
      {
        serial: { SerialPort }
      }
    );

    expect(result.bytesWritten).toBe(3);
    expect(SerialPort.instances[0]?.written).toEqual([1, 2, 3]);
    expect(SerialPort.instances[0]?.closed).toBe(true);
  });

  it("prints network targets through injected dependencies", async () => {
    const sockets: FakeNetworkSocket[] = [];
    const result = await api.print(
      {
        type: "network",
        host: "192.168.0.50"
      },
      Uint8Array.from([4, 5, 6]),
      {
        network: {
          createConnection: () => {
            const socket = new FakeNetworkSocket();

            sockets.push(socket);

            return socket;
          }
        }
      }
    );

    expect(result.bytesWritten).toBe(3);
    expect(sockets[0]?.written).toEqual([4, 5, 6]);
  });

  it("prints cups targets through injected dependencies", async () => {
    const runner = new FakeCupsRunner();
    const result = await api.print(
      {
        type: "cups",
        printerName: "Receipt"
      },
      Uint8Array.from([7, 8, 9]),
      {
        cups: {
          runner,
          platform: "linux"
        }
      }
    );

    expect(result.bytesWritten).toBe(3);
    expect(runner.requests[0]).toMatchObject({
      command: "lp",
      args   : ["-d", "Receipt", "-o", "raw"]
    });
  });

  itWindows("prints winspool targets through injected native binding", async () => {
    const binding = new FakeWinspoolBinding();
    const result  = await api.print(
      {
        type: "winspool",
        printerName: "Receipt"
      },
      Uint8Array.from([10, 11]),
      {
        winspool: binding
      }
    );

    expect(result.bytesWritten).toBe(2);
    expect(binding.prints[0]).toMatchObject({
      printerName: "Receipt",
      data       : Uint8Array.from([10, 11])
    });
  });

  itNonWindows("rejects winspool targets on non-Windows", async () => {
    await expect(
      api.print(
        {
          type: "winspool",
          printerName: "Receipt"
        },
        Uint8Array.from([1])
      )
    ).rejects.toMatchObject({
      code: "ERR_UNSUPPORTED_PLATFORM"
    });
  });

  it("rejects unknown target types", async () => {
    await expect(
      api.print(
        {
          type: "bluetooth"
        } as unknown as PrinterTarget,
        Uint8Array.from([1])
      )
    ).rejects.toMatchObject({
      code: "ERR_INVALID_TARGET"
    });
  });
});

// 통합 조회 메서드 계약
describe("listPrinters", () => {
  it("lists serial printers through injected serialport", async () => {
    const SerialPort = FakeSerialPort.withPorts([{ path: "COM3", manufacturer: "Test" }]);

    await expect(api.listPrinters("serial", { serial: { SerialPort } })).resolves.toEqual([
      { path: "COM3", manufacturer: "Test" }
    ]);
  });

  it("lists cups printers through injected dependencies", async () => {
    const runner = new FakeCupsRunner(
      "printer Receipt is idle.  enabled since today\nsystem default destination: Receipt\n"
    );

    await expect(
      api.listPrinters("cups", {
        cups: {
          runner,
          platform: "linux"
        }
      })
    ).resolves.toEqual([
      {
        name     : "Receipt",
        state    : "idle",
        raw      : "printer Receipt is idle.  enabled since today",
        isDefault: true
      }
    ]);
  });

  itWindows("lists winspool printers through injected native binding", async () => {
    const binding = new FakeWinspoolBinding();

    await expect(api.listPrinters("winspool", { winspool: binding })).resolves.toEqual([
      {
        name     : "Receipt",
        isDefault: true
      }
    ]);
  });

  it("lists network printers through injected scanner", async () => {
    await expect(
      api.listPrinters("network" as unknown as ListPrinterType, {
        network: {
          discoveryHosts: ["192.168.0.22"],
          isPortOpen    : async () => true
        }
      })
    ).resolves.toEqual([
      {
        host: "192.168.0.22",
        port: 9100
      }
    ]);
  });
});

// 테스트 대역
class FakeNetworkSocket extends EventEmitter implements NetworkSocket {
  destroyed = false;
  written   : number[] = [];

  constructor() {
    super();

    // 네트워크 테스트 대역은 생성 직후 connect 이벤트를 비동기로 흘립니다
    queueMicrotask(() => {
      this.emit("connect");
    });
  }

  write(data: Uint8Array, callback: (error?: Error | null) => void): boolean {
    this.written.push(...data);

    queueMicrotask(() => {
      callback();
    });

    return true;
  }

  end(): this {
    return this;
  }

  destroy(): this {
    this.destroyed = true;

    return this;
  }
}

class FakeSerialPort implements SerialPortConnection {
  static instances: FakeSerialPort[] = [];
  static ports: Array<{ path: string; manufacturer?: string }> = [];

  isOpen = false;
  written: number[] = [];
  closed = false;

  constructor(readonly options: SerialOpenOptions) {
    FakeSerialPort.instances.push(this);
  }

  // 테스트마다 포트 목록과 생성 인스턴스를 초기화합니다
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

class FakeCupsRunner implements CupsCommandRunner {
  requests: CupsCommandRequest[] = [];

  constructor(private readonly listOutput = "") {}

  // CUPS 테스트 대역은 요청을 기록하고 명령별 성공 응답을 흉내냅니다
  async run(request: CupsCommandRequest): Promise<CupsCommandResult> {
    this.requests.push(request);

    return {
      stdout  : request.command === "lpstat" ? this.listOutput : "request id is Receipt-1\n",
      stderr  : "",
      exitCode: 0,
      signal  : null
    };
  }
}

class FakeWinspoolBinding implements WinspoolBinding {
  prints: Array<{ printerName: string; data: Uint8Array; documentName?: string }> = [];

  async listPrinters(): Promise<Array<{ name: string }>> {
    return [{ name: "Receipt" }];
  }

  async getDefaultPrinter(): Promise<string | null> {
    return "Receipt";
  }

  async printRaw(options: { printerName: string; data: Uint8Array; documentName?: string }): Promise<{
    jobId       ?: number;
    bytesWritten: number;
  }> {
    this.prints.push(options);

    return {
      jobId       : 1,
      bytesWritten: options.data.byteLength
    };
  }
}
