// 통합 팩토리가 받을 수 있는 프린터 대상 형태를 모읍니다
export type PrinterTarget =
  | NetworkPrinterTarget
  | SerialPrinterTarget
  | WinspoolPrinterTarget
  | CupsPrinterTarget;

export interface NetworkPrinterTarget {
  type      : "network";
  host      : string;
  port     ?: number;
  timeoutMs?: number;
  retry    ?: RetryOptions;
  chunkSize?: number;
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
}

// 실제 전송 구현이 공통으로 맞춰야 하는 출력 계약입니다
export interface PrinterTransport<TTarget extends PrinterTarget = PrinterTarget> {
  readonly target           : TTarget;
  print   (data: Uint8Array): Promise<PrintResult>;
  close?  ()                : Promise<void>;
}

export type Printer<TTarget extends PrinterTarget = PrinterTarget> = PrinterTransport<TTarget>;
