import type { PrintDelivery } from "./delivery.js";

// 통합 팩토리가 받을 수 있는 프린터 대상 형태를 모읍니다
export type PrinterTarget =
  | NetworkPrinterTarget
  | SerialPrinterTarget
  | WinspoolPrinterTarget
  | CupsPrinterTarget
  | SystemPrinterTarget
  | BluetoothPrinterTarget;

export interface NetworkPrinterTarget {
  type      : "network";
  host      : string;
  port     ?: number;
  timeoutMs?: number;
  retry    ?: RetryOptions;
  chunkSize?: number;
  deliveryMode?: "write" | "status";
  settleMs?: number;
}

export interface SerialPrinterTarget {
  type        : "serial";
  path        : string;
  baudRate   ?: number;
  dataBits   ?: 5 | 6 | 7 | 8;
  stopBits   ?: 1 | 1.5 | 2;
  parity     ?: "none" | "even" | "odd" | "mark" | "space";
  flowControl?: boolean | "xon" | "xoff" | "rtscts";
  timeoutMs  ?: number;
  chunkSize  ?: number;
  idleCloseMs?: number;
}

export interface WinspoolPrinterTarget {
  type         : "winspool";
  printerName  : string;
  documentName?: string;
}

export interface CupsPrinterTarget {
  type         : "cups";
  printerName  : string;
  documentName?: string;
  timeoutMs   ?: number;
}

export interface SystemPrinterTarget {
  type         : "system";
  printerName  : string;
  documentName?: string;
  timeoutMs   ?: number;
  backend     ?: "auto" | "winspool" | "cups";
}

export type BluetoothPrinterTarget =
  | BluetoothSppPrinterTarget
  | BluetoothSystemPrinterTarget
  | BluetoothBlePrinterTarget;

export interface BluetoothSppPrinterTarget extends Omit<SerialPrinterTarget, "type"> {
  type: "bluetooth";
  mode: "spp";
}

export interface BluetoothSystemPrinterTarget {
  type         : "bluetooth";
  mode         : "system";
  printerName  : string;
  documentName?: string;
  timeoutMs   ?: number;
  backend     ?: "auto" | "winspool" | "cups";
}

export interface BluetoothBlePrinterTarget {
  type        : "bluetooth";
  mode        : "ble";
  deviceId    : string;
  profileId   : string;
  timeoutMs  ?: number;
  chunkSize  ?: number;
  interChunkMs?: number;
}

export interface RetryOptions {
  retries    : number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor    ?: number;
}

export interface PrintResult {
  ok           : true;
  target       : PrinterTarget;
  jobId       ?: string | number;
  bytesWritten?: number;
  durationMs   : number;
  delivery     : PrintDelivery;
}

// 실제 전송 구현이 공통으로 맞춰야 하는 출력 계약입니다
export interface PrinterTransport<TTarget extends PrinterTarget = PrinterTarget> {
  readonly target           : TTarget;
  print   (data: Uint8Array): Promise<PrintResult>;
  close?  ()                : Promise<void>;
}

export type Printer<TTarget extends PrinterTarget = PrinterTarget> = PrinterTransport<TTarget>;
