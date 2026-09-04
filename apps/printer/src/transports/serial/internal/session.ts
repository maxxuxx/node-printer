import { PrinterError } from "#core";

import type { SerialPortConnection, SerialPortConstructor } from "../types.js";
import { callbackToPromise, withSerialTimeout } from "./async.js";
import { serialChunks } from "./chunks.js";
import { normalizeSerialError } from "./errors.js";
import {
  type NormalizedSerialPrinterTarget,
  toSerialOpenOptions
} from "./target.js";

export class SerialSession {
  private port?: SerialPortConnection;

  constructor(
    readonly target: NormalizedSerialPrinterTarget,
    private readonly SerialPort: SerialPortConstructor
  ) {}

  matches(target: NormalizedSerialPrinterTarget, SerialPort: SerialPortConstructor): boolean {
    return this.SerialPort === SerialPort && getOpenSignature(this.target) === getOpenSignature(target);
  }

  async write(data: Uint8Array): Promise<number> {
    const port = await this.open();
    let written = 0;

    for (const chunk of serialChunks(data, this.target.chunkSize)) {
      try {
        await withSerialTimeout(
          callbackToPromise((done) => port.write(chunk, done)),
          this.target.timeoutMs,
          "write"
        );
      } catch (error) {
        const normalized = normalizeSerialError(error, "write");
        throw new PrinterError({
          code        : normalized.code,
          message     : normalized.message,
          cause       : normalized.cause,
          retryable   : false,
          partial     : written > 0 && written < data.byteLength,
          bytesWritten: written
        });
      }

      written += chunk.byteLength;
    }

    try {
      await withSerialTimeout(
        callbackToPromise((done) => port.drain(done)),
        this.target.timeoutMs,
        "drain"
      );
    } catch (error) {
      throw normalizeSerialError(error, "drain");
    }

    return written;
  }

  async queryStatus(query: Uint8Array, expectedBytes: number): Promise<Uint8Array> {
    const port = await this.open();

    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let received = 0;
      let settled  = false;

      const onData = (chunk: Uint8Array): void => {
        chunks.push(chunk);
        received += chunk.byteLength;

        if (received >= expectedBytes) {
          finish();
        }
      };
      const finish = (error?: Error | null): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        port.off?.("data", onData);

        if (error) {
          reject(normalizeSerialError(error, "read"));
          return;
        }

        resolve(concatChunks(chunks));
      };
      const timer = setTimeout(() => finish(), this.target.timeoutMs);

      port.on?.("data", onData);
      port.write(query, finish);
    });
  }

  async close(): Promise<void> {
    const port = this.port;

    if (!port || port.isOpen === false) {
      this.port = undefined;
      return;
    }

    try {
      await withSerialTimeout(
        callbackToPromise((done) => port.close(done)),
        this.target.timeoutMs,
        "close"
      );
    } catch (error) {
      throw normalizeSerialError(error, "close");
    }

    this.port = undefined;
  }

  private async open(): Promise<SerialPortConnection> {
    if (this.port?.isOpen) {
      return this.port;
    }

    const port = new this.SerialPort(toSerialOpenOptions(this.target));

    try {
      await withSerialTimeout(
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

function getOpenSignature(target: NormalizedSerialPrinterTarget): string {
  return JSON.stringify({
    open       : toSerialOpenOptions(target),
    timeoutMs  : target.timeoutMs,
    chunkSize  : target.chunkSize,
    idleCloseMs: target.idleCloseMs
  });
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset   = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}
