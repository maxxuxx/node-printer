import { describe, expect, it } from "vitest";

import {
  calculateRemainingSerialCloseDelayMs,
  calculateSerialOpenWindowMs,
  calculateSerialWireTimeMs
} from "../../src/transports/serial/index.js";

const target = {
  type       : "serial" as const,
  path       : "COM3",
  baudRate   : 9600,
  dataBits   : 8 as const,
  stopBits   : 1 as const,
  parity     : "none" as const,
  flowControl: false as const,
  timeoutMs  : 5000,
  chunkSize  : 500,
  idleCloseMs: 300
};

describe("serial pacing", () => {
  it("calculates wire time from the complete serial frame", () => {
    expect(calculateSerialWireTimeMs(960, target)).toBe(1000);
  });

  it("keeps the session open for the larger empirical or wire window", () => {
    const openWindow = calculateSerialOpenWindowMs(1000, target);

    expect(openWindow).toBeGreaterThanOrEqual(1150);
    expect(openWindow).toBeLessThanOrEqual(2000);
  });

  it("subtracts elapsed transmission time but preserves the idle floor", () => {
    expect(calculateRemainingSerialCloseDelayMs(1000, target, 5000)).toBe(300);
  });
});
