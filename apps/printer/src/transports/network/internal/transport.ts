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
