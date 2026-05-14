import { PrinterError, type PrintResult, type SerialPrinterTarget } from "@node-printer/printer-core";

import type {
  SerialOpenOptions,
  SerialPortConnection,
  SerialPortConstructor,
  SerialPortInfo,
  SerialPrinterDependencies
} from "./types.js";

const DEFAULT_BAUD_RATE  = 9600;
const DEFAULT_DATA_BITS  = 8;
const DEFAULT_STOP_BITS  = 1;
const DEFAULT_PARITY     = "none";
const DEFAULT_TIMEOUT_MS = 5000;

type NormalizedSerialPrinterTarget = Required<SerialPrinterTarget>;

// serialport native 모듈은 import 시점이 아니라 첫 사용 시점에만 동적 로드합니다
let cachedSerialPortConstructor: SerialPortConstructor | undefined;

// 비-Windows 환경에서도 @node-printer/printer를 import할 때 serialport native가 끌려오지 않도록 함
async function loadDefaultSerialPort(): Promise<SerialPortConstructor> {
  if (cachedSerialPortConstructor) {
    return cachedSerialPortConstructor;
  }

  try {
    const moduleExports = await import("serialport");
    const Constructor   = (moduleExports as { SerialPort?: SerialPortConstructor }).SerialPort;

    if (!Constructor) {
      throw new Error("serialport module does not export SerialPort");
    }

    cachedSerialPortConstructor = Constructor;

    return Constructor;
  } catch (error) {
    throw new PrinterError({
      code   : "ERR_NATIVE_MODULE_UNAVAILABLE",
      message: "serialport module is not available, install serialport to use serial transport",
      cause  : error
    });
  }
}

export async function listSerialPorts(
  dependencies: SerialPrinterDependencies = {}
): Promise<SerialPortInfo[]> {
  const Constructor = dependencies.SerialPort ?? await loadDefaultSerialPort();

  return Constructor.list();
}

export function createSerialPrinter(
  target: SerialPrinterTarget,
  dependencies: SerialPrinterDependencies = {}
): SerialPrinterTransport {
  return new SerialPrinterTransport(target, dependencies.SerialPort);
}

export class SerialPrinterTransport {
  readonly target: NormalizedSerialPrinterTarget;

  private port?: SerialPortConnection;
  private SerialPort?: SerialPortConstructor;

  constructor(target: SerialPrinterTarget, SerialPortConstructor?: SerialPortConstructor) {
    this.target     = normalizeTarget(target);
    this.SerialPort = SerialPortConstructor;
  }

  // 직렬 포트를 열고 write와 drain이 모두 끝나야 출력 성공으로 본다
  async print(data: Uint8Array): Promise<PrintResult> {
    const startedAt = Date.now();
    const port      = await this.open();

    try {
      await withTimeout(
        callbackToPromise((done) => port.write(data, done)),
        this.target.timeoutMs,
        "write"
      );
      await withTimeout(
        callbackToPromise((done) => port.drain(done)),
        this.target.timeoutMs,
        "drain"
      ).catch((error) => {
        // drain 실패는 write 이후 전송 실패로 별도 정규화한다
        throw normalizeSerialError(error, "drain");
      });

      return {
        ok          : true,
        target      : this.target,
        bytesWritten: data.byteLength,
        durationMs  : Date.now() - startedAt
      };
    } catch (error) {
      throw normalizeSerialError(error, "write");
    }
  }

  // 열린 포트가 있을 때만 close 콜백을 기다린다
  async close(): Promise<void> {
    const port = this.port;

    // 이미 닫힌 포트는 내부 참조만 비우고 종료한다
    if (!port || port.isOpen === false) {
      this.port = undefined;
      return;
    }

    try {
      await withTimeout(
        callbackToPromise((done) => port.close(done)),
        this.target.timeoutMs,
        "close"
      );
    } catch (error) {
      throw normalizeSerialError(error, "close");
    }

    this.port = undefined;
  }

  // 기존 열린 포트를 재사용하고 없으면 autoOpen false 포트를 직접 연다
  private async open(): Promise<SerialPortConnection> {
    // 같은 transport에서 연 포트가 살아 있으면 새 포트를 만들지 않는다
    if (this.port?.isOpen) {
      return this.port;
    }

    // 미주입 SerialPort는 첫 open 시점에만 native 모듈을 동적 로드함
    this.SerialPort ??= await loadDefaultSerialPort();

    const port = new this.SerialPort(toOpenOptions(this.target));

    try {
      await withTimeout(
        callbackToPromise((done) => port.open(done)),
        this.target.timeoutMs,
        "open"
      );
    } catch (error) {
      throw normalizeSerialError(error, "open");
    }

    this.port = port;

    return port;
  }
}

// 호출자가 생략한 직렬 옵션을 serialport 기본 입력 형태로 채운다
function normalizeTarget(target: SerialPrinterTarget): Required<SerialPrinterTarget> {
  if (!target.path) {
    throw new PrinterError({
      code: "ERR_INVALID_TARGET",
      message: "Serial printer path is required"
    });
  }

  return {
    type       : "serial",
    path       : target.path,
    baudRate   : target.baudRate ?? DEFAULT_BAUD_RATE,
    dataBits   : target.dataBits ?? DEFAULT_DATA_BITS,
    stopBits   : target.stopBits ?? DEFAULT_STOP_BITS,
    parity     : target.parity ?? DEFAULT_PARITY,
    flowControl: target.flowControl ?? false,
    timeoutMs  : target.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };
}

// 정규화된 target을 serialport 생성자 옵션으로 변환한다
function toOpenOptions(target: Required<SerialPrinterTarget>): SerialOpenOptions {
  return {
    path    : target.path,
    baudRate: target.baudRate,
    autoOpen: false,
    dataBits: target.dataBits,
    stopBits: target.stopBits,
    parity  : target.parity,
    ...flowControlOptions(target.flowControl)
  };
}

// flowControl 값을 serialport가 요구하는 플래그 조합으로 바꾼다
function flowControlOptions(flowControl: Required<SerialPrinterTarget>["flowControl"]): {
  rtscts?: boolean;
  xon?: boolean;
  xoff?: boolean;
} {
  // true는 기존 호환성을 위해 rtscts와 같은 의미로 처리한다
  if (flowControl === true || flowControl === "rtscts") {
    return { rtscts: true };
  }

  if (flowControl === "xon") {
    return { xon: true };
  }

  if (flowControl === "xoff") {
    return { xoff: true };
  }

  return {};
}

// serialport 콜백 API를 timeout과 조합하기 쉬운 Promise로 감싼다
function callbackToPromise(run: (done: (error?: Error | null) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    run((error) => {
      // 콜백 오류는 원인 보존을 위해 그대로 reject한다
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

// 작업별 timeout PrinterError를 만들어 실제 작업 Promise와 경합시킨다
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new PrinterError({
          code: "ERR_SERIAL_TIMEOUT",
          message: `Serial ${operation} timed out after ${timeoutMs}ms`,
          retryable: operation !== "write"
        })
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

type SerialOperation = "open" | "write" | "drain" | "close";

// open만 재시도 가능하도록 직렬 오류를 PrinterError로 통일한다
function normalizeSerialError(error: unknown, operation: SerialOperation): PrinterError {
  // 이미 정규화된 오류는 code와 retryable 값을 그대로 보존한다
  if (error instanceof PrinterError) {
    return error;
  }

  const causeMessage = getCauseMessage(error);
  const message      = causeMessage
    ? `Serial ${operation} failed: ${causeMessage}`
    : `Serial ${operation} failed`;

  // open 외 단계는 기존 오류 코드 체계상 write 실패로 묶는다
  return new PrinterError({
    code     : operation === "open" ? "ERR_SERIAL_OPEN_FAILED" : "ERR_SERIAL_WRITE_FAILED",
    message,
    cause    : error,
    retryable: operation === "open"
  });
}

// 알 수 없는 throw 값을 오류 메시지에 붙일 문자열로 변환한다
function getCauseMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
