import type { SerialPrinterTarget } from "#core";

export interface SerialPortInfo {
  path         : string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId       ?: string;
  locationId  ?: string;
  productId   ?: string;
  vendorId    ?: string;
}

export interface SerialPrintOptions {
  timeoutMs?: number;
}

export interface SerialPrinterDependencies {
  SerialPort?: SerialPortConstructor;
  listPorts ?: () => Promise<SerialPortInfo[]>;
}

export interface SerialPortConstructor {
  new (options: SerialOpenOptions): SerialPortConnection;
  list()                          : Promise<SerialPortInfo[]>;
}

export interface SerialOpenOptions {
  path     : string;
  baudRate : number;
  autoOpen : false;
  dataBits : 5 | 6 | 7 | 8;
  stopBits : 1 | 1.5 | 2;
  parity   : "none" | "even" | "odd" | "mark" | "space";
  rtscts  ?: boolean;
  xon     ?: boolean;
  xoff    ?: boolean;
}

export interface SerialPortConnection {
  readonly isOpen?: boolean;

  open  (callback: SerialCallback)                  : void;
  write (data: Uint8Array, callback: SerialCallback): void;
  drain (callback: SerialCallback)                  : void;
  close (callback: SerialCallback)                  : void;

  // 상태 조회 응답을 읽기 위한 data 이벤트 구독입니다 (serialport 스트림 제공)
  on  ?(event: "data", listener: (chunk: Uint8Array) => void): unknown;
  off ?(event: "data", listener: (chunk: Uint8Array) => void): unknown;
}

export type SerialCallback = (error?: Error | null) => void;

export type SerialPrinter = {
  readonly target: SerialPrinterTarget;
  print(data: Uint8Array): Promise<{
    ok          : true;
    target      : SerialPrinterTarget;
    bytesWritten: number;
    durationMs  : number;
  }>;
  close(): Promise<void>;
};
