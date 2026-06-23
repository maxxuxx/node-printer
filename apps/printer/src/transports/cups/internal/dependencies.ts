import type { CupsPrinterDependencies } from "../types.js";
import { DEFAULT_PRINT_COMMAND, DEFAULT_TIMEOUT_MS } from "./defaults.js";
import { NodeCupsCommandRunner } from "./runner.js";

// Dependency resolution

export function resolveCupsDependencies(
  dependencies: CupsPrinterDependencies
): Required<CupsPrinterDependencies> {
  return {
    runner          : dependencies.runner ?? new NodeCupsCommandRunner(),
    platform        : dependencies.platform ?? process.platform,
    printCommand    : dependencies.printCommand ?? DEFAULT_PRINT_COMMAND,
    defaultTimeoutMs: dependencies.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS
  };
}
