import {
  PrinterError,
  type CupsPrinterTarget,
  type NetworkPrinterTarget,
  type PrinterTarget,
  type PrintResult,
  type SerialPrinterTarget,
  type WinspoolPrinterTarget
} from "#core";

import type { PrinterMethodOptions } from "./types.js";

// Print dispatch

export async function print(
  target: PrinterTarget,
  data: Uint8Array,
  options: PrinterMethodOptions = {}
): Promise<PrintResult> {
  const targetType = target?.type;

  switch (targetType) {
    case "serial": {
      const { printSerial } = await import("#serial");

      return printSerial(target as SerialPrinterTarget, data, options.serial);
    }

    case "network": {
      const { createNetworkPrinter } = await import("#network");
      const printer                  = createNetworkPrinter(
        target as NetworkPrinterTarget,
        options.network
      );

      try {
        return await printer.print(data);
      } finally {
        await printer.close();
      }
    }

    case "cups": {
      const { printRaw } = await import("#cups");

      return printRaw(target as CupsPrinterTarget, data, options.cups);
    }

    case "winspool": {
      if (process.platform !== "win32") {
        throw new PrinterError({
          code   : "ERR_UNSUPPORTED_PLATFORM",
          message: "Winspool printing is only supported on Windows"
        });
      }

      const { createWinspoolPrinter } = await import("#winspool");

      return createWinspoolPrinter(
        target as WinspoolPrinterTarget,
        options.winspool
      ).print(data);
    }

    default:
      throw new PrinterError({
        code   : "ERR_INVALID_TARGET",
        message: "Printer target type is invalid"
      });
  }
}
