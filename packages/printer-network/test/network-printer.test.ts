import { EventEmitter } from "node:events";
import net from "node:net";

import { describe, expect, it } from "vitest";

import { PrinterError } from "@maxxuxx/node-printer-core";

import { createNetworkPrinter } from "../src/index.js";
import type { NetworkSocket } from "../src/types.js";

describe("printer-network", () => {
  it("normalizes default target options", () => {
    const printer = createNetworkPrinter({
      type: "network",
      host: "192.168.0.10"
    });

    expect(printer.target).toMatchObject({
      type     : "network",
      host     : "192.168.0.10",
      port     : 9100,
      timeoutMs: 5000,
      chunkSize: 16 * 1024
    });
  });

  it("throws PrinterError when host is missing", () => {
    expect(() =>
      createNetworkPrinter({
        type: "network",
        host: ""
      })
    ).toThrow(PrinterError);
  });

  it("prints bytes to a local TCP server", async () => {
    const server   = await startTcpServer();
    const printer  = createNetworkPrinter({
      type: "network",
      host: "127.0.0.1",
      port: server.port
    });
    const data     = Uint8Array.from([0x00, 0x1b, 0x1d, 0x0a, 0xff]);
    const result   = await printer.print(data);
    const received = await server.received;

    await server.close();

    expect(result.bytesWritten).toBe(data.byteLength);
    expect(received).toEqual([0x00, 0x1b, 0x1d, 0x0a, 0xff]);
  });

  it("writes data in configured chunks", async () => {
    const sockets = new FakeSocketQueue();
    const printer = createNetworkPrinter(
      {
        type: "network",
        host: "127.0.0.1",
        port: 9100,
        chunkSize: 2
      },
      {
        createConnection: sockets.createConnection
      }
    );

    await printer.print(Uint8Array.from([0x00, 0x1b, 0x1d, 0x0a, 0xff]));

    expect(sockets.items[0]?.writes).toEqual([[0x00, 0x1b], [0x1d, 0x0a], [0xff]]);
  });

  it("normalizes refused connections", async () => {
    const port    = await getUnusedPort();
    const printer = createNetworkPrinter({
      type: "network",
      host: "127.0.0.1",
      port,
      timeoutMs: 500
    });

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code: "ERR_CONNECTION_REFUSED",
      retryable: true
    });
  });

  it("normalizes connect timeouts", async () => {
    const sockets = new FakeSocketQueue({ connect: false });
    const printer = createNetworkPrinter(
      {
        type: "network",
        host: "127.0.0.1",
        port: 9100,
        timeoutMs: 1
      },
      {
        createConnection: sockets.createConnection
      }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code: "ERR_CONNECTION_TIMEOUT",
      retryable: true
    });
  });

  it("normalizes write timeouts", async () => {
    const sockets = new FakeSocketQueue({ write: false });
    const printer = createNetworkPrinter(
      {
        type: "network",
        host: "127.0.0.1",
        port: 9100,
        timeoutMs: 1
      },
      {
        createConnection: sockets.createConnection
      }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code: "ERR_WRITE_TIMEOUT",
      retryable: false
    });
  });

  it("retries retryable connection failures", async () => {
    const sockets = new FakeSocketQueue();
    sockets.nextErrorCode = "ECONNREFUSED";

    const printer = createNetworkPrinter(
      {
        type: "network",
        host: "127.0.0.1",
        port: 9100,
        retry: {
          retries: 1,
          minDelayMs: 1,
          maxDelayMs: 1,
          factor: 1
        }
      },
      {
        createConnection: sockets.createConnection,
        sleep: async () => {}
      }
    );

    const result = await printer.print(Uint8Array.from([1]));

    expect(result.ok).toBe(true);
    expect(sockets.items).toHaveLength(2);
  });

  it("normalizes host not found errors as non-retryable", async () => {
    const sockets = new FakeSocketQueue();
    sockets.nextErrorCode = "ENOTFOUND";

    const printer = createNetworkPrinter(
      {
        type: "network",
        host: "missing.local",
        port: 9100,
        retry: {
          retries: 3,
          minDelayMs: 1,
          maxDelayMs: 1,
          factor: 1
        }
      },
      {
        createConnection: sockets.createConnection,
        sleep: async () => {}
      }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code     : "ERR_HOST_NOT_FOUND",
      retryable: false
    });

    // retryable=false 이므로 재시도 없이 1회만 시도되었다
    expect(sockets.items).toHaveLength(1);
  });

  it("normalizes unreachable network errors as non-retryable", async () => {
    const sockets = new FakeSocketQueue();
    sockets.nextErrorCode = "EHOSTUNREACH";

    const printer = createNetworkPrinter(
      {
        type: "network",
        host: "10.255.255.1",
        port: 9100
      },
      {
        createConnection: sockets.createConnection,
        sleep: async () => {}
      }
    );

    await expect(printer.print(Uint8Array.from([1]))).rejects.toMatchObject({
      code     : "ERR_NETWORK_UNREACHABLE",
      retryable: false
    });
  });

  it("serializes concurrent print calls on the same transport", async () => {
    const sockets = new FakeSocketQueue();
    const printer = createNetworkPrinter(
      {
        type: "network",
        host: "127.0.0.1",
        port: 9100
      },
      {
        createConnection: sockets.createConnection
      }
    );

    const first  = printer.print(Uint8Array.from([1, 2]));
    const second = printer.print(Uint8Array.from([3, 4]));

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    // 두 print 호출이 직렬화되면 socket이 순서대로 두 번 생성되고 데이터도 분리된다
    expect(sockets.items).toHaveLength(2);
    expect(sockets.items[0]?.writes).toEqual([[1, 2]]);
    expect(sockets.items[1]?.writes).toEqual([[3, 4]]);
  });

  it("waits for drain event when backpressure is signaled", async () => {
    const sockets = new FakeSocketQueue({ backpressure: true });
    const printer = createNetworkPrinter(
      {
        type: "network",
        host: "127.0.0.1",
        port: 9100
      },
      {
        createConnection: sockets.createConnection
      }
    );

    const result = await printer.print(Uint8Array.from([1, 2, 3]));

    expect(result.bytesWritten).toBe(3);
    // backpressure 분기에서 drain 이벤트가 발생했음을 표시값으로 확인한다
    expect(sockets.items[0]?.drainEmits).toBeGreaterThan(0);
  });
});

// 실제 TCP 쓰기 경로를 검증하기 위해 임시 로컬 서버를 연다
async function startTcpServer(): Promise<{
  port: number;
  received: Promise<number[]>;
  close: () => Promise<void>;
}> {
  const chunks: number[] = [];
  let resolveReceived: (value: number[]) => void = () => {};

  const received = new Promise<number[]>((resolve) => {
    resolveReceived = resolve;
  });

  const server = net.createServer((socket) => {
    socket.on("data", (chunk: Buffer) => {
      chunks.push(...chunk);
    });
    socket.on("end", () => {
      resolveReceived(chunks);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate TCP server port");
  }

  return {
    port: address.port,
    received,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}

async function getUnusedPort(): Promise<number> {
  const server = await startTcpServer();
  const port   = server.port;

  await server.close();

  return port;
}

interface FakeBehavior {
  connect     ?: boolean;
  write       ?: boolean;
  backpressure?: boolean;
}

// 연결 시도마다 새 FakeSocket을 기록해 retry 횟수와 write 내용을 검증한다
class FakeSocketQueue {
  readonly items: FakeSocket[] = [];
  nextErrorCode?: string;

  constructor(private readonly behavior: FakeBehavior = {}) {}

  // createConnection 주입 지점에서 다음 연결 오류를 한 번만 소비한다
  createConnection = (): NetworkSocket => {
    const socket = new FakeSocket(this.behavior);

    this.items.push(socket);

    if (this.nextErrorCode) {
      socket.connectErrorCode = this.nextErrorCode;
      this.nextErrorCode      = undefined;
    }

    socket.start();

    return socket;
  };
}

// net.Socket 이벤트 흐름을 흉내 내 connect timeout, write timeout, drain 분기를 재현한다
class FakeSocket extends EventEmitter implements NetworkSocket {
  destroyed = false;
  ended     = false;
  writes    : number[][] = [];
  drainEmits = 0;
  connectErrorCode?: string;

  constructor(private readonly behavior: FakeBehavior) {
    super();
  }

  // queueMicrotask로 listener 등록 이후 connect 또는 error 이벤트를 발생시킨다
  start(): void {
    queueMicrotask(() => {
      // 오류 코드가 있으면 Node 소켓 오류처럼 code 값을 붙여 방출한다
      if (this.connectErrorCode) {
        const error = new Error(this.connectErrorCode);

        Object.assign(error, { code: this.connectErrorCode });
        this.emit("error", error);
        return;
      }

      // connect 이벤트를 내지 않아 연결 timeout 분기를 재현한다
      if (this.behavior.connect === false) {
        return;
      }

      this.emit("connect");
    });
  }

  // write 콜백, drain 이벤트, backpressure 반환값으로 분기를 나눈다
  write(data: Uint8Array, callback: (error?: Error | null) => void): boolean {
    this.writes.push(Array.from(data));

    // 콜백과 drain 이벤트를 모두 발생시키지 않아 write timeout 분기를 재현한다
    if (this.behavior.write === false) {
      return false;
    }

    // backpressure 분기는 write false를 먼저 반환하고 다음 tick에 drain 이벤트를 발생시킨다
    if (this.behavior.backpressure === true) {
      queueMicrotask(() => {
        callback();
      });

      queueMicrotask(() => {
        this.drainEmits += 1;
        this.emit("drain");
      });

      return false;
    }

    queueMicrotask(() => {
      callback();
    });

    return true;
  }

  end(): this {
    this.ended = true;

    return this;
  }

  destroy(): this {
    this.destroyed = true;

    return this;
  }
}
