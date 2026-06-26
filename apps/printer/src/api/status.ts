import {
  PrinterError,
  type CupsPrinterTarget,
  type NetworkPrinterTarget,
  type PrinterStatus,
  type PrinterTarget,
  type SerialPrinterTarget,
  type WinspoolPrinterTarget
} from "#core";

import type { PrinterMethodOptions } from "./types.js";

// Status dispatch

// 프린터 종류에 따라 ESC/POS(실시간) 또는 OS 스풀러 기반으로 상태를 조회합니다
export async function getStatus(
  target: PrinterTarget,
  options: PrinterMethodOptions = {}
): Promise<PrinterStatus> {
  const targetType = target?.type;

  switch (targetType) {
    case "serial": {
      const { getSerialStatus } = await import("#serial");

      return getSerialStatus(target as SerialPrinterTarget, options.serial);
    }

    case "network": {
      const { getNetworkStatus } = await import("#network");

      return getNetworkStatus(target as NetworkPrinterTarget, options.network);
    }

    case "cups": {
      const { getCupsStatus } = await import("#cups");

      return getCupsStatus(target as CupsPrinterTarget, options.cups);
    }

    case "winspool": {
      if (process.platform !== "win32") {
        throw new PrinterError({
          code   : "ERR_UNSUPPORTED_PLATFORM",
          message: "Winspool status is only supported on Windows"
        });
      }

      const { getWinspoolStatus } = await import("#winspool");

      return getWinspoolStatus(target as WinspoolPrinterTarget, options.winspool);
    }

    default:
      throw new PrinterError({
        code   : "ERR_INVALID_TARGET",
        message: "Printer target type is invalid"
      });
  }
}
