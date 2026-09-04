import { describe, expect, it } from "vitest";

import { print } from "../../src/index.js";

describe("system printer", () => {
  it("routes Windows system queues to Winspool", async () => {
    const result = await print(
      { type: "system", printerName: "POS-80" },
      Uint8Array.from([1, 2, 3]),
      {
        system: {
          platform: "win32",
          winspool: {
            async listPrinters() { return []; },
            async getDefaultPrinter() { return null; },
            async printRaw(options) {
              return { jobId: 77, bytesWritten: options.data.byteLength };
            }
          }
        }
      }
    );

    expect(result).toMatchObject({
      jobId: 77,
      bytesWritten: 3,
      delivery: { stage: "spooled", confirmedBy: "winspool-job" }
    });
  });
});
