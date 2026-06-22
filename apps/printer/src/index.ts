export * from "#core";
export {
  createCupsPrinter,
  listCupsPrinters,
  parseLpstatPrinters,
  printRaw as printCupsRaw
} from "#cups";
export {
  createNetworkPrinter
} from "#network";
export { createSerialPrinter, listSerialPorts } from "#serial";
export {
  createWinspoolPrinter,
  getDefaultWinspoolPrinter,
  listWinspoolPrinters,
  printRaw as printWinspoolRaw
} from "#winspool";
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

export * from "./create-printer.js";
