export {
  createWinspoolPrinter,
  getDefaultWinspoolPrinter,
  listWinspoolPrinters,
  printRaw
} from "./winspool-printer.js";
export { resolveWinspoolPackageRoot } from "./binding.js";
export { decodeWinspoolStatus, getWinspoolStatus } from "./internal/status.js";
export { getWinspoolPaperInfo } from "./internal/paper.js";

export type {
  WinspoolBinding,
  WinspoolCapabilities,
  WinspoolNativePrinterInfo,
  WinspoolPrintRawOptions,
  WinspoolPrinter,
  WinspoolPrinterInfo
} from "./types.js";
