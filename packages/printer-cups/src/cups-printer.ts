import { spawn } from "node:child_process";

import { PrinterError, type CupsPrinterTarget, type PrintResult } from "@maxxuxx/node-printer-core";

import type {
  CupsCommandRequest,
  CupsCommandResult,
  CupsCommandRunner,
  CupsPrintCommand,
  CupsPrinterDependencies,
  CupsPrinterInfo,
  CupsPrinterState
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_PRINT_COMMAND: CupsPrintCommand = "lp";

type NormalizedCupsPrinterTarget = CupsPrinterTarget & {
  timeoutMs: number;
};

// Public API

export async function listCupsPrinters(
  dependencies: CupsPrinterDependencies = {}
): Promise<CupsPrinterInfo[]> {
  const resolved = resolveDependencies(dependencies);

  assertSupportedPlatform(resolved.platform);

  // lpstat 출력을 실행한 뒤 CUPS 프린터 목록으로 파싱한다
  const result = await runCupsCommand(
    resolved.runner,
    {
      command  : "lpstat",
      args     : ["-p", "-d"],
      timeoutMs: resolved.defaultTimeoutMs
    },
    "lpstat"
  );

  return parseLpstatPrinters(result.stdout);
}

export function createCupsPrinter(
  target: CupsPrinterTarget,
  dependencies: CupsPrinterDependencies = {}
): CupsPrinterTransport {
  return new CupsPrinterTransport(target, dependencies);
}

export async function printRaw(
  target: CupsPrinterTarget,
  data: Uint8Array,
  dependencies: CupsPrinterDependencies = {}
): Promise<PrintResult> {
  return createCupsPrinter(target, dependencies).print(data);
}

export class CupsPrinterTransport {
  readonly target: NormalizedCupsPrinterTarget;

  private readonly dependencies: Required<CupsPrinterDependencies>;

  constructor(target: CupsPrinterTarget, dependencies: CupsPrinterDependencies = {}) {
    this.target       = normalizeTarget(target);
    this.dependencies = resolveDependencies(dependencies);
  }

  // 선택된 CUPS 명령에 raw payload를 stdin으로 넘겨 출력한다
  async print(data: Uint8Array): Promise<PrintResult> {
    const startedAt = Date.now();

    assertSupportedPlatform(this.dependencies.platform);

    const result = await runCupsCommand(
      this.dependencies.runner,
      {
        command  : this.dependencies.printCommand,
        args     : getPrintArgs(this.dependencies.printCommand, this.target),
        input    : data,
        timeoutMs: this.target.timeoutMs
      },
      this.dependencies.printCommand
    );

    return {
      ok          : true,
      target      : this.target,
      jobId       : parseJobId(result.stdout),
      bytesWritten: data.byteLength,
      durationMs  : Date.now() - startedAt
    };
  }
}

// Child process runner

const STDIN_CHUNK_SIZE = 64 * 1024;

export class NodeCupsCommandRunner implements CupsCommandRunner {
  // child process의 stdout stderr 종료 상태를 하나의 결과로 수집한다
  run(request: CupsCommandRequest): Promise<CupsCommandResult> {
    return new Promise((resolve, reject) => {
      const child        = spawn(request.command, request.args, { stdio: ["pipe", "pipe", "pipe"] });
      const stdoutChunks : Buffer[] = [];
      const stderrChunks : Buffer[] = [];
      let timedOut       = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, request.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      // child가 stdin을 닫고 깨지면 EPIPE가 그대로 올라오므로 한 곳에서 정리한다
      child.stdin.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.once("close", (exitCode, signal) => {
        clearTimeout(timeout);

        resolve({
          stdout  : Buffer.concat(stdoutChunks).toString("utf8"),
          stderr  : Buffer.concat(stderrChunks).toString("utf8"),
          exitCode,
          signal,
          timedOut
        });
      });

      // raw 출력 데이터가 있으면 backpressure를 지키며 청크 단위로 stdin에 흘려보낸다
      if (request.input) {
        writeStdinChunks(child.stdin, request.input).catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
        return;
      }

      child.stdin.end();
    });
  }
}

// stdin 버퍼가 가득 차면 drain까지 기다리고 마지막에 end를 호출해 EOF를 보낸다
function writeStdinChunks(stdin: NodeJS.WritableStream, input: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    let offset   = 0;

    const writeMore = (): void => {
      while (offset < buffer.byteLength) {
        const end   = Math.min(offset + STDIN_CHUNK_SIZE, buffer.byteLength);
        const chunk = buffer.subarray(offset, end);

        offset = end;

        // write가 false를 반환하면 OS 버퍼가 가득 찬 상태이므로 drain까지 기다린다
        if (!stdin.write(chunk)) {
          stdin.once("drain", writeMore);
          return;
        }
      }

      stdin.end(resolve);
    };

    stdin.once("error", reject);

    writeMore();
  });
}

// Parsing

// lpstat 출력에서 프린터 줄과 기본 프린터 표시를 분리해 합친다
export function parseLpstatPrinters(output: string): CupsPrinterInfo[] {
  const lines       = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const defaultName = findDefaultPrinterName(lines);

  return lines
    .map(parsePrinterLine)
    .filter((printer): printer is Omit<CupsPrinterInfo, "isDefault"> => Boolean(printer))
    .map((printer) => ({
      ...printer,
      isDefault: printer.name === defaultName
    }));
}

// lpstat 기본 프린터 라인을 찾아 이름만 추출한다
function findDefaultPrinterName(lines: string[]): string | undefined {
  for (const line of lines) {
    const match = /^system default destination:\s+(.+)$/i.exec(line);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

// printer로 시작하지 않는 lpstat 라인은 목록에서 제외한다
function parsePrinterLine(line: string): Omit<CupsPrinterInfo, "isDefault"> | undefined {
  const match = /^printer\s+(\S+)\s+(.+)$/i.exec(line);

  if (!match?.[1]) {
    return undefined;
  }

  return {
    name : match[1],
    state: parsePrinterState(line),
    raw  : line
  };
}

// lpstat 상태 문구의 포함 여부로 단순 상태값을 고른다
function parsePrinterState(line: string): CupsPrinterState {
  const normalized = line.toLowerCase();

  if (normalized.includes("disabled")) {
    return "disabled";
  }

  if (normalized.includes("now printing")) {
    return "printing";
  }

  if (normalized.includes("is idle")) {
    return "idle";
  }

  return "unknown";
}

// 명령 성공 메시지에서 가능한 작업 ID만 추출한다
function parseJobId(stdout: string): string | undefined {
  const match = /request id is\s+([^\s]+)/i.exec(stdout);

  return match?.[1];
}

// Command helpers

// lp와 lpr의 프린터 지정 옵션 차이를 여기서만 분기한다
function getPrintArgs(command: CupsPrintCommand, target: NormalizedCupsPrinterTarget): string[] {
  if (command === "lpr") {
    return [
      "-P",
      target.printerName,
      "-l",
      ...getLprDocumentArgs(target)
    ];
  }

  return [
    "-d",
    target.printerName,
    "-o",
    "raw",
    ...getLpDocumentArgs(target)
  ];
}

function getLpDocumentArgs(target: NormalizedCupsPrinterTarget): string[] {
  if (!target.documentName) {
    return [];
  }

  return ["-t", target.documentName];
}

function getLprDocumentArgs(target: NormalizedCupsPrinterTarget): string[] {
  if (!target.documentName) {
    return [];
  }

  return ["-T", target.documentName];
}

// runner 예외와 비정상 종료를 같은 CUPS 오류 체계로 통일한다
async function runCupsCommand(
  runner: CupsCommandRunner,
  request: CupsCommandRequest,
  label: string
): Promise<CupsCommandResult> {
  try {
    const result = await runner.run(request);

    assertCommandSucceeded(label, result, request.timeoutMs);

    return result;
  } catch (error) {
    throw normalizeCupsError(error, label);
  }
}

// timeout과 exit code 실패를 stdout stderr 포함 오류로 바꾼다
function assertCommandSucceeded(label: string, result: CupsCommandResult, timeoutMs: number): void {
  // timeout은 같은 명령을 다시 시도할 수 있게 retryable로 표시한다
  if (result.timedOut) {
    throw new PrinterError({
      code     : "ERR_CUPS_COMMAND_FAILED",
      message  : `CUPS ${label} timed out after ${timeoutMs}ms${formatCommandOutput(result)}`,
      cause    : result,
      retryable: true
    });
  }

  // 종료 코드 실패는 명령이 응답한 실패라 기본적으로 재시도 표시를 하지 않는다
  if (result.exitCode !== 0) {
    throw new PrinterError({
      code   : "ERR_CUPS_COMMAND_FAILED",
      message: `CUPS ${label} failed with exit code ${result.exitCode}${formatCommandOutput(result)}`,
      cause  : result
    });
  }
}

// 명령 실패 메시지에는 비어 있지 않은 stdout stderr만 덧붙인다
function formatCommandOutput(result: CupsCommandResult): string {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  const parts  = [
    stdout ? `stdout: ${stdout}` : "",
    stderr ? `stderr: ${stderr}` : ""
  ].filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return `, ${parts.join(", ")}`;
}

// Validation and errors

// CUPS 대상 타입과 프린터 이름을 검증한 뒤 timeout 기본값을 채운다
function normalizeTarget(target: CupsPrinterTarget): NormalizedCupsPrinterTarget {
  if (target.type !== "cups") {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: `CUPS target type must be cups, received ${target.type}`
    });
  }

  if (!target.printerName) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "CUPS printerName is required"
    });
  }

  return {
    ...target,
    timeoutMs: target.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };
}

function resolveDependencies(dependencies: CupsPrinterDependencies): Required<CupsPrinterDependencies> {
  return {
    runner          : dependencies.runner ?? new NodeCupsCommandRunner(),
    platform        : dependencies.platform ?? process.platform,
    printCommand    : dependencies.printCommand ?? DEFAULT_PRINT_COMMAND,
    defaultTimeoutMs: dependencies.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS
  };
}

// CUPS 명령이 있는 macOS와 Linux만 허용한다
function assertSupportedPlatform(platform: NodeJS.Platform): void {
  if (platform === "darwin" || platform === "linux") {
    return;
  }

  throw new PrinterError({
    code   : "ERR_UNSUPPORTED_PLATFORM",
    message: `CUPS printers are supported only on macOS and Linux, current platform is ${platform}`
  });
}

// 알 수 없는 runner 예외를 CUPS PrinterError로 감싼다
function normalizeCupsError(error: unknown, label: string): PrinterError {
  // 이미 정규화된 오류는 code와 retryable 값을 그대로 보존한다
  if (error instanceof PrinterError) {
    return error;
  }

  const causeMessage = getCauseMessage(error);
  const message      = causeMessage
    ? `CUPS ${label} failed: ${causeMessage}`
    : `CUPS ${label} failed`;

  return new PrinterError({
    code : "ERR_CUPS_COMMAND_FAILED",
    message,
    cause: error
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
