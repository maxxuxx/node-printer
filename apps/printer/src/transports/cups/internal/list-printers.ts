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

  const result = await runCupsCommand(
    resolved.runner,
    {
      command  : "lpstat",
      args     : ["-p", "-d"],
      timeoutMs: resolved.defaultTimeoutMs
    },
    "lpstat"
  );

  return parseLpstatPrinters(result.stdout);
}
