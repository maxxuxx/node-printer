import type { CupsPrinterDependencies, CupsPrinterInfo } from "../types.js";
import { resolveCupsDependencies } from "./dependencies.js";
import { parseLpstatPrinters } from "./parser.js";
import { assertSupportedPlatform } from "./platform.js";
import { runCupsCommand } from "./runner.js";

// Printer discovery

export async function listCupsPrinters(
  dependencies: CupsPrinterDependencies = {}
): Promise<CupsPrinterInfo[]> {
  const resolved = resolveCupsDependencies(dependencies);

  assertSupportedPlatform(resolved.platform);

  const destinations = await runCupsCommand(
    resolved.runner,
    {
      command  : "lpstat",
      args     : ["-e"],
      timeoutMs: resolved.defaultTimeoutMs
    },
    "lpstat"
  );

  // lpstat -p exits with code 1 when CUPS has no destinations, which is a valid empty result.
  if (!destinations.stdout.trim()) {
    return [];
  }

  const result = await runCupsCommand(
    resolved.runner,
    {
      command  : "lpstat",
      args     : ["-e", "-p", "-d"],
      timeoutMs: resolved.defaultTimeoutMs
    },
    "lpstat"
  );

  return parseLpstatPrinters(result.stdout);
}
