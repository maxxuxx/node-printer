import { PrinterError } from "#core";

import type { CupsPrinterInfo } from "#cups";
import type { NetworkPrinterInfo } from "#network";
import type { SerialPortInfo } from "#serial";
import type { WinspoolPrinterInfo } from "#winspool";
import type {
  AnyListPrinterType,
  PrinterListResult,
  PrinterMethodOptions,
  UsbPrinterInfo
} from "./types.js";

// Discovery dispatch

export function listPrinters(
  type: "serial",
  options?: PrinterMethodOptions
): Promise<SerialPortInfo[]>;
export function listPrinters(
  type: "usb",
  options?: PrinterMethodOptions
): Promise<UsbPrinterInfo[]>;
export function listPrinters(
  type: "network",
  options?: PrinterMethodOptions
): Promise<NetworkPrinterInfo[]>;
export function listPrinters(
  type: "cups",
  options?: PrinterMethodOptions
): Promise<CupsPrinterInfo[]>;
export function listPrinters(
  type: "winspool",
  options?: PrinterMethodOptions
): Promise<WinspoolPrinterInfo[]>;
export function listPrinters<TType extends AnyListPrinterType>(
  type: TType,
  options?: PrinterMethodOptions
): Promise<PrinterListResult<TType>>;
export async function listPrinters<TType extends AnyListPrinterType>(
  type: TType,
  options: PrinterMethodOptions = {}
): Promise<PrinterListResult<TType>> {
  switch (type) {
    case "serial": {
      const { listSerialPorts } = await import("#serial");

      return listSerialPorts(options.serial) as Promise<PrinterListResult<TType>>;
    }

    case "usb":
      return listUsbPrinters(options) as Promise<PrinterListResult<TType>>;

    case "network": {
      const { listNetworkPrinters } = await import("#network");

      return listNetworkPrinters(options.network) as Promise<PrinterListResult<TType>>;
    }

    case "cups": {
      const { listCupsPrinters } = await import("#cups");

      return listCupsPrinters(options.cups) as Promise<PrinterListResult<TType>>;
    }

    case "winspool": {
      const { listWinspoolPrinters } = await import("#winspool");

      return listWinspoolPrinters(options.winspool) as Promise<PrinterListResult<TType>>;
    }

    default:
      throw new PrinterError({
        code   : "ERR_INVALID_TARGET",
        message: "Printer list type is invalid"
      });
  }
}

// USB discovery

async function listUsbPrinters(options: PrinterMethodOptions): Promise<UsbPrinterInfo[]> {
  if (process.platform === "win32") {
    const { listWinspoolPrinters } = await import("#winspool");

    return listWinspoolPrinters(options.winspool);
  }

  if (process.platform === "darwin" || process.platform === "linux") {
    const { listCupsPrinters } = await import("#cups");

    return listCupsPrinters(options.cups);
  }

  throw new PrinterError({
    code   : "ERR_UNSUPPORTED_PLATFORM",
    message: `USB printer listing is not supported on ${process.platform}`
  });
}
