export * from "#core";
export type {
  BluetoothBleAdapter,
  BluetoothBleConnection,
  BluetoothPrinterDependencies,
  BluetoothPrinterInfo
} from "#bluetooth";
export type {
  CupsCommandRequest,
  CupsCommandResult,
  CupsCommandRunner,
  CupsJobMonitorOptions,
  CupsJobState,
  CupsJobStatus,
  CupsPrintCommand,
  CupsPrinterDependencies,
  CupsPrinterInfo,
  CupsPrinterState
} from "#cups";
export {
  getCupsJobStatus,
  monitorCupsJob
} from "#cups";
export type {
  NetworkConnectionOptions,
  NetworkPortProbe,
  NetworkPrinterInfo,
  NetworkPrinterDependencies,
  NetworkSocket,
  NormalizedNetworkPrinterTarget,
  NormalizedRetryOptions
} from "#network";
export type {
  SerialOpenOptions,
  SerialPortConnection,
  SerialPortConstructor,
  SerialPortInfo,
  SerialPrinterDependencies
} from "#serial";
export type {
  SystemPrinterBackend,
  SystemPrinterDependencies,
  SystemPrinterInfo
} from "#system";
export type {
  WinspoolBinding,
  WinspoolJobInfo,
  WinspoolJobMonitorOptions,
  WinspoolJobState,
  WinspoolJobStatus,
  WinspoolNativePrinterInfo,
  WinspoolPrintRawOptions,
  WinspoolPrinter,
  WinspoolPrinterInfo
} from "#winspool";
export {
  getWinspoolJobStatus,
  monitorWinspoolJob
} from "#winspool";

export {
  clearSavedPrinters,
  configurePrinterSettings,
  getSavedPrinter,
  listSavedPrinters,
  removeSavedPrinter,
  savePrinter,
  updatePrinter
} from "./api/printer-settings.js";
export type {
  PrinterSettingsConfig,
  ReceiptProfile,
  SavedPrinter,
  SavedPrinterType,
  SavePrinterInput,
  SaveNetworkPrinterInput,
  SaveSystemPrinterInput,
  SaveBluetoothPrinterInput,
  SaveSerialPrinterInput,
  SaveUsbPrinterInput
} from "./api/printer-settings.js";
export { listPrinters } from "./api/list-printers.js";
export { print } from "./api/print.js";
export { closeAllPrinters, closePrinter } from "./api/lifecycle.js";
export { getStatus } from "./api/status.js";
export { getPaperInfo, resolveColumns } from "./api/paper.js";
export type { PaperInfoOptions } from "./api/paper.js";
export type { ListPrinterType, PrinterListResult, PrinterMethodOptions } from "./api/types.js";
