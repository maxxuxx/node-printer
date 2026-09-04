import { describe, expect, it } from "vitest";

import { print } from "../../src/index.js";

describe("system printer", () => {
  it("routes Windows system queues to Winspool", async () => {
    const result = await withPlatform("linux", () =>
      print(
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
      )
    );

    expect(result).toMatchObject({
      jobId: 77,
      bytesWritten: 3,
      delivery: { stage: "spooled", confirmedBy: "winspool-job" }
    });
  });
});

async function withPlatform<T>(platform: NodeJS.Platform, run: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { configurable: true, value: platform });

  try {
    return await run();
  } finally {
    if (descriptor) Object.defineProperty(process, "platform", descriptor);
  }
}
