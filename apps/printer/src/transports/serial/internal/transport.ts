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

  async close(): Promise<void> {
    await enqueueSerialOperation(this.target.path, () => this.closeCurrentPort());
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
