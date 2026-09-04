import { resolveWinspoolBinding } from "../binding.js";
import type { WinspoolBinding, WinspoolPrinterInfo } from "../types.js";

// Printer discovery

export async function listWinspoolPrinters(
  binding?: WinspoolBinding
): Promise<WinspoolPrinterInfo[]> {
  const resolvedBinding = resolveWinspoolBinding(binding);

  const [printers, defaultPrinterName] = await Promise.all([
    resolvedBinding.listPrinters(),
    resolvedBinding.getDefaultPrinter()
  ]);

  return printers.map((printer) => ({
    ...printer,
    isDefault: printer.name === defaultPrinterName
  }));
}

export async function getDefaultWinspoolPrinter(
  binding?: WinspoolBinding
): Promise<WinspoolPrinterInfo | null> {
  const resolvedBinding = resolveWinspoolBinding(binding);

  const defaultPrinterName = await resolvedBinding.getDefaultPrinter();

  if (!defaultPrinterName) {
    return null;
  }

  const printer = (await listWinspoolPrinters(resolvedBinding)).find(
    (item) => item.name === defaultPrinterName
  );

  return printer ?? {
    name     : defaultPrinterName,
    isDefault: true
  };
}
