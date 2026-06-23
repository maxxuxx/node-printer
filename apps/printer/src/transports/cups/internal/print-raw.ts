import type { CupsPrinterTarget, PrintResult } from "#core";

import type { CupsPrinterDependencies } from "../types.js";
import { CupsPrinterTransport } from "./transport.js";

// One-shot raw print

export async function printRaw(
  target: CupsPrinterTarget,
  data: Uint8Array,
  dependencies: CupsPrinterDependencies = {}
): Promise<PrintResult> {
  return new CupsPrinterTransport(target, dependencies).print(data);
}
