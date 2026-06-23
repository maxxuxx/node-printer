import { type CupsPrinterTarget, type PrintResult } from "#core";

import type { CupsPrinterDependencies } from "../types.js";
import { resolveCupsDependencies } from "./dependencies.js";
import { assertSupportedPlatform } from "./platform.js";
import { getPrintArgs } from "./print-args.js";
import { runCupsCommand } from "./runner.js";
import { type NormalizedCupsPrinterTarget, normalizeCupsTarget } from "./target.js";

// Transport

export class CupsPrinterTransport {
  readonly target: NormalizedCupsPrinterTarget;

  private readonly dependencies: Required<CupsPrinterDependencies>;

  constructor(target: CupsPrinterTarget, dependencies: CupsPrinterDependencies = {}) {
    this.target       = normalizeCupsTarget(target);
    this.dependencies = resolveCupsDependencies(dependencies);
  }

  async print(data: Uint8Array): Promise<PrintResult> {
    const startedAt = Date.now();

    assertSupportedPlatform(this.dependencies.platform);

    const result = await runCupsCommand(
      this.dependencies.runner,
      {
        command  : this.dependencies.printCommand,
        args     : getPrintArgs(this.dependencies.printCommand, this.target),
        input    : data,
        timeoutMs: this.target.timeoutMs
      },
      this.dependencies.printCommand
    );

    return {
      ok          : true,
      target      : this.target,
      jobId       : parseJobId(result.stdout),
      bytesWritten: data.byteLength,
      durationMs  : Date.now() - startedAt
    };
  }
}

function parseJobId(stdout: string): string | undefined {
  const match = /request id is\s+([^\s]+)/i.exec(stdout);

  return match?.[1];
}
