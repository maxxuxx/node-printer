export type ReceiptEncoding =
  | "utf8"
  | "ascii"
  | "cp437"
  | "cp850"
  | "cp852"
  | "cp858"
  | "cp860"
  | "cp863"
  | "cp865"
  | "cp866"
  | "cp949"
  | "cp932"
  | "cp950"
  | "big5"
  | "gb18030"
  | "windows-874"
  | "windows-1250"
  | "windows-1251"
  | "windows-1252"
  | "windows-1253"
  | "windows-1254"
  | "windows-1255"
  | "windows-1256"
  | "windows-1257"
  | "windows-1258";
export type ReceiptFont       = "a" | "b";
export type TextAlign         = "left" | "center" | "right";
export type CutMode           = "full" | "partial";
export type QrErrorCorrection = "l" | "m" | "q" | "h";
export type BarcodeType =
  | "upc-a"
  | "upc-e"
  | "ean13"
  | "ean8"
  | "code39"
  | "itf"
  | "codabar"
  | "code93"
  | "code128";
export type BarcodeHriPosition = "none" | "above" | "below" | "both";
export type ImageMode           = "normal" | "double-width" | "double-height" | "quad";

export interface ReceiptOptions {
  columns?: number;
  encoding?: ReceiptEncoding;
}

export interface ReceiptTextOptions {
  align?: TextAlign;
  bold?: boolean;
  underline?: boolean;
  newLine?: boolean;
}

export interface ReceiptColumn {
  text: string;
  width: number;
  align?: TextAlign;
}

export interface ReceiptDividerOptions {
  char?: string;
  width?: number;
  text?: string;
  align?: TextAlign;
}

export interface ReceiptWrapOptions extends Omit<ReceiptTextOptions, "newLine"> {
  width?: number;
  indent?: number;
  breakWords?: boolean;
}

export interface ReceiptTruncateOptions extends Omit<ReceiptTextOptions, "newLine"> {
  width?: number;
  ellipsis?: string;
}

export interface ReceiptLeftRightOptions extends Omit<ReceiptTextOptions, "newLine"> {
  width?: number;
}

export interface ReceiptKeyValueOptions extends ReceiptLeftRightOptions {
  separator?: string;
}

export interface ReceiptColumnsOptions {
  wrap?: boolean;
}

export interface ReceiptTableColumn {
  key?: string;
  title?: string;
  width: number;
  align?: TextAlign;
}

export type ReceiptTableValue = string | number | null | undefined;
export type ReceiptTableRow   = ReceiptTableValue[] | Record<string, ReceiptTableValue>;

export interface ReceiptTableOptions {
  columns: ReceiptTableColumn[];
  rows: ReceiptTableRow[];
  divider?: boolean | string | ReceiptDividerOptions;
  wrap?: boolean;
}

export interface ReceiptAmountFormatOptions {
  locale?: string;
  currency?: string;
  unit?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface ReceiptAmountOptions extends ReceiptAmountFormatOptions, Omit<ReceiptTextOptions, "newLine"> {
  label?: string;
}

export interface ReceiptItem {
  name: string;
  quantity?: number;
  amount: number;
}

export interface ReceiptItemsOptions extends ReceiptAmountFormatOptions {
  quantityPrefix?: string;
}

export interface ReceiptTotalRow extends ReceiptAmountFormatOptions {
  label: string;
  amount: number;
  bold?: boolean;
  underline?: boolean;
}

export type ReceiptTotalsOptions = ReceiptAmountFormatOptions;

export interface ReceiptTitleOptions extends Omit<ReceiptTextOptions, "newLine"> {
  width?: number;
}

export interface ReceiptSectionOptions extends ReceiptTitleOptions {
  divider?: boolean | string | ReceiptDividerOptions;
}

export interface ReceiptStyleOptions {
  align?: TextAlign;
  bold?: boolean;
  underline?: boolean;
  invert?: boolean;
  font?: ReceiptFont;
}

export interface ReceiptCashDrawerOptions {
  pin?: 2 | 5;
  on?: number;
  off?: number;
}

export interface ReceiptFallbackOptions {
  fallbackText?: string | false;
}

export interface ReceiptQrOptions extends ReceiptFallbackOptions {
  size?: number;
  errorCorrection?: QrErrorCorrection;
  encoding?: ReceiptEncoding;
}

export interface ReceiptBarcodeOptions extends ReceiptFallbackOptions {
  type?: BarcodeType;
  width?: number;
  height?: number;
  hri?: BarcodeHriPosition;
}

export interface ReceiptImageInput {
  width: number;
  height: number;
  data: Uint8Array | number[];
}

export interface ReceiptImageOptions extends ReceiptFallbackOptions {
  mode?: ImageMode;
}

export interface ReceiptBuilder {
  initialize()                                                      : this;
  text(value: string, options?: ReceiptTextOptions)                 : this;
  line(value: string, options?: Omit<ReceiptTextOptions, "newLine">): this;
  row(columns: ReceiptColumn[])                                     : this;
  divider(options?: string | ReceiptDividerOptions)                 : this;
  blank(lines?: number)                                             : this;
  wrap(value: string, options?: ReceiptWrapOptions)                  : this;
  truncate(value: string, options?: ReceiptTruncateOptions)          : this;
  leftRight(left: string, right: string, options?: ReceiptLeftRightOptions): this;
  keyValue(label: string, value: string, options?: ReceiptKeyValueOptions): this;
  columns(columns: ReceiptColumn[], options?: ReceiptColumnsOptions) : this;
  table(options: ReceiptTableOptions)                               : this;
  amount(value: number, options?: ReceiptAmountOptions)              : this;
  items(items: ReceiptItem[], options?: ReceiptItemsOptions)         : this;
  totals(rows: ReceiptTotalRow[], options?: ReceiptTotalsOptions)    : this;
  title(value: string, options?: ReceiptTitleOptions)                : this;
  section(value: string, options?: ReceiptSectionOptions)            : this;
  style(options: ReceiptStyleOptions, build: (receipt: this) => void): this;
  align(value: TextAlign)                                           : this;
  bold(enabled?: boolean)                                           : this;
  underline(enabled?: boolean)                                      : this;
  font(value: ReceiptFont)                                          : this;
  invert(enabled?: boolean)                                         : this;
  codePage(page: number, encoding?: ReceiptEncoding)                 : this;
  encoding(value: ReceiptEncoding)                                   : this;
  size(width: number, height: number)                               : this;
  cashDrawer(options?: ReceiptCashDrawerOptions)                     : this;
  beep(count?: number, duration?: number)                            : this;
  feed(lines?: number)                                              : this;
  cut(mode?: CutMode)                                               : this;
  qr(value: string, options?: ReceiptQrOptions)                      : this;
  barcode(value: string, options?: ReceiptBarcodeOptions)            : this;
  image(input: ReceiptImageInput, options?: ReceiptImageOptions)     : this;
  raw(bytes: Uint8Array | number[])                                 : this;
  preview()                                                         : string;
  toHex()                                                           : string;
  encode()                                                          : Uint8Array;
}
