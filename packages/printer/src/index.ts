export * from "@node-printer/printer-core";
export {
  createCupsPrinter,
  listCupsPrinters,
  parseLpstatPrinters,
  printRaw as printCupsRaw
} from "@node-printer/printer-cups";
export {
  createNetworkPrinter
} from "@node-printer/printer-network";
export { createSerialPrinter, listSerialPorts } from "@node-printer/printer-serial";
export {
  createWinspoolPrinter,
  getDefaultWinspoolPrinter,
  listWinspoolPrinters,
  printRaw as printWinspoolRaw
} from "@node-printer/printer-winspool";
export type {
  CupsCommandRequest,
  CupsCommandResult,
  CupsCommandRunner,
  CupsPrintCommand,
  CupsPrinterDependencies,
  CupsPrinterInfo,
  CupsPrinterState
} from "@node-printer/printer-cups";
export type {
  NetworkConnectionOptions,
  NetworkPrinterDependencies,
  NetworkSocket,
  NormalizedNetworkPrinterTarget,
  NormalizedRetryOptions
} from "@node-printer/printer-network";
export type {
  SerialOpenOptions,
  SerialPortConnection,
  SerialPortConstructor,
  SerialPortInfo,
  SerialPrinterDependencies
} from "@node-printer/printer-serial";
export type {
  WinspoolBinding,
  WinspoolNativePrinterInfo,
  WinspoolPrintRawOptions,
  WinspoolPrinter,
  WinspoolPrinterInfo
} from "@node-printer/printer-winspool";

export * from "./create-printer.js";
