import { assertWindows, loadWinspoolBinding } from "../binding.js";
import type { WinspoolBinding, WinspoolPrinterInfo } from "../types.js";

// Printer discovery

export async function listWinspoolPrinters(
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<WinspoolPrinterInfo[]> {
  assertWindows();

  const [printers, defaultPrinterName] = await Promise.all([
    binding.listPrinters(),
    binding.getDefaultPrinter()
  ]);

  return printers.map((printer) => ({
    ...printer,
    isDefault: printer.name === defaultPrinterName
  }));
}

export async function getDefaultWinspoolPrinter(
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<WinspoolPrinterInfo | null> {
  assertWindows();

  const defaultPrinterName = await binding.getDefaultPrinter();

  if (!defaultPrinterName) {
    return null;
  }

  const printer = (await listWinspoolPrinters(binding)).find(
    (item) => item.name === defaultPrinterName
  );

  return printer ?? {
    name     : defaultPrinterName,
    isDefault: true
  };
}
