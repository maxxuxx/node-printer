import type { PrintResult, SerialPrinterTarget } from "#core";

import type { SerialPortConstructor } from "../types.js";
import { calculateRemainingSerialCloseDelayMs } from "./pacing.js";
import { enqueueSerialOperation } from "./queue.js";
import {
  getSerialSessionPool,
  type SerialSessionPool
} from "./session-pool.js";
import {
  type NormalizedSerialPrinterTarget,
  normalizeSerialTarget
} from "./target.js";

export class SerialPrinterTransport {
  readonly target: NormalizedSerialPrinterTarget;
  private readonly sessionPool: SerialSessionPool;

  constructor(
    target: SerialPrinterTarget,
    private readonly SerialPort: SerialPortConstructor
  ) {
    this.target      = normalizeSerialTarget(target);
    this.sessionPool = getSerialSessionPool(SerialPort);
  }

  print(data: Uint8Array): Promise<PrintResult> {
    return enqueueSerialOperation(this.target.path, () => this.runPrint(data));
  }

  queryStatus(query: Uint8Array, expectedBytes: number): Promise<Uint8Array> {
    return enqueueSerialOperation(this.target.path, async () => {
      const session = await this.sessionPool.acquire(this.target, this.SerialPort);

      try {
        const response = await session.queryStatus(query, expectedBytes);
        this.sessionPool.deferClose(this.target.path, this.target.idleCloseMs);
        return response;
      } catch (error) {
        await this.sessionPool.invalidate(this.target.path).catch(() => undefined);
        throw error;
      }
    });
  }

  close(): Promise<void> {
    return this.sessionPool.close(this.target.path);
  }

  private async runPrint(data: Uint8Array): Promise<PrintResult> {
    const startedAt = Date.now();
    const session   = await this.sessionPool.acquire(this.target, this.SerialPort);

    try {
      const bytesWritten = await session.write(data);
      const durationMs   = Date.now() - startedAt;
      const closeDelayMs = calculateRemainingSerialCloseDelayMs(
        data.byteLength,
        this.target,
        durationMs
      );

      this.sessionPool.deferClose(this.target.path, closeDelayMs);

      return {
        ok: true,
        target: this.target,
        bytesWritten,
        durationMs,
        delivery: {
          stage      : "transmitted",
          confirmedBy: "serial-drain"
        }
      };
    } catch (error) {
      await this.sessionPool.invalidate(this.target.path).catch(() => undefined);
      throw error;
    }
  }
}
