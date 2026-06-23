import net from "node:net";

import { PrinterError } from "#core";

import type {
  NetworkConnectionOptions,
  NetworkSocket,
  NormalizedNetworkPrinterTarget
} from "../types.js";
import { normalizeNetworkError } from "./errors.js";

// Socket helpers

export function createNodeConnection(options: NetworkConnectionOptions): NetworkSocket {
  return net.createConnection(options);
}

export function waitForConnect(
  socket: NetworkSocket,
  timeoutMs: number,
  target: NormalizedNetworkPrinterTarget
): Promise<void> {
  return new Promise((resolve, reject) => {
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

export function writeChunk(
  socket: NetworkSocket,
  data: Uint8Array,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

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
        if (error) {
          finish(error);
        }
      });
    } catch (error) {
      finish(error);
      return;
    }

    if (bufferAvailable) {
      finish();
      return;
    }

    socket.once("drain", onDrain);
  });
}

export function* chunks(data: Uint8Array, chunkSize: number): Generator<Uint8Array> {
  for (let offset = 0; offset < data.byteLength; offset += chunkSize) {
    yield data.subarray(offset, offset + chunkSize);
  }
}
