import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import {
  PrinterError,
  createPrinter,
  createReceipt,
  type CupsCommandRequest,
  type CupsCommandResult,
  type CupsCommandRunner,
  type NetworkSocket,
  type SerialOpenOptions,
  type SerialPortConnection
} from "../src/index.js";

const describeNonWindows = process.platform === "win32" ? describe.skip : describe;

// 재내보내기 계약
describe("createReceipt", () => {
  it("re-exports createReceipt from printer-core", () => {
    const bytes = createReceipt({ encoding: "ascii" }).text("Hi").encode();

    expect(new TextDecoder().decode(bytes)).toBe("Hi\n");
  });
});

// 통합 프린터 팩토리 계약
describe("createPrinter", () => {
  it("creates a serial printer with injected dependencies", async () => {
    const SerialPort = FakeSerialPort.withPorts([]);
    const printer    = createPrinter(
      {
        type: "serial",
        path: "COM3"
      },
      {
        serial: { SerialPort }
      }
    );

    const result = await printer.print(Uint8Array.from([1, 2, 3]));

    expect(result.bytesWritten).toBe(3);
    expect(SerialPort.instances[0]?.written).toEqual([1, 2, 3]);
  });

  it("creates a network printer with injected dependencies", async () => {
    const sockets: FakeNetworkSocket[] = [];
    const printer = createPrinter(
      {
        type: "network",
        host: "192.168.0.50"
      },
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

    const result = await printer.print(Uint8Array.from([4, 5, 6]));

    expect(result.bytesWritten).toBe(3);
    expect(sockets[0]?.written).toEqual([4, 5, 6]);
  });

  it("creates a cups printer with injected dependencies", async () => {
    const runner  = new FakeCupsRunner();
    const printer = createPrinter(
      {
        type: "cups",
        printerName: "Receipt"
      },
      {
        cups: {
          runner,
          platform: "linux"
        }
      }
    );

    const result = await printer.print(Uint8Array.from([7, 8, 9]));

    expect(result.bytesWritten).toBe(3);
    expect(runner.requests[0]).toMatchObject({
      command: "lp",
      args   : ["-d", "Receipt", "-o", "raw"]
    });
  });
});

// Windows 전용 winspool은 비 Windows 환경에서 명시적으로 거부되는지 확인합니다
describeNonWindows("createPrinter winspool on non-Windows", () => {
  it("rejects winspool targets with unsupported platform", () => {
    expect(() =>
      createPrinter({
        type: "winspool",
        printerName: "Receipt"
      })
    ).toThrowError(PrinterError);
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
    callback();
  }
}

class FakeCupsRunner implements CupsCommandRunner {
  requests: CupsCommandRequest[] = [];

  // CUPS 테스트 대역은 요청을 기록하고 lp 성공 응답을 흉내냅니다
  async run(request: CupsCommandRequest): Promise<CupsCommandResult> {
    this.requests.push(request);

    return {
      stdout  : "request id is Receipt-1\n",
      stderr  : "",
      exitCode: 0,
      signal  : null
    };
  }
}
