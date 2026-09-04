export {
  createWinspoolPrinter,
  getDefaultWinspoolPrinter,
  listWinspoolPrinters,
  printRaw
} from "./winspool-printer.js";
export { resolveWinspoolPackageRoot } from "./binding.js";
export { decodeWinspoolStatus, getWinspoolStatus } from "./internal/status.js";
export { getWinspoolPaperInfo } from "./internal/paper.js";
export {
  decodeWinspoolJobState,
  getWinspoolJobStatus,
  monitorWinspoolJob
} from "./internal/job-status.js";

export type {
  WinspoolBinding,
  WinspoolCapabilities,
  WinspoolJobInfo,
  WinspoolJobMonitorOptions,
  WinspoolJobState,
  WinspoolJobStatus,
  WinspoolNativePrinterInfo,
  WinspoolPrintRawOptions,
  WinspoolPrinter,
  WinspoolPrinterInfo
} from "./types.js";
