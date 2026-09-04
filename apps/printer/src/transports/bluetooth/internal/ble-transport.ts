import {
  PrinterError,
  type BluetoothBlePrinterTarget,
  type PrintResult
} from "#core";

import type { BluetoothBleAdapter } from "../types.js";
import { bluetoothChunks } from "./chunks.js";

const DEFAULT_TIMEOUT_MS = 10_000;

export async function printBluetoothBle(
  target: BluetoothBlePrinterTarget,
  data: Uint8Array,
  adapter?: BluetoothBleAdapter
): Promise<PrintResult> {
  if (!adapter) {
    throw new PrinterError({
      code   : "ERR_UNSUPPORTED_PLATFORM",
      message: "Direct Bluetooth LE printing requires a BluetoothBleAdapter"
    });
  }

  const startedAt  = Date.now();
  const timeoutMs  = target.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const connection = await withTimeout(adapter.connect(target), timeoutMs, "connect");
  let written      = 0;

  try {
    for (const chunk of bluetoothChunks(data, target.chunkSize, connection.maxWriteSize)) {
      await withTimeout(connection.write(chunk), timeoutMs, "write");
      written += chunk.byteLength;

      if ((target.interChunkMs ?? 0) > 0) {
        await sleep(target.interChunkMs as number);
      }
    }

    if (connection.drain) {
      await withTimeout(connection.drain(), timeoutMs, "drain");
    }

    return {
      ok          : true,
      target,
      bytesWritten: written,
      durationMs  : Date.now() - startedAt,
      delivery    : {
        stage      : "transmitted",
        confirmedBy: "bluetooth-write"
      }
    };
  } finally {
    await connection.close().catch(() => undefined);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new PrinterError({
      code     : operation === "connect" ? "ERR_CONNECTION_TIMEOUT" : "ERR_WRITE_TIMEOUT",
      message  : `Bluetooth ${operation} timed out after ${timeoutMs}ms`,
      retryable: operation === "connect"
    })), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
