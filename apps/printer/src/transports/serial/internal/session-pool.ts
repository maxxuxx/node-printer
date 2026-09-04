import type { SerialPortConstructor } from "../types.js";
import { enqueueSerialOperation, toQueuePath } from "./queue.js";
import { SerialSession } from "./session.js";
import type { NormalizedSerialPrinterTarget } from "./target.js";

type SessionRecord = {
  session: SerialSession;
  timer  ?: ReturnType<typeof setTimeout>;
};

const pools = new Set<SerialSessionPool>();
const poolsByConstructor = new WeakMap<SerialPortConstructor, SerialSessionPool>();

export class SerialSessionPool {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor() {
    pools.add(this);
  }

  async acquire(
    target: NormalizedSerialPrinterTarget,
    SerialPort: SerialPortConstructor
  ): Promise<SerialSession> {
    const key      = toQueuePath(target.path);
    const existing = this.sessions.get(key);

    if (existing) {
      clearRecordTimer(existing);

      if (existing.session.matches(target, SerialPort)) {
        return existing.session;
      }

      await existing.session.close();
      this.sessions.delete(key);
    }

    const session = new SerialSession(target, SerialPort);
    this.sessions.set(key, { session });
    return session;
  }

  deferClose(path: string, delayMs: number): void {
    const key    = toQueuePath(path);
    const record = this.sessions.get(key);

    if (!record) {
      return;
    }

    clearRecordTimer(record);
    record.timer = setTimeout(() => {
      void enqueueSerialOperation(path, async () => {
        if (this.sessions.get(key) !== record) {
          return;
        }

        this.sessions.delete(key);
        await record.session.close();
      }).catch(() => undefined);
    }, delayMs);
    record.timer.unref?.();
  }

  async invalidate(path: string): Promise<void> {
    const key    = toQueuePath(path);
    const record = this.sessions.get(key);

    if (!record) {
      return;
    }

    clearRecordTimer(record);
    this.sessions.delete(key);
    await record.session.close();
  }

  close(path: string): Promise<void> {
    return enqueueSerialOperation(path, () => this.invalidate(path));
  }

  async closeAll(): Promise<void> {
    const paths = [...this.sessions.values()].map((record) => record.session.target.path);
    await Promise.all(paths.map((path) => this.close(path)));
  }
}

export function getSerialSessionPool(SerialPort: SerialPortConstructor): SerialSessionPool {
  const existing = poolsByConstructor.get(SerialPort);

  if (existing) {
    return existing;
  }

  const pool = new SerialSessionPool();
  poolsByConstructor.set(SerialPort, pool);
  return pool;
}

export async function closeAllSerialSessions(): Promise<void> {
  await Promise.all([...pools].map((pool) => pool.closeAll()));
}

function clearRecordTimer(record: SessionRecord): void {
  if (record.timer) {
    clearTimeout(record.timer);
    record.timer = undefined;
  }
}
