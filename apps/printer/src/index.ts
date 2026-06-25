export * from "#core";
export type {
  CupsCommandRequest,
  CupsCommandResult,
  CupsCommandRunner,
  CupsPrintCommand,
  CupsPrinterDependencies,
  CupsPrinterInfo,
  CupsPrinterState
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
  WinspoolBinding,
  WinspoolNativePrinterInfo,
  WinspoolPrintRawOptions,
  WinspoolPrinter,
  WinspoolPrinterInfo
} from "#winspool";

export {
  clearSavedPrinters,
  configurePrinterSettings,
  getSavedPrinter,
  listSavedPrinters,
  removeSavedPrinter,
  savePrinter
} from "./api/printer-settings.js";
export type {
  PrinterSettingsConfig,
  ReceiptProfile,
  SavedPrinter,
  SavedPrinterType,
  SavePrinterInput,
  SaveNetworkPrinterInput,
  SaveSerialPrinterInput,
  SaveUsbPrinterInput
} from "./api/printer-settings.js";
export { listPrinters } from "./api/list-printers.js";
export { print } from "./api/print.js";
export type { ListPrinterType, PrinterListResult, PrinterMethodOptions } from "./api/types.js";
