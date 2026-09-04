import type { NormalizedSerialPrinterTarget } from "./target.js";
import {
  MAX_IDLE_CLOSE_MS,
  MAX_PACING_MS_PER_BYTE,
  MIN_PACING_MS_PER_BYTE
} from "./defaults.js";

export function calculateSerialOpenWindowMs(
  byteLength: number,
  target: NormalizedSerialPrinterTarget
): number {
  const pacingMsPerByte = clamp(
    -0.0003827 * byteLength + 2.2814,
    MIN_PACING_MS_PER_BYTE,
    MAX_PACING_MS_PER_BYTE
  );
  const empiricalMs = Math.ceil(byteLength * pacingMsPerByte);
  const wireMs      = calculateSerialWireTimeMs(byteLength, target);

  return Math.min(
    MAX_IDLE_CLOSE_MS,
    Math.max(target.idleCloseMs, empiricalMs, Math.ceil(wireMs * 1.15))
  );
}

export function calculateRemainingSerialCloseDelayMs(
  byteLength: number,
  target: NormalizedSerialPrinterTarget,
  elapsedMs: number
): number {
  return Math.max(
    target.idleCloseMs,
    calculateSerialOpenWindowMs(byteLength, target) - elapsedMs
  );
}

export function calculateSerialWireTimeMs(
  byteLength: number,
  target: NormalizedSerialPrinterTarget
): number {
  const parityBits = target.parity === "none" ? 0 : 1;
  const frameBits  = 1 + target.dataBits + target.stopBits + parityBits;

  return Math.ceil(byteLength * frameBits * 1000 / target.baudRate);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
