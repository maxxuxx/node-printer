import type { NetworkPrinterTarget, RetryOptions } from "@node-printer/core";

export type NormalizedRetryOptions = Required<RetryOptions>;

export type NormalizedNetworkPrinterTarget = Omit<
  Required<NetworkPrinterTarget>,
  "retry"
> & {
  retry: NormalizedRetryOptions;
};

export interface NetworkConnectionOptions {
  host: string;
  port: number;
}

export interface NetworkSocket {
  readonly destroyed: boolean;

  once(event: "connect", listener: () => void): this;
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "drain", listener: () => void): this;
  off(event: "connect", listener: () => void): this;
  off(event: "error", listener: (error: Error) => void): this;
  off(event: "drain", listener: () => void): this;
  write(data: Uint8Array, callback: (error?: Error | null) => void): boolean;
  end(): this;
  destroy(error?: Error): this;
}

export interface NetworkPrinterDependencies {
  createConnection?: (options: NetworkConnectionOptions) => NetworkSocket;
  sleep?: (delayMs: number) => Promise<void>;
}
