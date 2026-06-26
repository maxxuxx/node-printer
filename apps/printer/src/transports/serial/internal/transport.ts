import type { PrinterError, PrintResult, SerialPrinterTarget } from "#core";

import type { SerialPortConnection, SerialPortConstructor } from "../types.js";
import { callbackToPromise, withSerialTimeout } from "./async.js";
import { normalizeSerialError } from "./errors.js";
import { enqueueSerialOperation } from "./queue.js";
import {
  type NormalizedSerialPrinterTarget,
  normalizeSerialTarget,
  toSerialOpenOptions
} from "./target.js";

// Transport

export class SerialPrinterTransport {
  readonly target: NormalizedSerialPrinterTarget;

  private port?: SerialPortConnection;

  constructor(
    target: SerialPrinterTarget,
    private readonly SerialPort: SerialPortConstructor
  ) {
    this.target = normalizeSerialTarget(target);
  }

  print(data: Uint8Array): Promise<PrintResult> {
    return enqueueSerialOperation(this.target.path, () => this.runPrint(data));
  }

  // 상태 질의 바이트를 쓰고 응답 바이트를 모아 반환합니다 (응답 없으면 빈 배열)
  queryStatus(query: Uint8Array, expectedBytes: number): Promise<Uint8Array> {
    return enqueueSerialOperation(this.target.path, () => this.runQueryStatus(query, expectedBytes));
  }

  async close(): Promise<void> {
    await enqueueSerialOperation(this.target.path, () => this.closeCurrentPort());
  }

  private async runQueryStatus(query: Uint8Array, expectedBytes: number): Promise<Uint8Array> {
    const port = await this.open();

    try {
      const response = await this.collectResponse(port, query, expectedBytes);

      return response;
    } finally {
      await this.closePort(port).catch(() => undefined);
    }
  }

  // data 이벤트로 응답을 모으되, 타임아웃이 나면 그때까지 모인 바이트를 반환합니다
  private collectResponse(
    port: SerialPortConnection,
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

      const finish = (error?: Error): void => {
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
      port.write(query, (error) => {
        if (error) {
          finish(error);
        }
      });
    });
  }

  private async runPrint(data: Uint8Array): Promise<PrintResult> {
    const startedAt = Date.now();
    const port      = await this.open();
    let result      : PrintResult | undefined;
    let failure     : PrinterError | undefined;

    try {
      await withSerialTimeout(
        callbackToPromise((done) => port.write(data, done)),
        this.target.timeoutMs,
        "write"
      );
    } catch (error) {
      failure = normalizeSerialError(error, "write");
    }

    if (!failure) {
      try {
        await withSerialTimeout(
          callbackToPromise((done) => port.drain(done)),
          this.target.timeoutMs,
          "drain"
        );
      } catch (error) {
        failure = normalizeSerialError(error, "drain");
      }
    }

    if (!failure) {
      result = {
        ok          : true,
        target      : this.target,
        bytesWritten: data.byteLength,
        durationMs  : Date.now() - startedAt
      };
    }

    const closeFailure = await this.closePort(port)
      .then(() => undefined)
      .catch((error) => normalizeSerialError(error, "close"));

    if (failure) {
      throw failure;
    }

    if (closeFailure) {
      throw closeFailure;
    }

    return result as PrintResult;
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

  private async closeCurrentPort(): Promise<void> {
    const port = this.port;

    if (!port) {
      return;
    }

    await this.closePort(port);
  }

  private async closePort(port: SerialPortConnection): Promise<void> {
    if (port.isOpen === false) {
      if (this.port === port) {
        this.port = undefined;
      }

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

    if (this.port === port) {
      this.port = undefined;
    }
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
