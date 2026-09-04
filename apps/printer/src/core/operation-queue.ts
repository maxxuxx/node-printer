import type { PrinterTarget } from "./types.js";
import { getPrinterEndpointKey } from "./endpoint-key.js";

const endpointQueues = new Map<string, Promise<void>>();

export function enqueuePrinterOperation<T>(
  target: PrinterTarget,
  run: () => Promise<T>
): Promise<T> {
  const key       = getPrinterEndpointKey(target);
  const previous  = endpointQueues.get(key) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(run);
  const tail      = operation.then(() => undefined, () => undefined);

  endpointQueues.set(key, tail);
  void tail.finally(() => {
    if (endpointQueues.get(key) === tail) {
      endpointQueues.delete(key);
    }
  });

  return operation;
}
