import type { WinspoolPrinterTarget } from "#core";

import { assertWindows, loadWinspoolBinding } from "./binding.js";
import {
  getDefaultWinspoolPrinter,
  listWinspoolPrinters
} from "./internal/list-printers.js";
import { printRaw } from "./internal/print-raw.js";
import { WinspoolPrinterTransport } from "./internal/transport.js";
import { validateWinspoolTarget } from "./internal/validation.js";
import type { WinspoolBinding, WinspoolPrinter } from "./types.js";

// Public API

export { getDefaultWinspoolPrinter, listWinspoolPrinters, printRaw };

export function createWinspoolPrinter(
  target: WinspoolPrinterTarget,
  binding: WinspoolBinding = loadWinspoolBinding()
): WinspoolPrinter {
  assertWindows();
  validateWinspoolTarget(target);

  return new WinspoolPrinterTransport(target, binding);
}
