import { describe, expect, it } from "vitest";

import { PrinterError } from "@maxxuxx/node-printer-core";

import { createSerialPrinter, listSerialPorts } from "../src/index.js";
import type { SerialOpenOptions, SerialPortConnection } from "../src/types.js";

describe("printer-serial", () => {
  it("lists serial ports through the injected binding", async () => {
    const ports = await listSerialPorts({
      SerialPort: FakeSerialPort.withPorts([{ path: "COM3", manufacturer: "Test" }])
    });

    expect(ports).toEqual([{ path: "COM3", manufacturer: "Test" }]);
  });

  it("opens, writes, drains, and closes a serial port", async () => {
    const SerialPort = FakeSerialPort.withPorts([]);
    const printer    = createSerialPrinter(
      {
        type: "serial",
        path: "COM3",
        baudRate: 19200,
        flowControl: "rtscts"
      },
      { SerialPort }
    );

    const data   = Uint8Array.from([0x00, 0x1b, 0x1d, 0x0a, 0xff]);
    const result = await printer.print(data);
    await printer.close();

    expect(result.bytesWritten).toBe(data.byteLength);
    expect(SerialPort.instances[0]?.options).toMatchObject({
      path: "COM3",
      baudRate: 19200,
      autoOpen: false,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      rtscts: true
    });
    expect(SerialPort.instances[0]?.written).toEqual([0x00, 0x1b, 0x1d, 0x0a, 0xff]);
    expect(SerialPort.instances[0]?.closed).toBe(true);
  });

  it("throws PrinterError when path is missing", () => {
    expect(() =>
      createSerialPrinter({
        type: "serial",
        path: ""
      })
    ).toThrow(PrinterError);
  });

  it("normalizes open errors", async () => {
    const SerialPort = FakeSerialPort.withPorts([]);
    SerialPort.nextOpenError = new Error("access denied");

    const printer = createSerialPrinter(
      {
        type: "serial",
        path: "COM3"
      },
      { SerialPort }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code: "ERR_SERIAL_OPEN_FAILED",
      message: "Serial open failed: access denied",
      retryable: true
    });
  });

  it("normalizes write errors", async () => {
    const SerialPort = FakeSerialPort.withPorts([]);
    SerialPort.nextWriteError = new Error("write failed");

    const printer = createSerialPrinter(
      {
        type: "serial",
        path: "COM3"
      },
      { SerialPort }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code: "ERR_SERIAL_WRITE_FAILED",
      message: "Serial write failed: write failed",
      retryable: false
    });
  });

  it("normalizes drain errors", async () => {
    const SerialPort = FakeSerialPort.withPorts([]);
    SerialPort.nextDrainError = new Error("drain failed");

    const printer = createSerialPrinter(
      {
        type: "serial",
        path: "COM3"
      },
      { SerialPort }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code: "ERR_SERIAL_WRITE_FAILED",
      message: "Serial drain failed: drain failed",
      retryable: false
    });
  });

  it("normalizes close errors", async () => {
    const SerialPort = FakeSerialPort.withPorts([]);
    SerialPort.nextCloseError = new Error("close failed");

    const printer = createSerialPrinter(
      {
        type: "serial",
        path: "COM3"
      },
      { SerialPort }
    );

    await printer.print(Uint8Array.from([1]));

    await expect(printer.close()).rejects.toMatchObject({
      code: "ERR_SERIAL_WRITE_FAILED",
      message: "Serial close failed: close failed",
      retryable: false
    });
  });
});

// serialport 바인딩을 흉내 내 open write drain close 실패를 주입한다
class FakeSerialPort implements SerialPortConnection {
  static instances: FakeSerialPort[] = [];
  static ports: Array<{ path: string; manufacturer?: string }> = [];
  static nextOpenError?: Error;
  static nextWriteError?: Error;
  static nextDrainError?: Error;
  static nextCloseError?: Error;

  isOpen = false;
  written: number[] = [];
  closed = false;

  constructor(readonly options: SerialOpenOptions) {
    FakeSerialPort.instances.push(this);
  }

  // 테스트 간 공유 상태와 다음 오류 주입 값을 초기화한다
  static withPorts(ports: Array<{ path: string; manufacturer?: string }>): typeof FakeSerialPort {
    FakeSerialPort.instances      = [];
    FakeSerialPort.ports          = ports;
    FakeSerialPort.nextOpenError  = undefined;
    FakeSerialPort.nextWriteError = undefined;
    FakeSerialPort.nextDrainError = undefined;
    FakeSerialPort.nextCloseError = undefined;

    return FakeSerialPort;
  }

  static async list(): Promise<Array<{ path: string; manufacturer?: string }>> {
    return FakeSerialPort.ports;
  }

  // open 오류가 주입되면 성공 상태로 바꾸지 않고 콜백 오류를 반환한다
  open(callback: (error?: Error | null) => void): void {
    if (FakeSerialPort.nextOpenError) {
      callback(FakeSerialPort.nextOpenError);
      return;
    }

    this.isOpen = true;
    callback();
  }

  // write 오류가 주입되면 written 기록 없이 콜백 오류를 반환한다
  write(data: Uint8Array, callback: (error?: Error | null) => void): void {
    if (FakeSerialPort.nextWriteError) {
      callback(FakeSerialPort.nextWriteError);
      return;
    }

    this.written = Array.from(data);
    callback();
  }

  // drain 오류가 주입되면 write 이후 실패 분기를 재현한다
  drain(callback: (error?: Error | null) => void): void {
    if (FakeSerialPort.nextDrainError) {
      callback(FakeSerialPort.nextDrainError);
      return;
    }

    callback();
  }

  // close 오류가 주입되면 열린 상태를 유지한 채 콜백 오류를 반환한다
  close(callback: (error?: Error | null) => void): void {
    if (FakeSerialPort.nextCloseError) {
      callback(FakeSerialPort.nextCloseError);
      return;
    }

    this.isOpen = false;
    this.closed = true;
    callback();
  }
}
