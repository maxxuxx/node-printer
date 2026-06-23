export const PRINTER_ERROR_CODES = [
  "ERR_INVALID_TARGET",
  "ERR_UNSUPPORTED_PLATFORM",
  "ERR_PRINTER_NOT_FOUND",
  "ERR_CONNECTION_TIMEOUT",
  "ERR_WRITE_TIMEOUT",
  "ERR_CONNECTION_REFUSED",
  "ERR_HOST_NOT_FOUND",
  "ERR_NETWORK_UNREACHABLE",
  "ERR_SERIAL_TIMEOUT",
  "ERR_SERIAL_OPEN_FAILED",
  "ERR_SERIAL_WRITE_FAILED",
  "ERR_SERIAL_CLOSE_FAILED",
  "ERR_WINSPOOL_FAILED",
  "ERR_CUPS_COMMAND_FAILED",
  "ERR_ENCODING_FAILED",
  "ERR_NATIVE_MODULE_UNAVAILABLE",
  "ERR_PRINTER_SETTINGS_NOT_CONFIGURED",
  "ERR_INVALID_PRINTER_SETTINGS"
] as const;

export type PrinterErrorCode = (typeof PRINTER_ERROR_CODES)[number];

export interface PrinterErrorOptions {
  code: PrinterErrorCode;
  message: string;
  cause?: unknown;
  retryable?: boolean;
}

// 패키지 전반에서 공유하는 오류 코드와 재시도 가능 여부를 함께 보관합니다
export class PrinterError extends Error {
  readonly code: PrinterErrorCode;
  readonly retryable: boolean;

  constructor(options: PrinterErrorOptions) {
    super(options.message, { cause: options.cause });

    this.name      = "PrinterError";
    this.code      = options.code;
    this.retryable = options.retryable ?? false;
  }
}

// 외부에서 받은 오류가 프린터 표준 오류인지 좁혀줍니다
export function isPrinterError(error: unknown): error is PrinterError {
  return error instanceof PrinterError;
}
