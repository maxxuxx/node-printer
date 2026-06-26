import type { NetworkPrinterTarget, RetryOptions } from "#core";

export interface NetworkInterfaceEntry {
  address : string;
  family  : string;
  internal: boolean;
}

export type NetworkInterfaceMap = Record<string, NetworkInterfaceEntry[] | undefined>;

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

export interface NetworkPrinterInfo {
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
  off(event: "data", listener: (chunk: Uint8Array) => void): this;
  write(data: Uint8Array, callback: (error?: Error | null) => void): boolean;
  end(): this;
  destroy(error?: Error): this;

  // 상태 조회 응답을 읽기 위한 data 이벤트 구독입니다 (node net.Socket 제공)
  on?(event: "data", listener: (chunk: Uint8Array) => void): unknown;
}

export interface NetworkPrinterDependencies {
  createConnection     ?: (options: NetworkConnectionOptions) => NetworkSocket;
  discoveryConcurrency?: number;
  discoveryHosts      ?: string[];
  discoveryPort       ?: number;
  discoveryTimeoutMs  ?: number;
  getNetworkInterfaces?: () => NetworkInterfaceMap;
  isPortOpen          ?: NetworkPortProbe;
  sleep               ?: (delayMs: number) => Promise<void>;
}

export type NetworkPortProbe = (
  host: string,
  port: number,
  timeoutMs: number
) => Promise<boolean>;
