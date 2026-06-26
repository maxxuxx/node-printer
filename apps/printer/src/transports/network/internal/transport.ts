import { type NetworkPrinterTarget, type PrintResult } from "#core";

import type {
  NetworkPrinterDependencies,
  NetworkSocket,
  NormalizedNetworkPrinterTarget
} from "../types.js";
import { normalizeNetworkError } from "./errors.js";
import { getRetryDelayMs, shouldRetry, sleep } from "./retry.js";
import { chunks, createNodeConnection, waitForConnect, writeChunk } from "./socket.js";
import { normalizeNetworkTarget } from "./target.js";

// Transport

export class NetworkPrinterTransport {
  readonly target: NormalizedNetworkPrinterTarget;

  private socket?: NetworkSocket;
  private printQueue: Promise<unknown> = Promise.resolve();
  private readonly createConnection: Required<NetworkPrinterDependencies>["createConnection"];
  private readonly sleep: Required<NetworkPrinterDependencies>["sleep"];

  constructor(target: NetworkPrinterTarget, dependencies: NetworkPrinterDependencies = {}) {
    this.target           = normalizeNetworkTarget(target);
    this.createConnection = dependencies.createConnection ?? createNodeConnection;
    this.sleep            = dependencies.sleep ?? sleep;
  }

  print(data: Uint8Array): Promise<PrintResult> {
    const next = this.printQueue.then(() => this.runPrintWithRetry(data));

    this.printQueue = next.catch(() => undefined);

    return next;
  }

  // 상태 질의 바이트를 쓰고 응답 바이트를 모아 반환합니다 (응답 없으면 빈 배열)
  queryStatus(query: Uint8Array, expectedBytes: number): Promise<Uint8Array> {
    const next = this.printQueue.then(() => this.runQueryStatus(query, expectedBytes));

    this.printQueue = next.catch(() => undefined);

    return next;
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
        const printerError = normalizeNetworkError(error, "connect");

        if (!shouldRetry(printerError, attempt, this.target.retry)) {
          throw printerError;
        }

        await this.sleep(getRetryDelayMs(this.target.retry, attempt));
        attempt += 1;
      }
    }
  }

  private async runQueryStatus(query: Uint8Array, expectedBytes: number): Promise<Uint8Array> {
    const socket = await this.open();

    try {
      return await this.collectResponse(socket, query, expectedBytes);
    } finally {
      if (this.socket === socket) {
        this.socket = undefined;
      }

      socket.destroy();
    }
  }

  // data 이벤트로 응답을 모으되, 타임아웃이 나면 그때까지 모인 바이트를 반환합니다
  private collectResponse(
    socket: NetworkSocket,
    query: Uint8Array,
    expectedBytes: number
  ): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const chunks  : Uint8Array[] = [];
      let received  = 0;
      let settled   = false;

      const onData = (chunk: Uint8Array): void => {
        chunks.push(chunk);
        received += chunk.byteLength;

        if (received >= expectedBytes) {
          finish();
        }
      };

      const onError = (error: Error): void => finish(normalizeNetworkError(error, "write"));

      const finish = (error?: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        socket.off?.("data", onData);
        socket.off("error", onError);

        if (error) {
          reject(error);
          return;
        }

        resolve(concatChunks(chunks));
      };

      const timer = setTimeout(() => finish(), this.target.timeoutMs);

      socket.once("error", onError);
      socket.on?.("data", onData);
      socket.write(query, (error) => {
        if (error) {
          finish(normalizeNetworkError(error, "write"));
        }
      });
    });
  }

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
      socket.destroy();
      throw normalizeNetworkError(error, "write");
    } finally {
      if (this.socket === socket) {
        this.socket = undefined;
      }
    }
  }

  private async open(): Promise<NetworkSocket> {
    const socket = this.createConnection({
      host: this.target.host,
      port: this.target.port
    });

    this.socket = socket;

    try {
      await waitForConnect(socket, this.target.timeoutMs, this.target);
    } catch (error) {
      if (this.socket === socket) {
        this.socket = undefined;
      }

      socket.destroy();
      throw error;
    }

    return socket;
  }
}

// 응답 청크들을 하나의 Uint8Array로 합칩니다
function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total  = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset    = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}
