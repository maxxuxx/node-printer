import type { PrintResult, WinspoolPrinterTarget } from "#core";

export interface WinspoolPrinterInfo {
  name       : string;
  isDefault  : boolean;
  status    ?: number;
  driverName?: string;
  portName  ?: string;
}

export interface WinspoolNativePrinterInfo {
  name       : string;
  status    ?: number;
  driverName?: string;
  portName  ?: string;
}

export interface WinspoolPrintRawOptions {
  printerName  : string;
  data         : Uint8Array;
  documentName?: string;
}

export interface WinspoolCapabilities {
  printableWidthDots?: number;
  widthMm           ?: number;
  dpi               ?: number;
}

export interface WinspoolJobInfo {
  jobId        : number;
  status       : number;
  position     : number;
  totalPages   : number;
  pagesPrinted : number;
  documentName?: string;
  statusText  ?: string;
}

export type WinspoolJobState =
  | "queued"
  | "spooling"
  | "printing"
  | "completed"
  | "paused"
  | "error"
  | "unknown";

export interface WinspoolJobStatus {
  jobId : number;
  state : WinspoolJobState;
  raw  ?: WinspoolJobInfo;
}

export interface WinspoolJobMonitorOptions {
  timeoutMs?: number;
  pollMs   ?: number;
}

export interface WinspoolBinding {
  listPrinters(): Promise<WinspoolNativePrinterInfo[]>;
  getDefaultPrinter(): Promise<string | null>;
  printRaw(options: WinspoolPrintRawOptions): Promise<{
    jobId       ?: number;
    bytesWritten: number;
  }>;
  getPrinterCapabilities?(printerName: string): Promise<WinspoolCapabilities>;
  getJobInfo?(printerName: string, jobId: number): Promise<WinspoolJobInfo | null>;
}

export type WinspoolPrinter = {
  readonly target: WinspoolPrinterTarget;
  print(data: Uint8Array): Promise<PrintResult>;
};
