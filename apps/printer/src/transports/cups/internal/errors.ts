import { PrinterError } from "#core";

import type { CupsCommandResult } from "../types.js";

// Command errors

export function assertCommandSucceeded(
  label: string,
  result: CupsCommandResult,
  timeoutMs: number
): void {
  if (result.timedOut) {
    throw new PrinterError({
      code     : "ERR_CUPS_COMMAND_FAILED",
      message  : `CUPS ${label} timed out after ${timeoutMs}ms${formatCommandOutput(result)}`,
      cause    : result,
      retryable: true
    });
  }

  if (result.exitCode !== 0) {
    throw new PrinterError({
      code   : "ERR_CUPS_COMMAND_FAILED",
      message: `CUPS ${label} failed with exit code ${result.exitCode}${formatCommandOutput(result)}`,
      cause  : result
    });
  }
}

export function normalizeCupsError(error: unknown, label: string): PrinterError {
  if (error instanceof PrinterError) {
    return error;
  }

  const causeMessage = getCauseMessage(error);
  const message      = causeMessage
    ? `CUPS ${label} failed: ${causeMessage}`
    : `CUPS ${label} failed`;

  return new PrinterError({
    code : "ERR_CUPS_COMMAND_FAILED",
    message,
    cause: error
  });
}

function formatCommandOutput(result: CupsCommandResult): string {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  const parts  = [
    stdout ? `stdout: ${stdout}` : "",
    stderr ? `stderr: ${stderr}` : ""
  ].filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return `, ${parts.join(", ")}`;
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
