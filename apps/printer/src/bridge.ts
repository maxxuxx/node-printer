import {
  createReceipt as createCoreReceipt,
  PrinterError,
  type CutMode,
  type PrinterTarget,
  type PrintResult,
  type ReceiptAmountOptions,
  type ReceiptBarcodeOptions,
  type ReceiptBuilder,
  type ReceiptCashDrawerOptions,
  type ReceiptColumn,
  type ReceiptColumnsOptions,
  type ReceiptDividerOptions,
  type ReceiptEncoding,
  type ReceiptFont,
  type ReceiptImageInput,
  type ReceiptImageOptions,
  type ReceiptItem,
  type ReceiptItemsOptions,
  type ReceiptKeyValueOptions,
  type ReceiptLeftRightOptions,
  type ReceiptQrOptions,
  type ReceiptSectionOptions,
  type ReceiptStyleOptions,
  type ReceiptTableOptions,
  type ReceiptTextOptions,
  type ReceiptTitleOptions,
  type ReceiptTotalRow,
  type ReceiptTotalsOptions,
  type ReceiptTruncateOptions,
  type ReceiptWrapOptions,
  type TextAlign
} from "#core";

import { listPrinters } from "./api/list-printers.js";
import { print } from "./api/print.js";
import {
  clearSavedPrinters,
  getSavedPrinter,
  listSavedPrinters,
  removeSavedPrinter,
  savePrinter,
  type SavedPrinter,
  type SavePrinterInput
} from "./api/printer-settings.js";
import type { ListPrinterType, PrinterListResult, PrinterMethodOptions } from "./api/types.js";

// Bridge types

export const PRINTER_BRIDGE_NAME = "nodePrinter";

export type PrinterBridgeData = Uint8Array | number[];
export type PrinterIdInput    = string | string[];

export interface PrinterBridge {
  listPrinters<TType extends ListPrinterType>(
    type: TType
  ): Promise<PrinterListResult<TType>>;
  savePrinter(input: SavePrinterInput): Promise<SavedPrinter>;
  listSavedPrinters(): Promise<SavedPrinter[]>;
  getSavedPrinter(id: string): Promise<SavedPrinter | undefined>;
  removeSavedPrinter(id: string): Promise<void>;
  clearSavedPrinters(): Promise<void>;
  createReceipt(printerIds: PrinterIdInput): PrinterBridgeReceipt;
  print(target: PrinterTarget, data: PrinterBridgeData): Promise<PrintResult>;
}

export interface PrinterBridgeReceipt {
  initialize(): PrinterBridgeReceipt;
  text(value: string, options?: ReceiptTextOptions): PrinterBridgeReceipt;
  line(value: string, options?: Omit<ReceiptTextOptions, "newLine">): PrinterBridgeReceipt;
  row(columns: ReceiptColumn[]): PrinterBridgeReceipt;
  divider(options?: string | ReceiptDividerOptions): PrinterBridgeReceipt;
  blank(lines?: number): PrinterBridgeReceipt;
  wrap(value: string, options?: ReceiptWrapOptions): PrinterBridgeReceipt;
  truncate(value: string, options?: ReceiptTruncateOptions): PrinterBridgeReceipt;
  leftRight(left: string, right: string, options?: ReceiptLeftRightOptions): PrinterBridgeReceipt;
  keyValue(label: string, value: string, options?: ReceiptKeyValueOptions): PrinterBridgeReceipt;
  columns(columns: ReceiptColumn[], options?: ReceiptColumnsOptions): PrinterBridgeReceipt;
  table(options: ReceiptTableOptions): PrinterBridgeReceipt;
  amount(value: number, options?: ReceiptAmountOptions): PrinterBridgeReceipt;
  items(items: ReceiptItem[], options?: ReceiptItemsOptions): PrinterBridgeReceipt;
  totals(rows: ReceiptTotalRow[], options?: ReceiptTotalsOptions): PrinterBridgeReceipt;
  title(value: string, options?: ReceiptTitleOptions): PrinterBridgeReceipt;
  section(value: string, options?: ReceiptSectionOptions): PrinterBridgeReceipt;
  style(
    options: ReceiptStyleOptions,
    build: (receipt: PrinterBridgeReceipt) => void
  ): PrinterBridgeReceipt;
  align(value: TextAlign): PrinterBridgeReceipt;
  bold(enabled?: boolean): PrinterBridgeReceipt;
  underline(enabled?: boolean): PrinterBridgeReceipt;
  font(value: ReceiptFont): PrinterBridgeReceipt;
  invert(enabled?: boolean): PrinterBridgeReceipt;
  codePage(page: number, encoding?: ReceiptEncoding): PrinterBridgeReceipt;
  encoding(value: ReceiptEncoding): PrinterBridgeReceipt;
  size(width: number, height: number): PrinterBridgeReceipt;
  cashDrawer(options?: ReceiptCashDrawerOptions): PrinterBridgeReceipt;
  beep(count?: number, duration?: number): PrinterBridgeReceipt;
  feed(lines?: number): PrinterBridgeReceipt;
  cut(mode?: CutMode): PrinterBridgeReceipt;
  qr(value: string, options?: ReceiptQrOptions): PrinterBridgeReceipt;
  barcode(value: string, options?: ReceiptBarcodeOptions): PrinterBridgeReceipt;
  image(input: ReceiptImageInput, options?: ReceiptImageOptions): PrinterBridgeReceipt;
  raw(bytes: Uint8Array | number[]): PrinterBridgeReceipt;
  print(options?: ReceiptPrintOptions): Promise<ReceiptPrintResult[]>;
}

export interface ReceiptPrintOptions {
  copies?: number;
}

export interface ReceiptPrintResult {
  printerId: string;
  copy: number;
  result: PrintResult;
}

export interface PrinterBridgeContext {
  exposeInMainWorld(name: string, api: PrinterBridge): void;
}

export interface PrinterBridgeWindow {
  nodePrinter: PrinterBridge;
}

export type PrinterBridgeGlobal = PrinterBridgeWindow;

declare global {
  interface Window {
    nodePrinter: PrinterBridge;
  }
}

// Bridge factory

export function createPrinterBridge(options: PrinterMethodOptions = {}): PrinterBridge {
  return {
    listPrinters     : (type) => listPrinters(type, options),
    savePrinter,
    listSavedPrinters,
    getSavedPrinter,
    removeSavedPrinter,
    clearSavedPrinters,
    createReceipt    : (printerIds) => createPrinterBridgeReceipt(printerIds, options),
    print            : (target, data) => print(target, normalizeBridgeData(data), options)
  };
}

export function exposePrinterBridge(
  contextBridge: PrinterBridgeContext,
  options: PrinterMethodOptions = {}
): void {
  contextBridge.exposeInMainWorld(PRINTER_BRIDGE_NAME, createPrinterBridge(options));
}

// Data conversion

function normalizeBridgeData(data: PrinterBridgeData): Uint8Array {
  return data instanceof Uint8Array ? data : Uint8Array.from(data);
}

// Receipt bridge

type DirectReceiptCommandName = Exclude<
  keyof ReceiptBuilder,
  "preview" | "toHex" | "encode" | "style"
>;

type ReceiptBridgeCommand =
  | {
      name: DirectReceiptCommandName;
      args: unknown[];
    }
  | {
      name: "style";
      args: [ReceiptStyleOptions, ReceiptBridgeCommand[]];
    };

function createPrinterBridgeReceipt(
  printerIds: PrinterIdInput,
  options: PrinterMethodOptions,
  commands: ReceiptBridgeCommand[] = []
): PrinterBridgeReceipt {
  const normalizedPrinterIds = normalizePrinterIds(printerIds);
  const add = (name: DirectReceiptCommandName, ...args: unknown[]) => {
    commands.push({ name, args });

    return builder;
  };
  const builder: PrinterBridgeReceipt = {
    initialize: () => add("initialize"),
    text      : (value, textOptions) => add("text", value, textOptions),
    line      : (value, textOptions) => add("line", value, textOptions),
    row       : (columns) => add("row", columns),
    divider   : (dividerOptions) => add("divider", dividerOptions),
    blank     : (lines) => add("blank", lines),
    wrap      : (value, wrapOptions) => add("wrap", value, wrapOptions),
    truncate  : (value, truncateOptions) => add("truncate", value, truncateOptions),
    leftRight : (left, right, leftRightOptions) => add("leftRight", left, right, leftRightOptions),
    keyValue  : (label, value, keyValueOptions) => add("keyValue", label, value, keyValueOptions),
    columns   : (columns, columnsOptions) => add("columns", columns, columnsOptions),
    table     : (tableOptions) => add("table", tableOptions),
    amount    : (value, amountOptions) => add("amount", value, amountOptions),
    items     : (items, itemsOptions) => add("items", items, itemsOptions),
    totals    : (rows, totalsOptions) => add("totals", rows, totalsOptions),
    title     : (value, titleOptions) => add("title", value, titleOptions),
    section   : (value, sectionOptions) => add("section", value, sectionOptions),
    style     : (styleOptions, build) => {
      const nestedCommands: ReceiptBridgeCommand[] = [];
      const nestedBuilder = createPrinterBridgeReceipt(
        normalizedPrinterIds,
        options,
        nestedCommands
      );

      build(nestedBuilder);
      commands.push({ name: "style", args: [styleOptions, nestedCommands] });

      return builder;
    },
    align     : (value) => add("align", value),
    bold      : (enabled) => add("bold", enabled),
    underline : (enabled) => add("underline", enabled),
    font      : (value) => add("font", value),
    invert    : (enabled) => add("invert", enabled),
    codePage  : (page, encoding) => add("codePage", page, encoding),
    encoding  : (value) => add("encoding", value),
    size      : (width, height) => add("size", width, height),
    cashDrawer: (cashDrawerOptions) => add("cashDrawer", cashDrawerOptions),
    beep      : (count, duration) => add("beep", count, duration),
    feed      : (lines) => add("feed", lines),
    cut       : (mode) => add("cut", mode),
    qr        : (value, qrOptions) => add("qr", value, qrOptions),
    barcode   : (value, barcodeOptions) => add("barcode", value, barcodeOptions),
    image     : (input, imageOptions) => add("image", input, imageOptions),
    raw       : (bytes) => add("raw", bytes),
    print     : (printOptions) => printReceiptCommands(
      normalizedPrinterIds,
      commands,
      options,
      printOptions
    )
  };

  return builder;
}

async function printReceiptCommands(
  printerIds: string[],
  commands: ReceiptBridgeCommand[],
  methodOptions: PrinterMethodOptions,
  options: ReceiptPrintOptions = {}
): Promise<ReceiptPrintResult[]> {
  const copies  = normalizeCopies(options.copies);
  const results: ReceiptPrintResult[] = [];

  for (const printerId of printerIds) {
    const savedPrinter = await getRequiredSavedPrinter(printerId);
    const data         = buildReceiptData(savedPrinter, commands);

    for (let copy = 1; copy <= copies; copy += 1) {
      results.push({
        printerId,
        copy,
        result: await print(savedPrinter.target, data, methodOptions)
      });
    }
  }

  return results;
}

function buildReceiptData(
  savedPrinter: SavedPrinter,
  commands: ReceiptBridgeCommand[]
): Uint8Array {
  const receipt = createCoreReceipt({
    encoding: savedPrinter.receipt.encoding,
    columns : savedPrinter.receipt.columns
  });

  applyReceiptCommands(receipt, commands);

  return receipt.encode();
}

function applyReceiptCommands(
  receipt: ReceiptBuilder,
  commands: readonly ReceiptBridgeCommand[]
): void {
  for (const command of commands) {
    if (command.name === "style") {
      const [styleOptions, nestedCommands] = command.args;

      receipt.style(styleOptions, (styledReceipt) => {
        applyReceiptCommands(styledReceipt, nestedCommands);
      });
      continue;
    }

    const method = receipt[command.name] as (...args: unknown[]) => ReceiptBuilder;

    method.apply(receipt, command.args);
  }
}

async function getRequiredSavedPrinter(id: string): Promise<SavedPrinter> {
  const savedPrinter = await getSavedPrinter(id);

  if (!savedPrinter) {
    throw new PrinterError({
      code   : "ERR_PRINTER_NOT_FOUND",
      message: `Saved printer was not found: ${id}`
    });
  }

  return savedPrinter;
}

function normalizePrinterIds(input: PrinterIdInput): string[] {
  const printerIds = Array.isArray(input) ? input : [input];

  if (printerIds.length === 0 || printerIds.some((id) => !id)) {
    throw new PrinterError({
      code   : "ERR_INVALID_PRINTER_SETTINGS",
      message: "At least one saved printer id is required"
    });
  }

  return printerIds;
}

function normalizeCopies(value = 1): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new PrinterError({
      code   : "ERR_INVALID_PRINTER_SETTINGS",
      message: "Print copies must be an integer between 1 and 100"
    });
  }

  return value;
}
