import type { CupsPrinterTarget } from "#core";

import { listCupsPrinters } from "./internal/list-printers.js";
import { parseLpstatPrinters } from "./internal/parser.js";
import { printRaw } from "./internal/print-raw.js";
import { NodeCupsCommandRunner } from "./internal/runner.js";
import { CupsPrinterTransport } from "./internal/transport.js";
import type { CupsPrinterDependencies } from "./types.js";

// Public API

export {
  CupsPrinterTransport,
  NodeCupsCommandRunner,
  listCupsPrinters,
  parseLpstatPrinters,
  printRaw
};

export function createCupsPrinter(
  target: CupsPrinterTarget,
  dependencies: CupsPrinterDependencies = {}
): CupsPrinterTransport {
  return new CupsPrinterTransport(target, dependencies);
}
