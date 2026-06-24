import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { read, readdirSync, write } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { SerialPortStream } from "@serialport/stream";

import { PrinterError } from "#core";

import type { SerialOpenOptions, SerialPortConstructor, SerialPortInfo } from "../types.js";

const require = createRequire(import.meta.url);

const SERIAL_PREBUILD_PREFIX = "@node-printer+serialport";
const SERIAL_PREBUILD_NAME   = `${SERIAL_PREBUILD_PREFIX}.node`;

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

const DEFAULT_UNIX_OPEN_OPTIONS = {
  vmin    : 1,
  vtime   : 0,
  dataBits: 8,
  lock    : true,
  stopBits: 1,
  parity  : "none",
  rtscts  : false,
  xon     : false,
  xoff    : false,
  xany    : false,
  hupcl   : true
} as const;

const POLLER_EVENTS = {
  UV_READABLE  : 0b0001,
  UV_WRITABLE  : 0b0010,
  UV_DISCONNECT: 0b0100
} as const;

const SERIAL_NUMBER_PATTERNS = [
  /USB\\(?:.+)\\(.+)/,
  /FTDIBUS\\(?:.+)\+(.+?)A?\\.+/
];

const LINUX_VENDOR_PROPS = new Map<string, keyof SerialPortInfo>([
  ["DEVNAME", "path"],
  ["ID_VENDOR_ENC", "manufacturer"],
  ["ID_SERIAL_SHORT", "serialNumber"],
  ["ID_VENDOR_ID", "vendorId"],
  ["ID_MODEL_ID", "productId"],
  ["DEVLINKS", "pnpId"],
  ["ID_USB_VENDOR_ENC", "manufacturer"],
  ["ID_USB_SERIAL_SHORT", "serialNumber"],
  ["ID_USB_VENDOR_ID", "vendorId"],
  ["ID_USB_MODEL_ID", "productId"]
]);

// Native binding types

interface NativeSerialBinding {
  Poller     ?: NativePollerConstructor;
  close      ?: (fd: number, callback: NativeCallback<void>) => void;
  drain      ?: (fd: number, callback: NativeCallback<void>) => void;
  flush      ?: (fd: number, callback: NativeCallback<void>) => void;
  get        ?: (fd: number, callback: NativeCallback<PortStatus>) => void;
  getBaudRate?: (fd: number, callback: NativeCallback<{ baudRate: number }>) => void;
  list       ?: (callback: NativeCallback<SerialPortInfo[]>) => void;
  open       ?: (path: string, options: RequiredSerialOpenOptions, callback: NativeCallback<number>) => void;
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

type NativePollerCallback = (error: Error | null, eventFlag: number) => void;

interface NativePoller {
  destroy(): void;
  poll(eventFlag: number): void;
  stop(): void;
}

type NativePollerConstructor = new (fd: number, callback: NativePollerCallback) => NativePoller;

interface SerialBindingInterface {
  list(): Promise<SerialPortInfo[]>;
  open(options: WindowsOpenOptions | UnixOpenOptions): Promise<SerialBindingPortInterface>;
}

interface SerialBindingPortInterface {
  readonly openOptions: RequiredSerialOpenOptions;
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

interface UnixOpenOptions extends Omit<WindowsOpenOptions, "rtsMode"> {
  vmin ?: number;
  vtime?: number;
}

type RequiredUnixOpenOptions = Required<UnixOpenOptions>;
type RequiredSerialOpenOptions = RequiredWindowsOpenOptions | RequiredUnixOpenOptions;
type NativeSerialMethodName = Exclude<keyof NativeSerialBinding, "Poller">;

type SerialPlatformBindingKind = "windows" | "darwin" | "linux";
type SerialLibc = "glibc" | "musl";

interface SerialPrebuildSearchTarget {
  platform: NodeJS.Platform;
  arch    : NodeJS.Architecture;
  libc   ?: SerialLibc;
}

interface SerialPrebuildSearch {
  directories: string[];
  fileNames  : string[];
}

interface UnixBindingPort {
  fd: number | null;
  readonly isOpen: boolean;
  readonly poller: UnixPoller;
}

interface AsyncNativeBinding {
  close      : (fd: number) => Promise<void>;
  drain      : (fd: number) => Promise<void>;
  flush      : (fd: number) => Promise<void>;
  get        : (fd: number) => Promise<PortStatus>;
  getBaudRate: (fd: number) => Promise<{ baudRate: number }>;
  list       : () => Promise<SerialPortInfo[]>;
  open       : (path: string, options: RequiredSerialOpenOptions) => Promise<number>;
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
    return getPlatformBinding().list();
  }

  constructor(options: SerialOpenOptions) {
    super({
      binding: getPlatformBinding(),
      ...options
    } as never);
  }
}

export function getBundledSerialPortConstructor(): SerialPortConstructor {
  assertSupportedSerialPlatform();

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

// Platform bindings

function getPlatformBinding(): SerialBindingInterface {
  switch (getSerialPlatformBindingKind()) {
    case "windows":
      return WindowsBinding;
    case "darwin":
      return DarwinBinding;
    case "linux":
      return LinuxBinding;
  }
}

export function getSerialPlatformBindingKind(
  platform: NodeJS.Platform = process.platform
): SerialPlatformBindingKind {
  if (platform === "win32") {
    return "windows";
  }

  if (platform === "darwin") {
    return "darwin";
  }

  if (platform === "linux" || platform === "android") {
    return "linux";
  }

  throw new PrinterError({
    code   : "ERR_UNSUPPORTED_PLATFORM",
    message: `Serial printing is not bundled on ${platform}`
  });
}

const DarwinBinding: SerialBindingInterface = {
  list(): Promise<SerialPortInfo[]> {
    return getAsyncBinding().list();
  },

  open(options: UnixOpenOptions): Promise<SerialBindingPortInterface> {
    return openUnixPort(options);
  }
};

const LinuxBinding: SerialBindingInterface = {
  list(): Promise<SerialPortInfo[]> {
    return listLinuxPorts();
  },

  open(options: UnixOpenOptions): Promise<SerialBindingPortInterface> {
    return openUnixPort(options);
  }
};

async function openUnixPort(options: UnixOpenOptions): Promise<UnixPortBinding> {
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
    ...DEFAULT_UNIX_OPEN_OPTIONS,
    ...options
  };

  const fd = await getAsyncBinding().open(openOptions.path, openOptions);

  return new UnixPortBinding(fd, openOptions);
}

class UnixPortBinding implements SerialBindingPortInterface, UnixBindingPort {
  fd: number | null;
  readonly poller: UnixPoller;
  writeOperation: Promise<void> | null = null;

  constructor(
    fd: number,
    readonly openOptions: RequiredUnixOpenOptions
  ) {
    this.fd     = fd;
    this.poller = new UnixPoller(fd);
  }

  get isOpen(): boolean {
    return this.fd !== null;
  }

  async close(): Promise<void> {
    const fd = this.requireOpenFd();

    this.poller.stop();
    this.poller.destroy();
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

    return readUnixPort(this, buffer, offset, length);
  }

  async write(buffer: Buffer): Promise<void> {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }

    this.requireOpenFd();

    this.writeOperation = (async () => {
      if (buffer.length > 0) {
        await writeUnixPort(this, buffer);
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
    if (process.platform === "darwin") {
      throw new Error("getBaudRate is not implemented on darwin");
    }

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

let nativeBinding: NativeSerialBinding | undefined;
let asyncBinding: AsyncNativeBinding | undefined;

function getAsyncBinding(): AsyncNativeBinding {
  asyncBinding ??= createAsyncBinding(getNativeBinding());

  return asyncBinding;
}

function getNativeBinding(): NativeSerialBinding {
  nativeBinding ??= loadNativeBinding();

  return nativeBinding;
}

function loadNativeBinding(): NativeSerialBinding {
  assertSupportedSerialPlatform();

  const prebuildPaths = findSerialPrebuilds();

  if (prebuildPaths.length === 0) {
    throw new PrinterError({
      code   : "ERR_NATIVE_MODULE_UNAVAILABLE",
      message: `Serialport prebuild is not available for ${process.platform}-${process.arch}`
    });
  }

  let loadError: unknown;

  for (const prebuildPath of prebuildPaths) {
    try {
      return require(prebuildPath) as NativeSerialBinding;
    } catch (error) {
      loadError = error;
    }
  }

  throw new PrinterError({
    code   : "ERR_NATIVE_MODULE_UNAVAILABLE",
    message: `Serialport prebuild failed to load for ${process.platform}-${process.arch}`,
    cause  : loadError
  });
}

function findSerialPrebuilds(): string[] {
  const prebuildSearch = getSerialPrebuildSearch();
  const prebuildPaths   : string[] = [];

  for (const directory of prebuildSearch.directories) {
    const prebuildDirectory = resolve(getPackageRoot(), "prebuilds", directory);
    let fileNames: string[];

    try {
      fileNames = readdirSync(prebuildDirectory);
    } catch {
      continue;
    }

    for (const fileName of prebuildSearch.fileNames) {
      if (fileNames.includes(fileName)) {
        prebuildPaths.push(resolve(prebuildDirectory, fileName));
      }
    }
  }

  return prebuildPaths;
}

export function getSerialPrebuildSearch(
  target: SerialPrebuildSearchTarget = {
    platform: process.platform,
    arch    : process.arch
  }
): SerialPrebuildSearch {
  return {
    directories: getSerialPrebuildDirectories(target),
    fileNames  : getSerialPrebuildFileNames(target)
  };
}

function getSerialPrebuildDirectories(target: SerialPrebuildSearchTarget): string[] {
  if (target.platform === "darwin" && (target.arch === "arm64" || target.arch === "x64")) {
    return [`darwin-${target.arch}`, "darwin-x64+arm64"];
  }

  return [`${target.platform}-${target.arch}`];
}

function getSerialPrebuildFileNames(target: SerialPrebuildSearchTarget): string[] {
  const serialPrebuild = (suffix: string): string => `${SERIAL_PREBUILD_PREFIX}${suffix}.node`;

  if (target.platform === "linux") {
    return [
      ...getLibcPrebuildSuffixes(target).map(serialPrebuild),
      SERIAL_PREBUILD_NAME
    ];
  }

  if (target.platform === "android") {
    if (target.arch === "arm64") {
      return [serialPrebuild(".armv8"), SERIAL_PREBUILD_NAME];
    }

    if (target.arch === "arm") {
      return [serialPrebuild(".armv7"), SERIAL_PREBUILD_NAME];
    }
  }

  return [SERIAL_PREBUILD_NAME];
}

function getLibcPrebuildSuffixes(target: SerialPrebuildSearchTarget): string[] {
  const libcList = target.libc ? [target.libc] : ["glibc", "musl"] satisfies SerialLibc[];

  if (target.arch === "arm64") {
    return libcList.flatMap((libc) => [`.armv8.${libc}`]);
  }

  if (target.arch === "arm") {
    return libcList.flatMap((libc) => [`.armv7.${libc}`, `.armv6.${libc}`]);
  }

  return libcList.map((libc) => `.${libc}`);
}

function getPackageRoot(): string {
  return resolveSerialPackageRoot(
    dirname(fileURLToPath(import.meta.url)),
    () => require.resolve("@maxxuxx/node-printer")
  );
}

type PackageEntryResolver = () => string;

export function resolveSerialPackageRoot(
  currentDir: string,
  resolvePackageEntry?: PackageEntryResolver
): string {
  if (isSourceSerialDirectory(currentDir)) {
    return resolve(currentDir, "..", "..", "..", "..");
  }

  const installedPackageRoot = resolveInstalledPackageRoot(resolvePackageEntry);

  return installedPackageRoot ?? resolve(currentDir, "..");
}

function resolveInstalledPackageRoot(resolvePackageEntry?: PackageEntryResolver): string | null {
  if (!resolvePackageEntry) {
    return null;
  }

  try {
    return resolve(dirname(resolvePackageEntry()), "..");
  } catch {
    return null;
  }
}

function isSourceSerialDirectory(currentDir: string): boolean {
  return currentDir.replace(/\\/g, "/").endsWith("/src/transports/serial/internal");
}

function createAsyncBinding(binding: NativeSerialBinding): AsyncNativeBinding {
  return {
    close      : promisifyNative<[number], void>(binding, "close"),
    drain      : promisifyNative<[number], void>(binding, "drain"),
    flush      : promisifyNative<[number], void>(binding, "flush"),
    get        : promisifyNative<[number], PortStatus>(binding, "get"),
    getBaudRate: promisifyNative<[number], { baudRate: number }>(binding, "getBaudRate"),
    list       : promisifyNative<[], SerialPortInfo[]>(binding, "list"),
    open       : promisifyNative<[string, RequiredSerialOpenOptions], number>(binding, "open"),
    read       : promisifyNative<[number, Buffer, number, number], number>(binding, "read"),
    set        : promisifyNative<[number, SetOptions], void>(binding, "set"),
    update     : promisifyNative<[number, UpdateOptions], void>(binding, "update"),
    write      : promisifyNative<[number, Buffer], void>(binding, "write")
  };
}

function promisifyNative<TArgs extends unknown[], TResult>(
  binding: NativeSerialBinding,
  methodName: NativeSerialMethodName
): (...args: TArgs) => Promise<TResult> {
  const method = binding[methodName] as ((...args: unknown[]) => void) | undefined;

  if (!method) {
    return async () => {
      throw new Error(`"binding.${String(methodName)}" Method not implemented`);
    };
  }

  return promisify(method.bind(binding)) as (...args: TArgs) => Promise<TResult>;
}

// Unix helpers

const readAsync = promisify(read) as (
  fd: number,
  buffer: Buffer,
  offset: number,
  length: number,
  position: number | null
) => Promise<{ bytesRead: number; buffer: Buffer }>;

const writeAsync = promisify(write) as (
  fd: number,
  buffer: Buffer,
  offset: number,
  length: number
) => Promise<{ bytesWritten: number; buffer: Buffer }>;

class UnixPoller extends EventEmitter {
  private readonly poller: NativePoller;

  constructor(fd: number) {
    super();

    const NativePoller = getNativePollerConstructor();

    this.poller = new NativePoller(fd, (error, eventFlag) => this.handleEvent(error, eventFlag));
  }

  stop(): void {
    this.poller.stop();
    this.emitCanceled();
  }

  destroy(): void {
    this.poller.destroy();
    this.emitCanceled();
  }

  waitFor(eventName: "readable" | "writable" | "disconnect"): Promise<void> {
    this.poller.poll(POLLER_EVENTS[eventName === "readable"
      ? "UV_READABLE"
      : eventName === "writable"
        ? "UV_WRITABLE"
        : "UV_DISCONNECT"]);

    return new Promise((resolvePromise, rejectPromise) => {
      this.once(eventName, (error: Error | null) => {
        if (error) {
          rejectPromise(error);
          return;
        }

        resolvePromise();
      });
    });
  }

  private handleEvent(error: Error | null, eventFlag: number): void {
    if (error) {
      this.emit("readable", error);
      this.emit("writable", error);
      this.emit("disconnect", error);
      return;
    }

    if (eventFlag & POLLER_EVENTS.UV_READABLE) {
      this.emit("readable", null);
    }

    if (eventFlag & POLLER_EVENTS.UV_WRITABLE) {
      this.emit("writable", null);
    }

    if (eventFlag & POLLER_EVENTS.UV_DISCONNECT) {
      this.emit("disconnect", null);
    }
  }

  private emitCanceled(): void {
    const error = new BundledBindingsError("Canceled", { canceled: true });

    this.emit("readable", error);
    this.emit("writable", error);
    this.emit("disconnect", error);
  }
}

async function readUnixPort(
  binding: UnixBindingPort,
  buffer: Buffer,
  offset: number,
  length: number
): Promise<{ buffer: Buffer; bytesRead: number }> {
  if (!binding.isOpen || binding.fd === null) {
    throw new BundledBindingsError("Port is not open", { canceled: true });
  }

  try {
    const result = await readAsync(binding.fd, buffer, offset, length, null);

    if (result.bytesRead === 0) {
      return readUnixPort(binding, buffer, offset, length);
    }

    return result;
  } catch (error) {
    if (isRetryableUnixError(error)) {
      if (!binding.isOpen) {
        throw new BundledBindingsError("Port is not open", { canceled: true });
      }

      await binding.poller.waitFor("readable");

      return readUnixPort(binding, buffer, offset, length);
    }

    throw markDisconnectError(error);
  }
}

async function writeUnixPort(
  binding: UnixBindingPort,
  buffer: Buffer,
  offset = 0
): Promise<void> {
  if (!binding.isOpen || binding.fd === null) {
    throw new Error("Port is not open");
  }

  try {
    const bytesToWrite = buffer.length - offset;
    const result       = await writeAsync(binding.fd, buffer, offset, bytesToWrite);

    if (result.bytesWritten + offset < buffer.length) {
      if (!binding.isOpen) {
        throw new Error("Port is not open");
      }

      await writeUnixPort(binding, buffer, result.bytesWritten + offset);
    }
  } catch (error) {
    if (isRetryableUnixError(error)) {
      if (!binding.isOpen) {
        throw new Error("Port is not open", { cause: error });
      }

      await binding.poller.waitFor("writable");
      await writeUnixPort(binding, buffer, offset);
      return;
    }

    throw markDisconnectError(error);
  }
}

function getNativePollerConstructor(): NativePollerConstructor {
  const NativePoller = getNativeBinding().Poller;

  if (!NativePoller) {
    throw new Error('"binding.Poller" Method not implemented');
  }

  return NativePoller;
}

// Helpers

function assertSupportedSerialPlatform(platform: NodeJS.Platform = process.platform): void {
  getSerialPlatformBindingKind(platform);
}

function listLinuxPorts(): Promise<SerialPortInfo[]> {
  const udevadm = spawn("udevadm", ["info", "-e"]);
  let stdout    = "";

  return new Promise((resolvePromise, rejectPromise) => {
    udevadm.stdout?.setEncoding("utf8");
    udevadm.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    udevadm.stderr?.resume();
    udevadm.on("error", rejectPromise);
    udevadm.on("close", (code) => {
      if (code) {
        rejectPromise(new Error(`Error listing ports udevadm exited with error code: ${code}`));
        return;
      }

      resolvePromise(parseLinuxPortList(stdout));
    });
  });
}

function parseLinuxPortList(output: string): SerialPortInfo[] {
  const ports: SerialPortInfo[] = [];
  let skipPort                  = false;
  let port                      = createLinuxPortInfo();

  for (const line of output.split(/\r?\n/u)) {
    const lineType = line.slice(0, 1);
    const data     = line.slice(3);

    if (lineType === "P") {
      port     = createLinuxPortInfo();
      skipPort = false;
      continue;
    }

    if (skipPort) {
      continue;
    }

    if (lineType === "N") {
      if (isLinuxSerialDevicePath(data)) {
        ports.push(port);
      } else {
        skipPort = true;
      }

      continue;
    }

    if (lineType === "E") {
      applyLinuxPortProperty(port, data);
    }
  }

  return ports;
}

function createLinuxPortInfo(): SerialPortInfo {
  return {
    path        : "",
    manufacturer: undefined,
    serialNumber: undefined,
    pnpId       : undefined,
    locationId  : undefined,
    vendorId    : undefined,
    productId   : undefined
  };
}

function isLinuxSerialDevicePath(path: string): boolean {
  return /(tty(S|WCH|ACM|USB|AMA|MFD|O|XRUSB)|rfcomm)/u.test(path);
}

function applyLinuxPortProperty(port: SerialPortInfo, data: string): void {
  const keyValue = data.match(/^(.+)=(.*)/u);

  if (!keyValue) {
    return;
  }

  const [, rawName, rawValue] = keyValue;

  if (!rawName || rawValue === undefined) {
    return;
  }

  const propertyName = LINUX_VENDOR_PROPS.get(rawName.toUpperCase());

  if (!propertyName) {
    return;
  }

  const propertyValue = getLinuxPortPropertyValue(propertyName, rawValue);

  if (propertyValue !== undefined) {
    port[propertyName] = propertyValue;
  }
}

function getLinuxPortPropertyValue(propertyName: keyof SerialPortInfo, value: string): string | undefined {
  if (propertyName === "pnpId") {
    return value.match(/\/by-id\/([^\s]+)/u)?.[1];
  }

  if (propertyName === "manufacturer") {
    return decodeHexEscape(value);
  }

  return value.startsWith("0x") ? value.slice(2) : value;
}

function decodeHexEscape(value: string): string {
  return value.replace(/\\x([a-fA-F0-9]{2})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
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

function isRetryableUnixError(error: unknown): boolean {
  const code = getErrorCode(error);

  return code === "EAGAIN" || code === "EWOULDBLOCK" || code === "EINTR";
}

function markDisconnectError(error: unknown): unknown {
  if (typeof error !== "object" || error === null) {
    return error;
  }

  const code  = getErrorCode(error);
  const errno = "errno" in error ? error.errno : undefined;

  if (code === "EBADF" || code === "ENXIO" || code === "UNKNOWN" || errno === -1) {
    Object.assign(error, { disconnect: true });
  }

  return error;
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

class BundledBindingsError extends Error {
  readonly canceled: boolean;

  constructor(message: string, options: { canceled: boolean }) {
    super(message);

    this.canceled = options.canceled;
  }
}
