import type { CupsPrinterDependencies, CupsPrinterInfo } from "#cups";
import type { WinspoolBinding, WinspoolPrinterInfo } from "#winspool";

export interface SystemPrinterDependencies {
  platform?: NodeJS.Platform;
  cups    ?: CupsPrinterDependencies;
  winspool?: WinspoolBinding;
}

export type SystemPrinterInfo = CupsPrinterInfo | WinspoolPrinterInfo;
export type SystemPrinterBackend = "winspool" | "cups";
