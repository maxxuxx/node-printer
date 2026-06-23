import { PrinterError } from "#core";

// Callback adapters

export function callbackToPromise(
  run: (done: (error?: Error | null) => void) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      run((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function withSerialTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new PrinterError({
          code     : "ERR_SERIAL_TIMEOUT",
          message  : `Serial ${operation} timed out after ${timeoutMs}ms`,
          retryable: operation !== "write"
        })
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}
