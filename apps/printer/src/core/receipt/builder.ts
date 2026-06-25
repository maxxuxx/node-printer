import { TextEncoder } from "node:util";

import * as iconv from "iconv-lite";

import { PrinterError } from "../errors.js";
import { ALIGN_BYTES, ESC, GS, LF } from "./constants.js";
import { buildBarcodeBytes, buildImageBytes, buildQrBytes } from "./commands.js";
import { concatBytes, encodeAscii } from "./bytes.js";
import {
  formatAmount,
  formatColumn,
  formatDivider,
  formatText,
  measureTextWidth,
  truncateText,
  wrapText
} from "./layout.js";
import type {
  CutMode,
  ReceiptAmountOptions,
  ReceiptBarcodeOptions,
  ReceiptBuilder,
  ReceiptCashDrawerOptions,
  ReceiptColumn,
  ReceiptColumnsOptions,
  ReceiptDividerOptions,
  ReceiptEncoding,
  ReceiptFont,
  ReceiptImageInput,
  ReceiptImageOptions,
  ReceiptItem,
  ReceiptItemsOptions,
  ReceiptKeyValueOptions,
  ReceiptLeftRightOptions,
  ReceiptOptions,
  ReceiptQrOptions,
  ReceiptSectionOptions,
  ReceiptStyleOptions,
  ReceiptTableOptions,
  ReceiptTableRow,
  ReceiptTextOptions,
  ReceiptTitleOptions,
  ReceiptTotalRow,
  ReceiptTotalsOptions,
  ReceiptTruncateOptions,
  ReceiptWrapOptions,
  TextAlign
} from "./types.js";
import { assertScale } from "./validators.js";

// Receipt builder

const DEFAULT_COLUMNS = 42;

interface ReceiptConfig {
  columns: number;
  encoding: ReceiptEncoding;
}

interface ReceiptStyleState {
  align: TextAlign;
  bold: boolean;
  underline: boolean;
  invert: boolean;
  font: ReceiptFont;
}

export function createReceipt(options: ReceiptOptions = {}): ReceiptBuilder {
  return new EscPosReceiptBuilder(options);
}

class EscPosReceiptBuilder implements ReceiptBuilder {
  private readonly chunks : Uint8Array[] = [];
  private readonly config : ReceiptConfig;
  private readonly encoder = new TextEncoder();
  private previewText = "";
  private currentEncoding: ReceiptEncoding;
  private styleState: ReceiptStyleState = {
    align    : "left",
    bold     : false,
    underline: false,
    invert   : false,
    font     : "a"
  };

  constructor(options: ReceiptOptions) {
    const columns = options.columns ?? DEFAULT_COLUMNS;

    this.assertByteRange(columns, "Receipt columns", 1);

    this.config = {
      columns,
      encoding: options.encoding ?? "utf8"
    };
    this.currentEncoding = this.config.encoding;
  }

  initialize(): this {
    return this.command(ESC, 0x40);
  }

  text(value: string, options: ReceiptTextOptions = {}): this {
    this.applyTextOptions(options);
    this.writeText(value);
    this.previewText += value;

    if (options.newLine !== false) {
      this.newLine();
    }

    return this;
  }

  line(value: string, options: Omit<ReceiptTextOptions, "newLine"> = {}): this {
    return this.text(value, { ...options, newLine: true });
  }

  row(columns: ReceiptColumn[]): this {
    const line = columns.map((column) => formatColumn(column)).join("");

    return this.text(line, { newLine: true });
  }

  divider(options: string | ReceiptDividerOptions = "-"): this {
    return this.text(formatDivider(this.config.columns, options), { newLine: true });
  }

  blank(lines = 1): this {
    this.assertByteRange(lines, "Blank lines");

    for (let line = 0; line < lines; line += 1) {
      this.newLine();
    }

    return this;
  }

  wrap(value: string, options: ReceiptWrapOptions = {}): this {
    const width       = options.width ?? this.config.columns;
    const textOptions = this.textOptions(options);

    for (const line of wrapText(value, width, options)) {
      this.text(line, textOptions);
    }

    return this;
  }

  truncate(value: string, options: ReceiptTruncateOptions = {}): this {
    const width       = options.width ?? this.config.columns;
    const textOptions = this.textOptions(options);

    return this.text(truncateText(value, width, options.ellipsis), textOptions);
  }

  leftRight(left: string, right: string, options: ReceiptLeftRightOptions = {}): this {
    const width       = options.width ?? this.config.columns;
    const rightText   = truncateText(right, width, "");
    const leftWidth   = Math.max(0, width - measureTextWidth(rightText));
    const leftText    = leftWidth > 0 ? truncateText(left, leftWidth, "") : "";
    const spaceCount  = Math.max(0, width - measureTextWidth(leftText) - measureTextWidth(rightText));
    const textOptions = this.textOptions(options);

    return this.text(`${leftText}${" ".repeat(spaceCount)}${rightText}`, textOptions);
  }

  keyValue(label: string, value: string, options: ReceiptKeyValueOptions = {}): this {
    const separator = options.separator ?? ": ";

    return this.leftRight(`${label}${separator}`, value, options);
  }

  columns(columns: ReceiptColumn[], options: ReceiptColumnsOptions = {}): this {
    if (!options.wrap) {
      return this.row(columns);
    }

    const wrapped = columns.map((column) => wrapText(column.text, column.width));
    const rows    = Math.max(...wrapped.map((lines) => lines.length));

    for (let row = 0; row < rows; row += 1) {
      this.row(
        columns.map((column, index) => ({
          ...column,
          text: wrapped[index]?.[row] ?? ""
        }))
      );
    }

    return this;
  }

  table(options: ReceiptTableOptions): this {
    const headers = options.columns.map((column) => ({
      text : column.title ?? "",
      width: column.width,
      align: column.align
    }));

    if (headers.some((column) => column.text.length > 0)) {
      this.row(headers);
    }

    if (options.divider) {
      this.divider(options.divider === true ? undefined : options.divider);
    }

    for (const row of options.rows) {
      const columns = options.columns.map((column, index) => ({
        text : this.tableCell(row, column.key, index),
        width: column.width,
        align: column.align
      }));

      this.columns(columns, { wrap: options.wrap });
    }

    return this;
  }

  amount(value: number, options: ReceiptAmountOptions = {}): this {
    const amount = formatAmount(value, options);

    if (options.label) {
      return this.leftRight(options.label, amount, options);
    }

    return this.text(amount, {
      align    : options.align ?? "right",
      bold     : options.bold,
      underline: options.underline
    });
  }

  items(items: ReceiptItem[], options: ReceiptItemsOptions = {}): this {
    const quantityPrefix = options.quantityPrefix ?? "x";

    for (const item of items) {
      const quantity = item.quantity === undefined ? "" : ` ${quantityPrefix}${item.quantity}`;
      const label    = `${item.name}${quantity}`;

      this.leftRight(label, formatAmount(item.amount, options));
    }

    return this;
  }

  totals(rows: ReceiptTotalRow[], options: ReceiptTotalsOptions = {}): this {
    for (const row of rows) {
      const write = () => {
        this.leftRight(row.label, formatAmount(row.amount, { ...options, ...row }));
      };

      if (row.bold || row.underline) {
        this.style({ bold: row.bold, underline: row.underline }, write);
      } else {
        write();
      }
    }

    return this;
  }

  title(value: string, options: ReceiptTitleOptions = {}): this {
    const width = options.width ?? this.config.columns;

    return this.text(formatText(value, width, options.align ?? "center"), {
      bold     : options.bold,
      underline: options.underline
    });
  }

  section(value: string, options: ReceiptSectionOptions = {}): this {
    if (options.divider === false) {
      return this.title(value, options);
    }

    const divider = options.divider === true || options.divider === undefined
      ? { text: value }
      : options.divider;

    return this.divider(divider);
  }

  style(options: ReceiptStyleOptions, build: (receipt: this) => void): this {
    const previous = { ...this.styleState };

    this.applyStyleOptions(options);
    build(this);
    this.restoreStyle(previous);

    return this;
  }

  align(value: TextAlign): this {
    this.styleState.align = value;

    return this.command(ESC, 0x61, ALIGN_BYTES[value]);
  }

  bold(enabled = true): this {
    this.styleState.bold = enabled;

    return this.command(ESC, 0x45, enabled ? 1 : 0);
  }

  underline(enabled = true): this {
    this.styleState.underline = enabled;

    return this.command(ESC, 0x2d, enabled ? 1 : 0);
  }

  font(value: ReceiptFont): this {
    this.styleState.font = value;

    return this.command(ESC, 0x4d, value === "a" ? 0 : 1);
  }

  invert(enabled = true): this {
    this.styleState.invert = enabled;

    return this.command(GS, 0x42, enabled ? 1 : 0);
  }

  codePage(page: number, encoding?: ReceiptEncoding): this {
    this.assertByteRange(page, "Code page");

    if (encoding) {
      this.encoding(encoding);
    }

    return this.command(ESC, 0x74, page);
  }

  encoding(value: ReceiptEncoding): this {
    this.currentEncoding = value;

    return this;
  }

  size(width: number, height: number): this {
    assertScale(width, "width");
    assertScale(height, "height");

    return this.command(GS, 0x21, ((width - 1) << 4) | (height - 1));
  }

  cashDrawer(options: ReceiptCashDrawerOptions = {}): this {
    const pin = options.pin === 5 ? 1 : 0;
    const on  = options.on ?? 50;
    const off = options.off ?? 250;

    this.assertByteRange(on, "Cash drawer on time");
    this.assertByteRange(off, "Cash drawer off time");

    return this.command(ESC, 0x70, pin, on, off);
  }

  beep(count = 1, duration = 1): this {
    this.assertByteRange(count, "Beep count");
    this.assertByteRange(duration, "Beep duration");

    return this.command(0x10, 0x14, 0x07, count, duration);
  }

  feed(lines = 1): this {
    this.assertByteRange(lines, "Feed lines");

    return this.command(ESC, 0x64, lines);
  }

  cut(mode: CutMode = "full"): this {
    return this.command(GS, 0x56, mode === "full" ? 0 : 1);
  }

  qr(value: string, options: ReceiptQrOptions = {}): this {
    return this.appendWithFallback("[QR ERROR]", options.fallbackText, () =>
      buildQrBytes(this.encodeText(value, options.encoding), options)
    );
  }

  barcode(value: string, options: ReceiptBarcodeOptions = {}): this {
    return this.appendWithFallback("[BARCODE ERROR]", options.fallbackText, () =>
      buildBarcodeBytes(value, options)
    );
  }

  image(input: ReceiptImageInput, options: ReceiptImageOptions = {}): this {
    return this.appendWithFallback("[IMAGE ERROR]", options.fallbackText, () =>
      buildImageBytes(input, options)
    );
  }

  raw(bytes: Uint8Array | number[]): this {
    this.chunks.push(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));

    return this;
  }

  preview(): string {
    return this.previewText;
  }

  toHex(): string {
    return Array.from(this.encode())
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  encode(): Uint8Array {
    return concatBytes(this.chunks);
  }

  private applyTextOptions(options: ReceiptTextOptions): void {
    this.applyStyleOptions(options);
  }

  private applyStyleOptions(options: ReceiptStyleOptions): void {
    if (options.align) {
      this.align(options.align);
    }

    if (typeof options.bold === "boolean") {
      this.bold(options.bold);
    }

    if (typeof options.underline === "boolean") {
      this.underline(options.underline);
    }

    if (typeof options.invert === "boolean") {
      this.invert(options.invert);
    }

    if (options.font) {
      this.font(options.font);
    }
  }

  private restoreStyle(previous: ReceiptStyleState): void {
    if (this.styleState.align !== previous.align) this.align(previous.align);
    if (this.styleState.bold !== previous.bold) this.bold(previous.bold);
    if (this.styleState.underline !== previous.underline) this.underline(previous.underline);
    if (this.styleState.invert !== previous.invert) this.invert(previous.invert);
    if (this.styleState.font !== previous.font) this.font(previous.font);
  }

  private textOptions(options: ReceiptTextOptions): ReceiptTextOptions {
    return {
      align    : options.align,
      bold     : options.bold,
      underline: options.underline
    };
  }

  private tableCell(row: ReceiptTableRow, key: string | undefined, index: number): string {
    if (Array.isArray(row)) {
      return String(row[index] ?? "");
    }

    return String(row[key ?? String(index)] ?? "");
  }

  private newLine(): void {
    this.command(LF);
    this.previewText += "\n";
  }

  private writeText(value: string): void {
    this.chunks.push(this.encodeText(value));
  }

  private encodeText(value: string, encoding: ReceiptEncoding = this.currentEncoding): Uint8Array {
    if (encoding === "ascii") {
      return encodeAscii(value);
    }

    if (encoding === "utf8") {
      return this.encoder.encode(value);
    }

    return Uint8Array.from(iconv.encode(value, encoding));
  }

  private command(...bytes: number[]): this {
    this.chunks.push(Uint8Array.from(bytes));

    return this;
  }

  private appendWithFallback(
    fallbackText: string,
    overrideFallbackText: string | false | undefined,
    build: () => Uint8Array
  ): this {
    try {
      this.raw(build());
    } catch (error) {
      if (overrideFallbackText === false) {
        throw error;
      }

      this.text(overrideFallbackText ?? fallbackText);
    }

    return this;
  }

  private assertByteRange(value: number, name: string, min = 0): void {
    if (!Number.isInteger(value) || value < min || value > 255) {
      throw new PrinterError({
        code   : "ERR_ENCODING_FAILED",
        message: `${name} must be an integer between ${min} and 255`
      });
    }
  }
}
