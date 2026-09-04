import { describe, expect, it } from "vitest";

import { getCupsJobStatus } from "../../src/transports/cups/index.js";
import type { CupsCommandRequest, CupsCommandResult } from "../../src/transports/cups/types.js";

describe("cups job status", () => {
  it("finds pending jobs using lpstat", async () => {
    const requests: CupsCommandRequest[] = [];
    const status = await getCupsJobStatus(
      { type: "cups", printerName: "XP_80" },
      "XP_80-42",
      {
        platform: "linux",
        runner: {
          async run(request) {
            requests.push(request);
            return result("XP_80-42 user 1024 Fri\n");
          }
        }
      }
    );

    expect(status.state).toBe("queued");
    expect(requests[0]?.args).toEqual(["-W", "not-completed", "-o", "XP_80"]);
  });
});

function result(stdout: string): CupsCommandResult {
  return { stdout, stderr: "", exitCode: 0, signal: null };
}
