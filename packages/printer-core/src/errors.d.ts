export declare const PRINTER_ERROR_CODES: readonly ["ERR_INVALID_TARGET", "ERR_UNSUPPORTED_PLATFORM", "ERR_PRINTER_NOT_FOUND", "ERR_CONNECTION_TIMEOUT", "ERR_WRITE_TIMEOUT", "ERR_CONNECTION_REFUSED", "ERR_HOST_NOT_FOUND", "ERR_NETWORK_UNREACHABLE", "ERR_SERIAL_TIMEOUT", "ERR_SERIAL_OPEN_FAILED", "ERR_SERIAL_WRITE_FAILED", "ERR_SERIAL_CLOSE_FAILED", "ERR_WINSPOOL_FAILED", "ERR_CUPS_COMMAND_FAILED", "ERR_ENCODING_FAILED", "ERR_NATIVE_MODULE_UNAVAILABLE"];
export type PrinterErrorCode = (typeof PRINTER_ERROR_CODES)[number];
export interface PrinterErrorOptions {
    code: PrinterErrorCode;
    message: string;
    cause?: unknown;
    retryable?: boolean;
}
export declare class PrinterError extends Error {
    readonly code: PrinterErrorCode;
    readonly retryable: boolean;
    constructor(options: PrinterErrorOptions);
}
export declare function isPrinterError(error: unknown): error is PrinterError;
