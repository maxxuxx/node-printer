import type { CupsPrintCommand } from "../types.js";
import type { NormalizedCupsPrinterTarget } from "./target.js";

// Print command args

export function getPrintArgs(
  command: CupsPrintCommand,
  target: NormalizedCupsPrinterTarget
): string[] {
  if (command === "lpr") {
    return [
      "-P",
      target.printerName,
      "-l",
      ...getLprDocumentArgs(target)
    ];
  }

  return [
    "-d",
    target.printerName,
    "-o",
    "raw",
    ...getLpDocumentArgs(target)
  ];
}

function getLpDocumentArgs(target: NormalizedCupsPrinterTarget): string[] {
  if (!target.documentName) {
    return [];
  }

  return ["-t", target.documentName];
}

function getLprDocumentArgs(target: NormalizedCupsPrinterTarget): string[] {
  if (!target.documentName) {
    return [];
  }

  return ["-T", target.documentName];
}
