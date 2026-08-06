import { describe, expect, it } from "vitest";

import { NodeCupsCommandRunner } from "../../src/transports/cups/internal/runner.js";

describe("NodeCupsCommandRunner", () => {
  it("runs CUPS commands with locale-independent output", async () => {
    const runner = new NodeCupsCommandRunner();
    const result = await runner.run({
      command  : process.execPath,
      args     : ["-e", 'process.stdout.write(process.env.LC_ALL ?? "")'],
      timeoutMs: 1000
    });

    expect(result).toMatchObject({
      stdout  : "C",
      exitCode: 0,
      timedOut: false
    });
  });
});
