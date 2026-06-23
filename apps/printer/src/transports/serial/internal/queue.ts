const serialPathQueues = new Map<string, Promise<void>>();

// Per-path queue

export function enqueueSerialOperation<T>(path: string, run: () => Promise<T>): Promise<T> {
  const key       = toQueuePath(path);
  const previous  = serialPathQueues.get(key) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(run);
  const tail      = operation.then(() => undefined, () => undefined);

  serialPathQueues.set(key, tail);
  void tail.finally(() => {
    if (serialPathQueues.get(key) === tail) {
      serialPathQueues.delete(key);
    }
  });

  return operation;
}

function toQueuePath(path: string): string {
  const normalized = path.trim();

  if (process.platform !== "win32") {
    return normalized;
  }

  return normalized
    .replace(/^\\\\\.\\/u, "")
    .replace(/:$/u, "")
    .toUpperCase();
}
