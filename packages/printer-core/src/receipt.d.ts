export type ReceiptEncoding = "utf8" | "ascii" | "cp949";
export type TextAlign = "left" | "center" | "right";
export type CutMode = "full" | "partial";
export type QrErrorCorrection = "l" | "m" | "q" | "h";
export type BarcodeType = "upc-a" | "upc-e" | "ean13" | "ean8" | "code39" | "itf" | "codabar" | "code93" | "code128";
export type BarcodeHriPosition = "none" | "above" | "below" | "both";
export type ImageMode = "normal" | "double-width" | "double-height" | "quad";
export interface ReceiptOptions {
    width?: number;
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
    initialize(): this;
    text(value: string, options?: ReceiptTextOptions): this;
    line(value: string, options?: Omit<ReceiptTextOptions, "newLine">): this;
    row(columns: ReceiptColumn[]): this;
    divider(char?: string): this;
    align(value: TextAlign): this;
    bold(enabled?: boolean): this;
    underline(enabled?: boolean): this;
    size(width: number, height: number): this;
    feed(lines?: number): this;
    cut(mode?: CutMode): this;
    qr(value: string, options?: ReceiptQrOptions): this;
    barcode(value: string, options?: ReceiptBarcodeOptions): this;
    image(input: ReceiptImageInput, options?: ReceiptImageOptions): this;
    raw(bytes: Uint8Array | number[]): this;
    encode(): Uint8Array;
}
export declare function createReceipt(options?: ReceiptOptions): ReceiptBuilder;
