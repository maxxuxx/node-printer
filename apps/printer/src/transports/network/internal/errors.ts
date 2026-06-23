import { PrinterError } from "#core";

type NetworkOperation = "connect" | "write";

// Error normalization

export function normalizeNetworkError(
  error: unknown,
  operation: NetworkOperation
): PrinterError {
  if (error instanceof PrinterError) {
    return error;
  }

  const causeCode    = getCauseCode(error);
  const causeMessage = getCauseMessage(error);

  if (operation === "connect" && (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN")) {
    return new PrinterError({
      code     : "ERR_HOST_NOT_FOUND",
      message  : withCause("Network host could not be resolved", causeMessage),
      cause    : error,
      retryable: false
    });
  }

  if (operation === "connect" && (causeCode === "EHOSTUNREACH" || causeCode === "ENETUNREACH")) {
    return new PrinterError({
      code     : "ERR_NETWORK_UNREACHABLE",
      message  : withCause("Network destination is unreachable", causeMessage),
      cause    : error,
      retryable: false
    });
  }

  if (operation === "connect" && causeCode === "ECONNREFUSED") {
    return new PrinterError({
      code     : "ERR_CONNECTION_REFUSED",
      message  : withCause("Network connection refused", causeMessage),
      cause    : error,
      retryable: true
    });
  }

  if (operation === "connect" && causeCode === "ETIMEDOUT") {
    return new PrinterError({
      code     : "ERR_CONNECTION_TIMEOUT",
      message  : withCause("Network connection timed out", causeMessage),
      cause    : error,
      retryable: true
    });
  }

  if (operation === "write") {
    return new PrinterError({
      code     : "ERR_WRITE_TIMEOUT",
      message  : withCause("Network write failed", causeMessage),
      cause    : error,
      retryable: false
    });
  }

  return new PrinterError({
    code     : "ERR_CONNECTION_REFUSED",
    message  : withCause("Network connection failed", causeMessage),
    cause    : error,
    retryable: true
  });
}

function withCause(message: string, causeMessage: string | undefined): string {
  return causeMessage ? `${message}: ${causeMessage}` : message;
}

function getCauseCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }

  return undefined;
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
