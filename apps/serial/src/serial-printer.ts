import { execFile } from "node:child_process";
import { open as openFile, readdir, type FileHandle } from "node:fs/promises";
import { promisify } from "node:util";

import { PrinterError, type PrintResult, type SerialPrinterTarget } from "@node-printer/core";

import type {
  SerialOpenOptions,
  SerialPortConnection,
  SerialPortConstructor,
  SerialPortInfo,
  SerialPrinterDependencies
} from "./types.js";

const execFileAsync = promisify(execFile);

const DEFAULT_BAUD_RATE  = 9600;
const DEFAULT_DATA_BITS  = 8;
const DEFAULT_STOP_BITS  = 1;
const DEFAULT_PARITY     = "none";
const DEFAULT_TIMEOUT_MS = 5000;

const WINDOWS_PARITY = {
  none : "N",
  even : "E",
  odd  : "O",
  mark : "M",
  space: "S"
} satisfies Record<Required<SerialPrinterTarget>["parity"], string>;

type NormalizedSerialPrinterTarget = Required<SerialPrinterTarget>;

export async function listSerialPorts(
  dependencies: SerialPrinterDependencies = {}
): Promise<SerialPortInfo[]> {
  if (dependencies.listPorts) {
    return dependencies.listPorts();
  }

  const Constructor = dependencies.SerialPort ?? NodeSerialPort;

  return Constructor.list();
}

export function createSerialPrinter(
  target: SerialPrinterTarget,
  dependencies: SerialPrinterDependencies = {}
): SerialPrinterTransport {
  return new SerialPrinterTransport(target, dependencies.SerialPort ?? NodeSerialPort);
}

export class SerialPrinterTransport {
  readonly target: NormalizedSerialPrinterTarget;

  private port?: SerialPortConnection;
  private readonly SerialPort: SerialPortConstructor;

  constructor(target: SerialPrinterTarget, SerialPortConstructor: SerialPortConstructor = NodeSerialPort) {
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

  // 기존 열린 포트를 재사용하고 없으면 OS 직렬 장치를 직접 연다
  private async open(): Promise<SerialPortConnection> {
    // 같은 transport에서 연 포트가 살아 있으면 새 포트를 만들지 않는다
    if (this.port?.isOpen) {
      return this.port;
    }

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

class NodeSerialPort implements SerialPortConnection {
  static async list(): Promise<SerialPortInfo[]> {
    if (process.platform === "win32") {
      return listWindowsSerialPorts();
    }

    return listUnixSerialPorts();
  }

  isOpen = false;

  private file?: FileHandle;

  constructor(private readonly options: SerialOpenOptions) {}

  open(callback: (error?: Error | null) => void): void {
    this.openAsync()
      .then(() => callback())
      .catch((error) => callback(toError(error)));
  }

  write(data: Uint8Array, callback: (error?: Error | null) => void): void {
    if (!this.file || !this.isOpen) {
      callback(new Error("Serial port is not open"));
      return;
    }

    this.file.write(Buffer.from(data))
      .then(() => callback())
      .catch((error) => callback(toError(error)));
  }

  drain(callback: (error?: Error | null) => void): void {
    callback();
  }

  close(callback: (error?: Error | null) => void): void {
    this.closeAsync()
      .then(() => callback())
      .catch((error) => callback(toError(error)));
  }

  private async openAsync(): Promise<void> {
    if (this.isOpen) {
      return;
    }

    await configureSerialPort(this.options);

    this.file   = await openFile(toWritablePath(this.options.path), "w");
    this.isOpen = true;
  }

  private async closeAsync(): Promise<void> {
    const file = this.file;

    this.file   = undefined;
    this.isOpen = false;

    if (file) {
      await file.close();
    }
  }
}

// 호출자가 생략한 직렬 옵션을 기본값으로 채운다
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

// 정규화된 target을 직렬 장치 옵션으로 변환한다
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

// flowControl 값을 OS 설정에 쓰기 쉬운 플래그 조합으로 바꾼다
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

async function configureSerialPort(options: SerialOpenOptions): Promise<void> {
  if (process.platform === "win32") {
    await configureWindowsSerialPort(options);
    return;
  }

  await configureUnixSerialPort(options);
}

async function configureWindowsSerialPort(options: SerialOpenOptions): Promise<void> {
  const args = [
    toWindowsModePort(options.path),
    `BAUD=${options.baudRate}`,
    `PARITY=${WINDOWS_PARITY[options.parity]}`,
    `DATA=${options.dataBits}`,
    `STOP=${options.stopBits}`,
    ...windowsFlowControlArgs(options)
  ];

  await execFileAsync("mode.com", args);
}

async function configureUnixSerialPort(options: SerialOpenOptions): Promise<void> {
  const fileFlag = process.platform === "darwin" ? "-f" : "-F";
  const args     = [
    fileFlag,
    options.path,
    String(options.baudRate),
    `cs${options.dataBits}`,
    ...unixStopBitsArgs(options.stopBits),
    ...unixParityArgs(options.parity),
    ...unixFlowControlArgs(options)
  ];

  await execFileAsync("stty", args);
}

function windowsFlowControlArgs(options: SerialOpenOptions): string[] {
  if (options.rtscts) {
    return ["OCTS=ON", "RTS=HS"];
  }

  if (options.xon || options.xoff) {
    return ["XON=ON"];
  }

  return [];
}

function unixStopBitsArgs(stopBits: SerialOpenOptions["stopBits"]): string[] {
  if (stopBits === 2 || stopBits === 1.5) {
    return ["cstopb"];
  }

  return ["-cstopb"];
}

function unixParityArgs(parity: SerialOpenOptions["parity"]): string[] {
  if (parity === "none") {
    return ["-parenb"];
  }

  if (parity === "even") {
    return ["parenb", "-parodd"];
  }

  if (parity === "odd") {
    return ["parenb", "parodd"];
  }

  return ["parenb"];
}

function unixFlowControlArgs(options: SerialOpenOptions): string[] {
  const args: string[] = [];

  if (process.platform === "linux") {
    args.push(options.rtscts ? "crtscts" : "-crtscts");
  }

  if (options.xon) {
    args.push("ixon", "-ixoff");
  } else if (options.xoff) {
    args.push("-ixon", "ixoff");
  } else {
    args.push("-ixon", "-ixoff");
  }

  return args;
}

async function listWindowsSerialPorts(): Promise<SerialPortInfo[]> {
  try {
    const { stdout } = await execFileAsync("reg", [
      "query",
      "HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM"
    ]);

    return parseWindowsSerialPorts(stdout);
  } catch {
    return [];
  }
}

async function listUnixSerialPorts(): Promise<SerialPortInfo[]> {
  try {
    const entries = await readdir("/dev");

    return entries
      .filter(isUnixSerialDevice)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((entry) => ({ path: `/dev/${entry}` }));
  } catch {
    return [];
  }
}

function parseWindowsSerialPorts(stdout: string): SerialPortInfo[] {
  const ports = new Map<string, SerialPortInfo>();

  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/\b(COM\d+)\b/i);

    if (match?.[1]) {
      const path = match[1].toUpperCase();

      ports.set(path, { path });
    }
  }

  return [...ports.values()].sort((left, right) => compareComPorts(left.path, right.path));
}

function compareComPorts(left: string, right: string): number {
  return getComNumber(left) - getComNumber(right);
}

function getComNumber(path: string): number {
  return Number(path.match(/\d+/)?.[0] ?? 0);
}

function isUnixSerialDevice(entry: string): boolean {
  return (
    /^tty(S|USB|ACM|AMA)\d+$/u.test(entry) ||
    /^tty\.usb/u.test(entry) ||
    /^cu\.usb/u.test(entry) ||
    /^rfcomm\d+$/u.test(entry)
  );
}

function toWindowsModePort(path: string): string {
  const port = path.replace(/^\\\\\.\\/u, "").replace(/:$/u, "");

  return `${port.toUpperCase()}:`;
}

function toWritablePath(path: string): string {
  if (process.platform !== "win32") {
    return path;
  }

  if (/^\\\\\.\\/u.test(path)) {
    return path;
  }

  const port = path.replace(/:$/u, "");

  if (/^COM\d+$/iu.test(port)) {
    return `\\\\.\\${port.toUpperCase()}`;
  }

  return path;
}

// 직렬 포트 콜백 API를 timeout과 조합하기 쉬운 Promise로 감싼다
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

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
