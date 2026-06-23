import { PrinterError, type CupsPrinterTarget } from "#core";

import { DEFAULT_TIMEOUT_MS } from "./defaults.js";

export type NormalizedCupsPrinterTarget = CupsPrinterTarget & {
  timeoutMs: number;
};

// Target normalization

export function normalizeCupsTarget(target: CupsPrinterTarget): NormalizedCupsPrinterTarget {
  if (target.type !== "cups") {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: `CUPS target type must be cups, received ${target.type}`
    });
  }

  if (!target.printerName) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "CUPS printerName is required"
    });
  }

  return {
    ...target,
    timeoutMs: target.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };
}
