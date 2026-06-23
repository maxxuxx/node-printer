export {
  createWinspoolPrinter,
  getDefaultWinspoolPrinter,
  listWinspoolPrinters,
  printRaw
} from "./winspool-printer.js";
export { resolveWinspoolPackageRoot } from "./binding.js";

export type {
  WinspoolBinding,
  WinspoolNativePrinterInfo,
  WinspoolPrintRawOptions,
  WinspoolPrinter,
  WinspoolPrinterInfo
} from "./types.js";
