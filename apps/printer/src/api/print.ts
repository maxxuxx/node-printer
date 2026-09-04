import {
  PrinterError,
  enqueuePrinterOperation,
  type BluetoothPrinterTarget,
  type CupsPrinterTarget,
  type NetworkPrinterTarget,
  type PrinterTarget,
  type PrintResult,
  type SerialPrinterTarget,
  type SystemPrinterTarget,
  type WinspoolPrinterTarget
} from "#core";

import type { PrinterMethodOptions } from "./types.js";

// Print dispatch

export async function print(
  target: PrinterTarget,
  data: Uint8Array,
  options: PrinterMethodOptions = {}
): Promise<PrintResult> {
  return enqueuePrinterOperation(target, () => printTarget(target, data, options));
}

async function printTarget(
  target: PrinterTarget,
  data: Uint8Array,
  options: PrinterMethodOptions
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

    case "system": {
      const { printSystem } = await import("#system");

      return printSystem(target as SystemPrinterTarget, data, options.system);
    }

    case "bluetooth": {
      const { printBluetooth } = await import("#bluetooth");

      return printBluetooth(target as BluetoothPrinterTarget, data, options.bluetooth);
    }

    default:
      throw new PrinterError({
        code   : "ERR_INVALID_TARGET",
        message: "Printer target type is invalid"
      });
  }
}
