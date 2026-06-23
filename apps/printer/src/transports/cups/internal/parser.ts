import type { CupsPrinterInfo, CupsPrinterState } from "../types.js";

// lpstat parsing

export function parseLpstatPrinters(output: string): CupsPrinterInfo[] {
  const lines       = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const defaultName = findDefaultPrinterName(lines);

  return lines
    .map(parsePrinterLine)
    .filter((printer): printer is Omit<CupsPrinterInfo, "isDefault"> => Boolean(printer))
    .map((printer) => ({
      ...printer,
      isDefault: printer.name === defaultName
    }));
}

function findDefaultPrinterName(lines: string[]): string | undefined {
  for (const line of lines) {
    const match = /^system default destination:\s+(.+)$/i.exec(line);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function parsePrinterLine(line: string): Omit<CupsPrinterInfo, "isDefault"> | undefined {
  const match = /^printer\s+(\S+)\s+(.+)$/i.exec(line);

  if (!match?.[1]) {
    return undefined;
  }

  return {
    name : match[1],
    state: parsePrinterState(line),
    raw  : line
  };
}

function parsePrinterState(line: string): CupsPrinterState {
  const normalized = line.toLowerCase();

  if (normalized.includes("disabled")) {
    return "disabled";
  }

  if (normalized.includes("now printing")) {
    return "printing";
  }

  if (normalized.includes("is idle")) {
    return "idle";
  }

  return "unknown";
}
