import type { CupsPrinterInfo, CupsPrinterState } from "../types.js";

// lpstat parsing

export function parseLpstatPrinters(output: string): CupsPrinterInfo[] {
  const lines          = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const printersByName = new Map<string, Omit<CupsPrinterInfo, "isDefault">>();

  for (const line of lines) {
    const printer = parsePrinterLine(line);

    if (!printer) {
      continue;
    }

    const current = printersByName.get(printer.name);

    if (!current || current.state === "unknown") {
      printersByName.set(printer.name, printer);
    }
  }

  const defaultName = findDefaultPrinterName(lines, new Set(printersByName.keys()));

  return Array.from(printersByName.values(), (printer) => ({
    ...printer,
    isDefault: printer.name === defaultName
  }));
}

function findDefaultPrinterName(
  lines: string[],
  printerNames: ReadonlySet<string>
): string | undefined {
  for (const line of lines) {
    const match = /^system default destination:\s+(.+)$/i.exec(line);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  for (const line of lines) {
    const match = /:\s*(\S+)\s*$/.exec(line);

    if (match?.[1] && printerNames.has(match[1])) {
      return match[1];
    }
  }

  return undefined;
}

function parsePrinterLine(line: string): Omit<CupsPrinterInfo, "isDefault"> | undefined {
  const match = /^printer\s+(\S+)\s+(.+)$/i.exec(line);

  if (match?.[1]) {
    return {
      name : match[1],
      state: parsePrinterState(line),
      raw  : line
    };
  }

  if (/\s/.test(line)) {
    return undefined;
  }

  return { name: line, state: "unknown", raw: line };
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
