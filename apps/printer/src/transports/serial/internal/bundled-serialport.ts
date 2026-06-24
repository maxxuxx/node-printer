import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { SerialPortStream } from "@serialport/stream";

import { PrinterError } from "#core";

import type { SerialOpenOptions, SerialPortConstructor, SerialPortInfo } from "../types.js";

const require = createRequire(import.meta.url);

const SERIAL_PREBUILD_NAME = "@node-printer+serialport.node";

const DEFAULT_WINDOWS_OPEN_OPTIONS = {
  dataBits: 8,
  lock    : true,
  stopBits: 1,
  parity  : "none",
  rtscts  : false,
  rtsMode : "handshake",
  xon     : false,
  xoff    : false,
  xany    : false,
  hupcl   : true
} as const;

const SERIAL_NUMBER_PATTERNS = [
  /USB\\(?:.+)\\(.+)/,
  /FTDIBUS\\(?:.+)\+(.+?)A?\\.+/
];

// Native binding types

interface NativeSerialBinding {
  close      ?: (fd: number, callback: NativeCallback<void>) => void;
  drain      ?: (fd: number, callback: NativeCallback<void>) => void;
  flush      ?: (fd: number, callback: NativeCallback<void>) => void;
  get        ?: (fd: number, callback: NativeCallback<PortStatus>) => void;
  getBaudRate?: (fd: number, callback: NativeCallback<{ baudRate: number }>) => void;
  list       ?: (callback: NativeCallback<SerialPortInfo[]>) => void;
  open       ?: (path: string, options: RequiredWindowsOpenOptions, callback: NativeCallback<number>) => void;
  read       ?: (
    fd: number,
    buffer: Buffer,
    offset: number,
    length: number,
    callback: NativeCallback<number>
  ) => void;
  set        ?: (fd: number, options: SetOptions, callback: NativeCallback<void>) => void;
  update     ?: (fd: number, options: UpdateOptions, callback: NativeCallback<void>) => void;
  write      ?: (fd: number, buffer: Buffer, callback: NativeCallback<void>) => void;
}

type NativeCallback<TResult> = (error: Error | null, result: TResult) => void;

interface SerialBindingInterface {
  list(): Promise<SerialPortInfo[]>;
  open(options: WindowsOpenOptions): Promise<WindowsPortBinding>;
}

interface SerialBindingPortInterface {
  readonly openOptions: RequiredWindowsOpenOptions;
  readonly isOpen: boolean;

  close(): Promise<void>;
  drain(): Promise<void>;
  flush(): Promise<void>;
  get(): Promise<PortStatus>;
  getBaudRate(): Promise<{ baudRate: number }>;
  read(buffer: Buffer, offset: number, length: number): Promise<{ buffer: Buffer; bytesRead: number }>;
  set(options: SetOptions): Promise<void>;
  update(options: UpdateOptions): Promise<void>;
  write(buffer: Buffer): Promise<void>;
}

interface PortStatus {
  cts: boolean;
  dcd: boolean;
  dsr: boolean;
}

interface SetOptions {
  brk?: boolean;
  cts?: boolean;
  dsr?: boolean;
  dtr?: boolean;
  rts?: boolean;
}

interface UpdateOptions {
  baudRate: number;
}

interface WindowsOpenOptions {
  path    : string;
  baudRate: number;
  dataBits?: SerialOpenOptions["dataBits"];
  lock    ?: boolean;
  parity ?: SerialOpenOptions["parity"];
  stopBits?: SerialOpenOptions["stopBits"];
  rtscts ?: boolean;
  rtsMode?: "handshake" | "enable" | "toggle";
  xon    ?: boolean;
  xoff   ?: boolean;
  xany   ?: boolean;
  hupcl  ?: boolean;
}

type RequiredWindowsOpenOptions = Required<WindowsOpenOptions>;

interface AsyncNativeBinding {
  close      : (fd: number) => Promise<void>;
  drain      : (fd: number) => Promise<void>;
  flush      : (fd: number) => Promise<void>;
  get        : (fd: number) => Promise<PortStatus>;
  getBaudRate: (fd: number) => Promise<{ baudRate: number }>;
  list       : () => Promise<SerialPortInfo[]>;
  open       : (path: string, options: RequiredWindowsOpenOptions) => Promise<number>;
  read       : (fd: number, buffer: Buffer, offset: number, length: number) => Promise<number>;
  set        : (fd: number, options: SetOptions) => Promise<void>;
  update     : (fd: number, options: UpdateOptions) => Promise<void>;
  write      : (fd: number, buffer: Buffer) => Promise<void>;
}

// Public constructor

export class BundledSerialPort
  extends SerialPortStream
  implements InstanceType<SerialPortConstructor>
{
  static list(): Promise<SerialPortInfo[]> {
    return WindowsBinding.list();
  }

  constructor(options: SerialOpenOptions) {
    super({
      binding: WindowsBinding,
      ...options
    } as never);
  }
}

export function getBundledSerialPortConstructor(): SerialPortConstructor {
  assertWindows();

  return BundledSerialPort as unknown as SerialPortConstructor;
}

// Windows binding

const WindowsBinding: SerialBindingInterface = {
  async list(): Promise<SerialPortInfo[]> {
    const ports = await getAsyncBinding().list();

    return ports.map(fillSerialNumber);
  },

  async open(options: WindowsOpenOptions): Promise<WindowsPortBinding> {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }

    if (!options.path) {
      throw new TypeError('"path" is not a valid port');
    }

    if (!options.baudRate) {
      throw new TypeError('"baudRate" is not a valid baudRate');
    }

    const openOptions = {
      ...DEFAULT_WINDOWS_OPEN_OPTIONS,
      ...options
    };

    const fd = await getAsyncBinding().open(openOptions.path, openOptions);

    return new WindowsPortBinding(fd, openOptions);
  }
};

class WindowsPortBinding implements SerialBindingPortInterface {
  writeOperation: Promise<void> | null = null;

  constructor(
    private fd: number | null,
    readonly openOptions: RequiredWindowsOpenOptions
  ) {}

  get isOpen(): boolean {
    return this.fd !== null;
  }

  async close(): Promise<void> {
    const fd = this.requireOpenFd();

    this.fd = null;

    await getAsyncBinding().close(fd);
  }

  async read(
    buffer: Buffer,
    offset: number,
    length: number
  ): Promise<{ buffer: Buffer; bytesRead: number }> {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }

    if (typeof offset !== "number" || Number.isNaN(offset)) {
      throw new TypeError(`"offset" is not an integer got "${Number.isNaN(offset) ? "NaN" : typeof offset}"`);
    }

    if (typeof length !== "number" || Number.isNaN(length)) {
      throw new TypeError(`"length" is not an integer got "${Number.isNaN(length) ? "NaN" : typeof length}"`);
    }

    if (buffer.length < offset + length) {
      throw new Error("buffer is too small");
    }

    const fd = this.requireOpenFd();

    try {
      const bytesRead = await getAsyncBinding().read(fd, buffer, offset, length);

      return { buffer, bytesRead };
    } catch (error) {
      if (!this.isOpen) {
        throw new BundledBindingsError(getErrorMessage(error), { canceled: true });
      }

      throw error;
    }
  }

  async write(buffer: Buffer): Promise<void> {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }

    const fd = this.requireOpenFd();

    this.writeOperation = (async () => {
      if (buffer.length > 0) {
        await getAsyncBinding().write(fd, buffer);
      }

      this.writeOperation = null;
    })();

    return this.writeOperation;
  }

  async update(options: UpdateOptions): Promise<void> {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }

    if (typeof options.baudRate !== "number") {
      throw new TypeError('"options.baudRate" is not a number');
    }

    await getAsyncBinding().update(this.requireOpenFd(), options);
  }

  async set(options: SetOptions): Promise<void> {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }

    await getAsyncBinding().set(this.requireOpenFd(), options);
  }

  async get(): Promise<PortStatus> {
    return getAsyncBinding().get(this.requireOpenFd());
  }

  async getBaudRate(): Promise<{ baudRate: number }> {
    return getAsyncBinding().getBaudRate(this.requireOpenFd());
  }

  async flush(): Promise<void> {
    await getAsyncBinding().flush(this.requireOpenFd());
  }

  async drain(): Promise<void> {
    await this.writeOperation;
    await getAsyncBinding().drain(this.requireOpenFd());
  }

  private requireOpenFd(): number {
    if (this.fd === null) {
      throw new Error("Port is not open");
    }

    return this.fd;
  }
}

// Native loading

let asyncBinding: AsyncNativeBinding | undefined;

function getAsyncBinding(): AsyncNativeBinding {
  asyncBinding ??= createAsyncBinding(loadNativeBinding());

  return asyncBinding;
}

function loadNativeBinding(): NativeSerialBinding {
  assertWindows();

  const prebuildPath = findSerialPrebuild();

  if (!prebuildPath) {
    throw new PrinterError({
      code   : "ERR_NATIVE_MODULE_UNAVAILABLE",
      message: `Serialport prebuild is not available for ${process.platform}-${process.arch}`
    });
  }

  return require(prebuildPath) as NativeSerialBinding;
}

function findSerialPrebuild(): string | null {
  const prebuildDirectory = resolve(
    getPackageRoot(),
    "prebuilds",
    `${process.platform}-${process.arch}`
  );

  let fileNames: string[];

  try {
    fileNames = readdirSync(prebuildDirectory);
  } catch {
    return null;
  }

  return fileNames.includes(SERIAL_PREBUILD_NAME)
    ? resolve(prebuildDirectory, SERIAL_PREBUILD_NAME)
    : null;
}

function getPackageRoot(): string {
  return resolveSerialPackageRoot(dirname(fileURLToPath(import.meta.url)));
}

export function resolveSerialPackageRoot(currentDir: string): string {
  const normalizedCurrentDir = currentDir.replace(/\\/g, "/");
  const sourcePackageRoot    = resolve(currentDir, "..", "..", "..", "..");

  return normalizedCurrentDir.endsWith("/src/transports/serial/internal")
    ? sourcePackageRoot
    : resolve(currentDir, "..");
}

function createAsyncBinding(binding: NativeSerialBinding): AsyncNativeBinding {
  return {
    close      : promisifyNative<[number], void>(binding, "close"),
    drain      : promisifyNative<[number], void>(binding, "drain"),
    flush      : promisifyNative<[number], void>(binding, "flush"),
    get        : promisifyNative<[number], PortStatus>(binding, "get"),
    getBaudRate: promisifyNative<[number], { baudRate: number }>(binding, "getBaudRate"),
    list       : promisifyNative<[], SerialPortInfo[]>(binding, "list"),
    open       : promisifyNative<[string, RequiredWindowsOpenOptions], number>(binding, "open"),
    read       : promisifyNative<[number, Buffer, number, number], number>(binding, "read"),
    set        : promisifyNative<[number, SetOptions], void>(binding, "set"),
    update     : promisifyNative<[number, UpdateOptions], void>(binding, "update"),
    write      : promisifyNative<[number, Buffer], void>(binding, "write")
  };
}

function promisifyNative<TArgs extends unknown[], TResult>(
  binding: NativeSerialBinding,
  methodName: keyof NativeSerialBinding
): (...args: TArgs) => Promise<TResult> {
  const method = binding[methodName];

  if (!method) {
    return async () => {
      throw new Error(`"binding.${String(methodName)}" Method not implemented`);
    };
  }

  return promisify(method.bind(binding)) as (...args: TArgs) => Promise<TResult>;
}

// Helpers

function assertWindows(platform: NodeJS.Platform = process.platform): void {
  if (platform !== "win32") {
    throw new PrinterError({
      code   : "ERR_UNSUPPORTED_PLATFORM",
      message: `Serial printing is not bundled on ${platform}`
    });
  }
}

function fillSerialNumber(port: SerialPortInfo): SerialPortInfo {
  if (!port.pnpId || port.serialNumber) {
    return port;
  }

  const serialNumber = parseSerialNumber(port.pnpId);

  return serialNumber ? { ...port, serialNumber } : port;
}

function parseSerialNumber(pnpId: string): string | null {
  for (const pattern of SERIAL_NUMBER_PATTERNS) {
    const match = pnpId.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class BundledBindingsError extends Error {
  readonly canceled: boolean;

  constructor(message: string, options: { canceled: boolean }) {
    super(message);

    this.canceled = options.canceled;
  }
}
