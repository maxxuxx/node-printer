import { TextEncoder } from "node:util";

import * as iconv from "iconv-lite";

import { PrinterError } from "./errors.js";

export type ReceiptEncoding   = "utf8" | "ascii" | "cp949";
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
  initialize()                                                      : this;
  text(value: string, options?: ReceiptTextOptions)                 : this;
  line(value: string, options?: Omit<ReceiptTextOptions, "newLine">): this;
  row(columns: ReceiptColumn[])                                     : this;
  divider(char?: string)                                            : this;
  align(value: TextAlign)                                           : this;
  bold(enabled?: boolean)                                           : this;
  underline(enabled?: boolean)                                      : this;
  size(width: number, height: number)                               : this;
  feed(lines?: number)                                              : this;
  cut(mode?: CutMode)                                               : this;
  qr(value: string, options?: ReceiptQrOptions)                      : this;
  barcode(value: string, options?: ReceiptBarcodeOptions)            : this;
  image(input: ReceiptImageInput, options?: ReceiptImageOptions)     : this;
  raw(bytes: Uint8Array | number[])                                 : this;
  encode()                                                          : Uint8Array;
}

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

const ALIGN_BYTES: Record<TextAlign, number> = {
  left  : 0,
  center: 1,
  right : 2
};

const QR_ERROR_CORRECTION_BYTES: Record<QrErrorCorrection, number> = {
  l: 48,
  m: 49,
  q: 50,
  h: 51
};

const BARCODE_TYPE_BYTES: Record<BarcodeType, number> = {
  "upc-a" : 65,
  "upc-e" : 66,
  ean13   : 67,
  ean8    : 68,
  code39  : 69,
  itf     : 70,
  codabar : 71,
  code93  : 72,
  code128 : 73
};

const BARCODE_HRI_BYTES: Record<BarcodeHriPosition, number> = {
  none : 0,
  above: 1,
  below: 2,
  both : 3
};

const IMAGE_MODE_BYTES: Record<ImageMode, number> = {
  normal         : 0,
  "double-width": 1,
  "double-height": 2,
  quad           : 3
};

// ESC/POS 명령을 누적하는 영수증 빌더를 생성합니다
export function createReceipt(options: ReceiptOptions = {}): ReceiptBuilder {
  return new EscPosReceiptBuilder(options);
}

class EscPosReceiptBuilder implements ReceiptBuilder {
  private readonly chunks : Uint8Array[] = [];
  private readonly options: Required<ReceiptOptions>;
  private readonly encoder = new TextEncoder();

  constructor(options: ReceiptOptions) {
    this.options = {
      width   : options.width ?? 48,
      encoding: options.encoding ?? "utf8"
    };
  }

  initialize(): this {
    return this.command(ESC, 0x40);
  }

  // 텍스트 스타일 옵션을 적용하고 기본 줄바꿈을 처리합니다
  text(value: string, options: ReceiptTextOptions = {}): this {
    this.applyTextOptions(options);
    this.writeText(value);

    if (options.newLine !== false) {
      this.command(LF);
    }

    return this;
  }

  line(value: string, options: Omit<ReceiptTextOptions, "newLine"> = {}): this {
    return this.text(value, { ...options, newLine: true });
  }

  // 여러 컬럼을 지정 폭에 맞춰 한 줄로 합칩니다
  row(columns: ReceiptColumn[]): this {
    const line = columns.map((column) => formatColumn(column)).join("");

    return this.text(line, { newLine: true });
  }

  // 설정된 영수증 폭만큼 구분선을 출력합니다
  divider(char = "-"): this {
    const mark = Array.from(char)[0] ?? "-";

    return this.text(mark.repeat(this.options.width), { newLine: true });
  }

  align(value: TextAlign): this {
    return this.command(ESC, 0x61, ALIGN_BYTES[value]);
  }

  bold(enabled = true): this {
    return this.command(ESC, 0x45, enabled ? 1 : 0);
  }

  underline(enabled = true): this {
    return this.command(ESC, 0x2d, enabled ? 1 : 0);
  }

  // ESC/POS 배율 명령은 가로와 세로를 각각 1에서 8까지만 허용합니다
  size(width: number, height: number): this {
    assertScale(width, "width");
    assertScale(height, "height");

    return this.command(GS, 0x21, ((width - 1) << 4) | (height - 1));
  }

  // 용지 공급 명령은 한 바이트 범위 안의 줄 수만 받습니다
  feed(lines = 1): this {
    if (!Number.isInteger(lines) || lines < 0 || lines > 255) {
      throw new PrinterError({
        code   : "ERR_ENCODING_FAILED",
        message: "Feed lines must be an integer between 0 and 255"
      });
    }

    return this.command(ESC, 0x64, lines);
  }

  cut(mode: CutMode = "full"): this {
    return this.command(GS, 0x56, mode === "full" ? 0 : 1);
  }

  // QR 데이터는 선택 인코딩으로 먼저 변환한 뒤 ESC/POS 저장 명령을 만듭니다
  qr(value: string, options: ReceiptQrOptions = {}): this {
    return this.appendWithFallback("[QR ERROR]", options.fallbackText, () =>
      buildQrBytes(this.encodeText(value, options.encoding), options)
    );
  }

  // 바코드는 종류별 검증을 통과한 ASCII 데이터만 명령으로 만듭니다
  barcode(value: string, options: ReceiptBarcodeOptions = {}): this {
    return this.appendWithFallback("[BARCODE ERROR]", options.fallbackText, () =>
      buildBarcodeBytes(value, options)
    );
  }

  // 픽셀 배열은 ESC/POS raster image 비트맵으로 압축합니다
  image(input: ReceiptImageInput, options: ReceiptImageOptions = {}): this {
    return this.appendWithFallback("[IMAGE ERROR]", options.fallbackText, () =>
      buildImageBytes(input, options)
    );
  }

  // 이미 준비된 바이트는 변환 없이 출력 조각에 추가합니다
  raw(bytes: Uint8Array | number[]): this {
    this.chunks.push(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));

    return this;
  }

  // 누적된 출력 조각을 순서대로 하나의 버퍼에 합칩니다
  encode(): Uint8Array {
    const length = this.chunks.reduce((total, chunk) => total + chunk.length, 0);
    const output = new Uint8Array(length);
    let   offset = 0;

    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }

    return output;
  }

  // 명시된 텍스트 옵션만 현재 출력 상태에 반영합니다
  private applyTextOptions(options: ReceiptTextOptions): void {
    if (options.align) {
      this.align(options.align);
    }

    if (typeof options.bold === "boolean") {
      this.bold(options.bold);
    }

    if (typeof options.underline === "boolean") {
      this.underline(options.underline);
    }
  }

  private writeText(value: string): void {
    this.chunks.push(this.encodeText(value));
  }

  // 선택된 문자셋에 따라 텍스트를 프린터 바이트로 변환합니다
  private encodeText(value: string, encoding: ReceiptEncoding = this.options.encoding): Uint8Array {
    // ASCII 모드는 표현할 수 없는 문자를 물음표로 대체합니다
    if (encoding === "ascii") {
      return encodeAscii(value);
    }

    // CP949 모드는 한글 영수증 출력을 위해 iconv 결과를 사용합니다
    if (encoding === "cp949") {
      return Uint8Array.from(iconv.encode(value, "cp949"));
    }

    return this.encoder.encode(value);
  }

  private command(...bytes: number[]): this {
    this.chunks.push(Uint8Array.from(bytes));

    return this;
  }

  // QR 바코드 이미지 생성 실패를 fallback 문구 또는 예외로 통일합니다
  private appendWithFallback(
    fallbackText: string,
    overrideFallbackText: string | false | undefined,
    build: () => Uint8Array
  ): this {
    try {
      this.raw(build());
    } catch (error) {
      // fallback을 끄면 원래 인코딩 오류를 호출자에게 그대로 전달합니다
      if (overrideFallbackText === false) {
        throw error;
      }

      this.text(overrideFallbackText ?? fallbackText);
    }

    return this;
  }
}

// ESC/POS 명령 바이트 생성
// QR 명령은 모델 선택 크기 오류 정정 저장 출력 순서로 조립합니다
function buildQrBytes(data: Uint8Array, options: ReceiptQrOptions): Uint8Array {
  const size            = options.size ?? 6;
  const errorCorrection = options.errorCorrection ?? "m";
  const errorByte       = QR_ERROR_CORRECTION_BYTES[errorCorrection];

  // 옵션 객체가 타입을 우회해 들어온 경우도 런타임에서 막습니다
  if (typeof errorByte !== "number") {
    throwEncodingError("QR errorCorrection is invalid");
  }

  assertIntegerRange(size, 1, 16, "QR size");
  assertIntegerRange(data.byteLength, 1, 7089, "QR data length");

  const storeLength           = data.byteLength + 3;
  const [storeLow, storeHigh] = bytePair(storeLength, "QR data");

  return concatBytes([
    Uint8Array.from([GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0]),
    Uint8Array.from([GS, 0x28, 0x6b, 3, 0, 49, 67, size]),
    Uint8Array.from([GS, 0x28, 0x6b, 3, 0, 49, 69, errorByte]),
    Uint8Array.from([GS, 0x28, 0x6b, storeLow, storeHigh, 49, 80, 48]),
    data,
    Uint8Array.from([GS, 0x28, 0x6b, 3, 0, 49, 81, 48])
  ]);
}

// 바코드 명령은 출력 설정과 데이터 명령을 같은 버퍼로 묶습니다
function buildBarcodeBytes(value: string, options: ReceiptBarcodeOptions): Uint8Array {
  const type     = options.type ?? "code39";
  const width    = options.width ?? 3;
  const height   = options.height ?? 80;
  const hri      = options.hri ?? "below";
  const typeByte = BARCODE_TYPE_BYTES[type];
  const hriByte  = BARCODE_HRI_BYTES[hri];
  const data     = encodeBarcodeData(value, type);

  // 타입을 우회한 바코드 옵션은 바이트 매핑 전에 거부합니다
  if (typeof typeByte !== "number") {
    throwEncodingError("Barcode type is invalid");
  }

  if (typeof hriByte !== "number") {
    throwEncodingError("Barcode hri is invalid");
  }

  assertIntegerRange(width, 2, 6, "Barcode width");
  assertIntegerRange(height, 1, 255, "Barcode height");

  return concatBytes([
    Uint8Array.from([GS, 0x77, width]),
    Uint8Array.from([GS, 0x68, height]),
    Uint8Array.from([GS, 0x48, hriByte]),
    Uint8Array.from([GS, 0x6b, typeByte, data.byteLength]),
    data
  ]);
}

// 이미지 데이터는 픽셀별 흑백 값을 ESC/POS 가로 바이트 단위로 접습니다
function buildImageBytes(input: ReceiptImageInput, options: ReceiptImageOptions): Uint8Array {
  const width      = input.width;
  const height     = input.height;
  const pixels     = normalizeByteArray(input.data, "Image data");
  const widthBytes = Math.ceil(width / 8);
  const modeByte   = IMAGE_MODE_BYTES[options.mode ?? "normal"];

  if (typeof modeByte !== "number") {
    throwEncodingError("Image mode is invalid");
  }

  assertIntegerRange(width, 1, 65535 * 8, "Image width");
  assertIntegerRange(height, 1, 65535, "Image height");

  // 픽셀 수가 크기와 맞지 않으면 잘못된 raster 명령이 되므로 중단합니다
  if (pixels.byteLength !== width * height) {
    throwEncodingError("Image data length must match width and height");
  }

  const [widthLow, widthHigh]   = bytePair(widthBytes, "Image width");
  const [heightLow, heightHigh] = bytePair(height, "Image height");
  const raster                  = new Uint8Array(widthBytes * height);

  // 프린터는 각 픽셀을 왼쪽 상위 비트부터 한 바이트씩 읽습니다
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((pixels[y * width + x] ?? 0) > 0) {
        const rasterIndex = y * widthBytes + Math.floor(x / 8);

        raster[rasterIndex] = (raster[rasterIndex] ?? 0) | (0x80 >> (x % 8));
      }
    }
  }

  return concatBytes([
    Uint8Array.from([
      GS,
      0x76,
      0x30,
      modeByte,
      widthLow,
      widthHigh,
      heightLow,
      heightHigh
    ]),
    raster
  ]);
}

// 바코드 데이터 검증
// 바코드 종류마다 장비가 요구하는 입력 형식을 먼저 검증합니다
function encodeBarcodeData(value: string, type: BarcodeType): Uint8Array {
  switch (type) {
    case "upc-a":
      assertPattern(value, /^\d{11,12}$/, "UPC-A barcode data must be 11 or 12 digits");
      break;

    case "upc-e":
      assertPattern(value, /^\d{6,8}$/, "UPC-E barcode data must be 6 to 8 digits");
      break;

    case "ean13":
      assertPattern(value, /^\d{12,13}$/, "EAN13 barcode data must be 12 or 13 digits");
      break;

    case "ean8":
      assertPattern(value, /^\d{7,8}$/, "EAN8 barcode data must be 7 or 8 digits");
      break;

    case "code39":
      assertPattern(value, /^[0-9A-Z $%*+\-./]+$/, "Code39 barcode data contains unsupported characters");
      break;

    case "itf":
      assertPattern(value, /^(?:\d{2})+$/, "ITF barcode data must be an even number of digits");
      break;

    case "codabar":
      assertPattern(value, /^[A-Da-d][0-9A-Da-d$:+\-./]+[A-Da-d]$/, "Codabar barcode data is invalid");
      break;

    case "code93":
      assertAscii(value, "Code93 barcode data");
      break;

    case "code128":
      assertPattern(value, /^\{[ABC].+$/, "Code128 barcode data must start with {A, {B, or {C");
      break;

    default:
      throwEncodingError("Barcode type is invalid");
  }

  const data = encodeAsciiBytes(value, "Barcode data");

  assertIntegerRange(data.byteLength, 1, 255, "Barcode data length");

  return data;
}

// 바이트 배열 헬퍼
// 여러 ESC/POS 조각을 순서 보존한 단일 배열로 합칩니다
function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let   offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

// ESC/POS 길이 필드는 하위 바이트와 상위 바이트로 나눕니다
function bytePair(value: number, name: string): [number, number] {
  assertIntegerRange(value, 0, 65535, `${name} length`);

  return [value & 0xff, value >> 8];
}

// 일반 배열 입력은 바이트 범위를 검증한 뒤 Uint8Array로 통일합니다
function normalizeByteArray(value: Uint8Array | number[], name: string): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (!Array.isArray(value)) {
    throwEncodingError(`${name} must be a byte array`);
  }

  for (const item of value) {
    assertIntegerRange(item, 0, 255, name);
  }

  return Uint8Array.from(value);
}

// 영수증 행 레이아웃 헬퍼
// 컬럼 텍스트는 자른 뒤 정렬 방향에 맞게 빈칸을 채웁니다
function formatColumn(column: ReceiptColumn): string {
  const text = truncate(column.text, column.width);

  if (column.align === "right") {
    return text.padStart(column.width);
  }

  if (column.align === "center") {
    const remaining = column.width - text.length;
    const left      = Math.floor(remaining / 2);
    const right     = remaining - left;

    return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
  }

  return text.padEnd(column.width);
}

// 문자 단위 폭 검증 후 지정 폭을 넘는 텍스트를 잘라냅니다
function truncate(value: string, width: number): string {
  if (!Number.isInteger(width) || width < 1) {
    throw new PrinterError({
      code   : "ERR_ENCODING_FAILED",
      message: "Column width must be a positive integer"
    });
  }

  return Array.from(value).slice(0, width).join("");
}

// 인코딩 입력 검증 헬퍼
function assertPattern(value: string, pattern: RegExp, message: string): void {
  if (!pattern.test(value)) {
    throwEncodingError(message);
  }
}

function assertAscii(value: string, name: string): void {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    if (code < 0x20 || code > 0x7e) {
      throwEncodingError(`${name} must contain printable ASCII only`);
    }
  }
}

function assertScale(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw new PrinterError({
      code   : "ERR_ENCODING_FAILED",
      message: `Text size ${name} must be an integer between 1 and 8`
    });
  }
}

function assertIntegerRange(value: number, min: number, max: number, name: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throwEncodingError(`${name} must be an integer between ${min} and ${max}`);
  }
}

function throwEncodingError(message: string): never {
  throw new PrinterError({
    code: "ERR_ENCODING_FAILED",
    message
  });
}

// 텍스트 인코딩 헬퍼
// 검증이 필요한 ESC/POS 데이터는 출력 가능한 ASCII만 바이트화합니다
function encodeAsciiBytes(value: string, name: string): Uint8Array {
  assertAscii(value, name);

  return Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0)));
}

// 영수증 본문 ASCII 변환은 비ASCII 문자를 물음표로 낮춥니다
function encodeAscii(value: string): Uint8Array {
  return Uint8Array.from(Array.from(value, (char) => {
    const code = char.codePointAt(0) ?? 0x3f;

    return code <= 0x7f ? code : 0x3f;
  }));
}
