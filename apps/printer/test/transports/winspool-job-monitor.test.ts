import { describe, expect, it } from "vitest";

import {
  decodeWinspoolJobState,
  getWinspoolJobStatus,
  monitorWinspoolJob
} from "../../src/transports/winspool/index.js";
import type { WinspoolBinding, WinspoolJobInfo } from "../../src/transports/winspool/types.js";

const target = { type: "winspool" as const, printerName: "POS-80" };

describe("winspool job status", () => {
  it("decodes paper-out and completed flags", () => {
    expect(decodeWinspoolJobState(job(0x0040))).toBe("error");
    expect(decodeWinspoolJobState(job(0x1000))).toBe("completed");
  });

  it("returns completed when the spooler already removed the job", async () => {
    const binding = fakeBinding([null]);

    await expect(withPlatform("linux", () => getWinspoolJobStatus(target, 10, binding))).resolves.toMatchObject({
      jobId: 10,
      state: "completed"
    });
  });

  it("polls until the job completes", async () => {
    const binding = fakeBinding([job(0x0008), job(0x0010), null]);
    const status = await monitorWinspoolJob(target, 10, { pollMs: 0 }, binding);

    expect(status.state).toBe("completed");
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

function job(status: number): WinspoolJobInfo {
  return { jobId: 10, status, position: 1, totalPages: 1, pagesPrinted: 0 };
}

function fakeBinding(results: Array<WinspoolJobInfo | null>): WinspoolBinding {
  return {
    async listPrinters() { return []; },
    async getDefaultPrinter() { return null; },
    async printRaw() { return { jobId: 10, bytesWritten: 1 }; },
    async getJobInfo() { return results.shift() ?? null; }
  };
}
