import { PrinterError } from "#core";

export type SerialOperation = "open" | "write" | "drain" | "close" | "read";

// Error normalization

export function normalizeSerialError(
  error: unknown,
  operation: SerialOperation
): PrinterError {
  if (error instanceof PrinterError) {
    return error;
  }

  const causeMessage = getCauseMessage(error);
  const message      = causeMessage
    ? `Serial ${operation} failed: ${causeMessage}`
    : `Serial ${operation} failed`;

  return new PrinterError({
    code     : toSerialErrorCode(operation),
    message,
    cause    : error,
    retryable: operation === "open"
  });
}

function toSerialErrorCode(operation: SerialOperation): PrinterError["code"] {
  if (operation === "open") {
    return "ERR_SERIAL_OPEN_FAILED";
  }

  if (operation === "close") {
    return "ERR_SERIAL_CLOSE_FAILED";
  }

  return "ERR_SERIAL_WRITE_FAILED";
}

function getCauseMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
