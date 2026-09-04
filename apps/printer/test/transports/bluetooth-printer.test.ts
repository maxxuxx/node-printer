import { describe, expect, it } from "vitest";

import { print } from "../../src/index.js";

describe("bluetooth printer", () => {
  it("writes BLE data using the connection maximum chunk size", async () => {
    const chunks: number[][] = [];
    let closed = false;
    const result = await print(
      {
        type        : "bluetooth",
        mode        : "ble",
        deviceId    : "printer-1",
        profileId   : "escpos-test",
        interChunkMs: 0
      },
      Uint8Array.from([1, 2, 3, 4, 5]),
      {
        bluetooth: {
          ble: {
            async connect() {
              return {
                maxWriteSize: 2,
                async write(data) { chunks.push(Array.from(data)); },
                async drain() { return undefined; },
                async close() { closed = true; }
              };
            }
          }
        }
      }
    );

    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    expect(closed).toBe(true);
    expect(result.delivery.confirmedBy).toBe("bluetooth-write");
  });
});
