import net from "node:net";

import { PrinterError, type NetworkPrinterTarget, type PrintResult } from "@node-printer/core";

import type {
  NetworkPrinterDependencies,
  NetworkSocket,
  NormalizedNetworkPrinterTarget,
  NormalizedRetryOptions
} from "./types.js";

// Defaults

const DEFAULT_PORT             = 9100;
const DEFAULT_TIMEOUT_MS       = 5000;
const DEFAULT_CHUNK_SIZE       = 16 * 1024;
const DEFAULT_RETRIES          = 0;
const DEFAULT_RETRY_DELAY_MS   = 100;
const DEFAULT_RETRY_MAX_MS     = 1000;
const DEFAULT_RETRY_FACTOR     = 2;

// Public API

export function createNetworkPrinter(
  target: NetworkPrinterTarget,
  dependencies: NetworkPrinterDependencies = {}
): NetworkPrinterTransport {
  return new NetworkPrinterTransport(target, dependencies);
}

// Transport

export class NetworkPrinterTransport {
  readonly target: NormalizedNetworkPrinterTarget;

  private socket?: NetworkSocket;
  // 같은 transport에서 다중 print를 직렬화하기 위한 mutex
  private printQueue: Promise<unknown> = Promise.resolve();
  private readonly createConnection: Required<NetworkPrinterDependencies>["createConnection"];
  private readonly sleep: Required<NetworkPrinterDependencies>["sleep"];

  constructor(target: NetworkPrinterTarget, dependencies: NetworkPrinterDependencies = {}) {
    this.target           = normalizeTarget(target);
    this.createConnection = dependencies.createConnection ?? createNodeConnection;
    this.sleep            = dependencies.sleep ?? sleep;
  }

  // 한 socket을 두 print가 동시에 잡지 않도록 호출 순서대로 직렬 실행한다
  print(data: Uint8Array): Promise<PrintResult> {
    const next = this.printQueue.then(() => this.runPrintWithRetry(data));

    // 큐 안에서 발생한 오류가 후속 호출을 막지 않도록 chain은 항상 resolve로 흘린다
    this.printQueue = next.catch(() => undefined);

    return next;
  }

  // 연결 실패만 retry 대상으로 보고 성공할 때까지 단일 출력 시도를 반복한다
  private async runPrintWithRetry(data: Uint8Array): Promise<PrintResult> {
    const startedAt = Date.now();
    let attempt     = 0;

    while (true) {
      try {
        const bytesWritten = await this.printOnce(data);

        return {
          ok          : true,
          target      : this.target,
          bytesWritten,
          durationMs  : Date.now() - startedAt
        };
      } catch (error) {
        // printOnce가 이미 만든 PrinterError는 재시도 판단값을 유지한다
        const printerError = normalizeNetworkError(error, "connect");

        // retryable이 아니거나 재시도 횟수를 다 쓰면 마지막 오류를 던진다
        if (!shouldRetry(printerError, attempt, this.target.retry)) {
          throw printerError;
        }

        await this.sleep(getRetryDelayMs(this.target.retry, attempt));
        attempt += 1;
      }
    }
  }

  async close(): Promise<void> {
    const socket = this.socket;

    this.socket = undefined;

    if (!socket || socket.destroyed) {
      return;
    }

    socket.end();
  }

  destroy(error?: Error): void {
    const socket = this.socket;

    this.socket = undefined;

    if (!socket || socket.destroyed) {
      return;
    }

    socket.destroy(error);
  }

  // 연결을 연 뒤 설정된 크기로 나눈 데이터를 순차 write한다
  private async printOnce(data: Uint8Array): Promise<number> {
    const socket = await this.open();
    let written  = 0;

    try {
      for (const chunk of chunks(data, this.target.chunkSize)) {
        await writeChunk(socket, chunk, this.target.timeoutMs);
        written += chunk.byteLength;
      }

      socket.end();

      return written;
    } catch (error) {
      // write 중 실패한 소켓은 재사용하지 않도록 즉시 폐기한다
      socket.destroy();
      throw normalizeNetworkError(error, "write");
    } finally {
      if (this.socket === socket) {
        this.socket = undefined;
      }
    }
  }

  // 생성한 소켓을 보관해 close와 destroy가 현재 연결을 정리할 수 있게 한다
  private async open(): Promise<NetworkSocket> {
    const socket = this.createConnection({
      host: this.target.host,
      port: this.target.port
    });

    this.socket = socket;

    try {
      await waitForConnect(socket, this.target.timeoutMs, this.target);
    } catch (error) {
      // 연결 실패 시 현재 소켓 참조와 실제 소켓을 함께 정리한다
      if (this.socket === socket) {
        this.socket = undefined;
      }

      socket.destroy();
      throw error;
    }

    return socket;
  }
}

// Target normalization

// 네트워크 대상 옵션을 검증하고 retry 설정까지 기본값으로 채운다
function normalizeTarget(target: NetworkPrinterTarget): NormalizedNetworkPrinterTarget {
  if (!target.host) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer host is required"
    });
  }

  const port      = target.port ?? DEFAULT_PORT;
  const timeoutMs = target.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chunkSize = target.chunkSize ?? DEFAULT_CHUNK_SIZE;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer port must be between 1 and 65535"
    });
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer timeoutMs must be greater than 0"
    });
  }

  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer chunkSize must be greater than 0"
    });
  }

  return {
    type     : "network",
    host     : target.host,
    port,
    timeoutMs,
    retry    : normalizeRetry(target.retry),
    chunkSize
  };
}

// 음수 retry 옵션을 안전한 하한값으로 접어 넣는다
function normalizeRetry(retry: NetworkPrinterTarget["retry"]): NormalizedRetryOptions {
  const retries   = retry?.retries ?? DEFAULT_RETRIES;
  const minDelayMs = retry?.minDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxDelayMs = retry?.maxDelayMs ?? DEFAULT_RETRY_MAX_MS;
  const factor     = retry?.factor ?? DEFAULT_RETRY_FACTOR;

  return {
    retries   : Math.max(0, retries),
    minDelayMs: Math.max(0, minDelayMs),
    maxDelayMs: Math.max(0, maxDelayMs),
    factor    : Math.max(1, factor)
  };
}

// Socket helpers

function createNodeConnection(options: { host: string; port: number }): NetworkSocket {
  return net.createConnection(options);
}

// connect와 error 중 먼저 온 이벤트 또는 timeout으로 연결 결과를 결정한다
function waitForConnect(
  socket: NetworkSocket,
  timeoutMs: number,
  target: NormalizedNetworkPrinterTarget
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 실패 경로는 listener를 정리한 뒤 connect 오류로 정규화한다
    const fail = (error: unknown): void => {
      cleanup();
      reject(normalizeNetworkError(error, "connect"));
    };

    const timeout = setTimeout(() => {
      fail(
        new PrinterError({
          code     : "ERR_CONNECTION_TIMEOUT",
          message  : `Network connection to ${target.host}:${target.port} timed out after ${timeoutMs}ms`,
          retryable: true
        })
      );
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("error", onError);
    };

    const onConnect = (): void => {
      cleanup();
      resolve();
    };

    const onError = (error: Error): void => {
      fail(error);
    };

    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}

// write 콜백, drain 이벤트, socket error를 같은 timeout 경계 안에서 처리한다
function writeChunk(socket: NetworkSocket, data: Uint8Array, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    // 한 번만 listener를 정리하고 결과를 확정한다
    const finish = (error?: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (error) {
        reject(normalizeNetworkError(error, "write"));
        return;
      }

      resolve();
    };

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("error", onError);
      socket.off("drain", onDrain);
    };

    const onError = (error: Error): void => finish(error);
    const onDrain = (): void => finish();

    const timeout = setTimeout(() => {
      finish(
        new PrinterError({
          code     : "ERR_WRITE_TIMEOUT",
          message  : `Network write timed out after ${timeoutMs}ms`,
          retryable: false
        })
      );
    }, timeoutMs);

    socket.once("error", onError);

    let bufferAvailable: boolean;

    try {
      bufferAvailable = socket.write(data, (error) => {
        // write callback은 오류 전달 전용으로만 쓰고 성공 신호는 drain 또는 write 반환값으로 본다
        if (error) {
          finish(error);
        }
      });
    } catch (error) {
      finish(error);
      return;
    }

    // socket 내부 버퍼에 여유가 있으면 즉시 다음 청크로 진행한다
    if (bufferAvailable) {
      finish();
      return;
    }

    // backpressure 상태에서는 drain 이벤트로 다음 청크 진행 시점을 맞춘다
    socket.once("drain", onDrain);
  });
}

// 큰 출력 데이터를 고정 크기 Uint8Array 조각으로 나눈다
function* chunks(data: Uint8Array, chunkSize: number): Generator<Uint8Array> {
  for (let offset = 0; offset < data.byteLength; offset += chunkSize) {
    yield data.subarray(offset, offset + chunkSize);
  }
}

// Retry helpers

// retryable 오류이고 남은 재시도 횟수가 있을 때만 다시 시도한다
function shouldRetry(error: PrinterError, attempt: number, retry: NormalizedRetryOptions): boolean {
  return error.retryable && attempt < retry.retries;
}

// 시도 횟수에 맞춰 exponential backoff 값을 계산하고 최대 지연으로 제한한다
function getRetryDelayMs(retry: NormalizedRetryOptions, attempt: number): number {
  const delayMs = retry.minDelayMs * retry.factor ** attempt;

  return Math.min(delayMs, retry.maxDelayMs);
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

// Error handling

type NetworkOperation = "connect" | "write";

// Node 소켓 오류 코드와 작업 단계에 맞춰 retryable 값을 정한다
function normalizeNetworkError(error: unknown, operation: NetworkOperation): PrinterError {
  // 이미 정규화된 오류는 code와 retryable 값을 그대로 보존한다
  if (error instanceof PrinterError) {
    return error;
  }

  const causeCode    = getCauseCode(error);
  const causeMessage = getCauseMessage(error);

  // 호스트 이름이 풀리지 않으면 입력 오류로 보고 재시도하지 않는다
  if (operation === "connect" && (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN")) {
    return new PrinterError({
      code     : "ERR_HOST_NOT_FOUND",
      message  : withCause("Network host could not be resolved", causeMessage),
      cause    : error,
      retryable: false
    });
  }

  // 라우팅 실패는 네트워크 환경 문제라 무한 재시도가 무의미하므로 retryable=false로 둔다
  if (operation === "connect" && (causeCode === "EHOSTUNREACH" || causeCode === "ENETUNREACH")) {
    return new PrinterError({
      code     : "ERR_NETWORK_UNREACHABLE",
      message  : withCause("Network destination is unreachable", causeMessage),
      cause    : error,
      retryable: false
    });
  }

  // 연결 거부는 프린터 준비 지연일 수 있어 재시도 가능으로 둔다
  if (operation === "connect" && causeCode === "ECONNREFUSED") {
    return new PrinterError({
      code     : "ERR_CONNECTION_REFUSED",
      message  : withCause("Network connection refused", causeMessage),
      cause    : error,
      retryable: true
    });
  }

  // 연결 timeout은 네트워크 일시 지연으로 보고 재시도 가능으로 둔다
  if (operation === "connect" && causeCode === "ETIMEDOUT") {
    return new PrinterError({
      code     : "ERR_CONNECTION_TIMEOUT",
      message  : withCause("Network connection timed out", causeMessage),
      cause    : error,
      retryable: true
    });
  }

  // write 단계 오류는 같은 payload 중복 전송을 피하려고 재시도 불가로 둔다
  if (operation === "write") {
    return new PrinterError({
      code     : "ERR_WRITE_TIMEOUT",
      message  : withCause("Network write failed", causeMessage),
      cause    : error,
      retryable: false
    });
  }

  return new PrinterError({
    code     : "ERR_CONNECTION_REFUSED",
    message  : withCause("Network connection failed", causeMessage),
    cause    : error,
    retryable: true
  });
}

function withCause(message: string, causeMessage: string | undefined): string {
  return causeMessage ? `${message}: ${causeMessage}` : message;
}

// Node 오류 객체의 code 값을 문자열로 꺼낸다
function getCauseCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }

  return undefined;
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
