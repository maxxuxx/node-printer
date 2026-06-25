import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { PrinterError } from "#core";
import type {
  CupsPrinterTarget,
  NetworkPrinterTarget,
  PrinterTarget,
  RetryOptions,
  SerialPrinterTarget,
  WinspoolPrinterTarget
} from "#core";
import type { ReceiptEncoding } from "#core";

// Settings types

export type SavedPrinterType = "usb" | "serial" | "network";

export interface PrinterSettingsConfig {
  filePath: string;
}

export interface ReceiptProfile {
  encoding: ReceiptEncoding;
  columns: number;
}

export interface SavedPrinter {
  id: string;
  name: string;
  type: SavedPrinterType;
  target: PrinterTarget;
  receipt: ReceiptProfile;
}

export type SavePrinterInput =
  | SaveUsbPrinterInput
  | SaveSerialPrinterInput
  | SaveNetworkPrinterInput;

export interface SaveUsbPrinterInput {
  name: string;
  type: "usb";
  printerName: string;
  documentName?: string;
  receipt: ReceiptProfile;
}

export interface SaveSerialPrinterInput extends Omit<SerialPrinterTarget, "type"> {
  name: string;
  type: "serial";
  receipt: ReceiptProfile;
}

export interface SaveNetworkPrinterInput extends Omit<NetworkPrinterTarget, "type"> {
  name: string;
  type: "network";
  receipt: ReceiptProfile;
}

interface PrinterSettingsFile {
  printers: SavedPrinter[];
}

// Settings lifecycle

let settingsFilePath: string | undefined;

export function configurePrinterSettings(config: PrinterSettingsConfig): void {
  if (!config.filePath) {
    throwInvalidSettings("Printer settings filePath is required");
  }

  settingsFilePath = config.filePath;
}

// Saved printers

export async function savePrinter(input: SavePrinterInput): Promise<SavedPrinter> {
  const settings = await readSettingsFile();
  const saved: SavedPrinter = {
    id     : randomUUID(),
    name   : normalizeName(input.name),
    type   : input.type,
    target : createSavedPrinterTarget(input),
    receipt: normalizeReceiptProfile(input.receipt)
  };

  settings.printers.push(saved);
  await writeSettingsFile(settings);

  return saved;
}

export async function listSavedPrinters(): Promise<SavedPrinter[]> {
  return (await readSettingsFile()).printers;
}

export async function getSavedPrinter(id: string): Promise<SavedPrinter | undefined> {
  return (await readSettingsFile()).printers.find((printer) => printer.id === id);
}

export async function removeSavedPrinter(id: string): Promise<void> {
  const settings = await readSettingsFile();

  settings.printers = settings.printers.filter((printer) => printer.id !== id);
  await writeSettingsFile(settings);
}

export async function clearSavedPrinters(): Promise<void> {
  await writeSettingsFile({ printers: [] });
}

// File storage

async function readSettingsFile(): Promise<PrinterSettingsFile> {
  const filePath = getSettingsFilePath();

  try {
    const file = JSON.parse(await readFile(filePath, "utf8")) as Partial<PrinterSettingsFile>;

    return {
      printers: Array.isArray(file.printers) ? file.printers : []
    };
  } catch (error) {
    if (isFileNotFound(error)) {
      return { printers: [] };
    }

    throw error;
  }
}

async function writeSettingsFile(settings: PrinterSettingsFile): Promise<void> {
  const filePath = getSettingsFilePath();

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function getSettingsFilePath(): string {
  if (!settingsFilePath) {
    throw new PrinterError({
      code   : "ERR_PRINTER_SETTINGS_NOT_CONFIGURED",
      message: "Printer settings filePath is not configured"
    });
  }

  return settingsFilePath;
}

// Input conversion

function createSavedPrinterTarget(input: SavePrinterInput): PrinterTarget {
  switch (input.type) {
    case "usb":
      return createUsbTarget(input);

    case "serial":
      return createSerialTarget(input);

    case "network":
      return createNetworkTarget(input);
  }
}

function createUsbTarget(input: SaveUsbPrinterInput): CupsPrinterTarget | WinspoolPrinterTarget {
  const printerName  = normalizeText(input.printerName, "USB printerName");
  const documentName = input.documentName;

  if (process.platform === "win32") {
    return {
      type: "winspool",
      printerName,
      ...(documentName === undefined ? {} : { documentName })
    };
  }

  if (process.platform === "darwin" || process.platform === "linux") {
    return {
      type: "cups",
      printerName,
      ...(documentName === undefined ? {} : { documentName })
    };
  }

  throw new PrinterError({
    code   : "ERR_UNSUPPORTED_PLATFORM",
    message: `USB printer settings are not supported on ${process.platform}`
  });
}

function createSerialTarget(input: SaveSerialPrinterInput): SerialPrinterTarget {
  const { name, type, receipt, path, ...options } = input;

  void name;
  void type;
  void receipt;

  return {
    type: "serial",
    path: normalizeText(path, "Serial path"),
    ...options
  };
}

function createNetworkTarget(input: SaveNetworkPrinterInput): NetworkPrinterTarget {
  const { name, type, receipt, host, retry, ...options } = input;

  void name;
  void type;
  void receipt;

  return {
    type: "network",
    host: normalizeText(host, "Network host"),
    ...(retry === undefined ? {} : { retry: normalizeRetry(retry) }),
    ...options
  };
}

// Validation

function normalizeName(value: string): string {
  return normalizeText(value, "Printer name");
}

function normalizeReceiptProfile(receipt: ReceiptProfile): ReceiptProfile {
  if (!receipt) {
    throwInvalidSettings("Receipt profile is required");
  }

  if (!receipt.encoding) {
    throwInvalidSettings("Receipt encoding is required");
  }

  if (
    !Number.isInteger(receipt.columns) ||
    receipt.columns < 1 ||
    receipt.columns > 255
  ) {
    throwInvalidSettings("Receipt columns must be an integer between 1 and 255");
  }

  return {
    encoding: receipt.encoding,
    columns : receipt.columns
  };
}

function normalizeText(value: string, name: string): string {
  const text = value.trim();

  if (!text) {
    throwInvalidSettings(`${name} is required`);
  }

  return text;
}

function normalizeRetry(retry: RetryOptions): RetryOptions {
  return {
    retries    : retry.retries,
    minDelayMs : retry.minDelayMs,
    maxDelayMs : retry.maxDelayMs,
    factor     : retry.factor
  };
}

function throwInvalidSettings(message: string): never {
  throw new PrinterError({
    code: "ERR_INVALID_PRINTER_SETTINGS",
    message
  });
}

function isFileNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
