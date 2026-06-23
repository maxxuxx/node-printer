import { PrinterError, type WinspoolPrinterTarget } from "#core";

import type { WinspoolPrintRawOptions } from "../types.js";

// Input validation

export function validateWinspoolTarget(target: WinspoolPrinterTarget): void {
  if (!target.printerName) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Winspool printerName is required"
    });
  }
}

export function validatePrintRawOptions(options: WinspoolPrintRawOptions): void {
  if (!options.printerName) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Winspool printerName is required"
    });
  }

  if (!options.data.byteLength) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Winspool print data is required"
    });
  }
}
