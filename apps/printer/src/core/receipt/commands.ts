import {
  BARCODE_HRI_BYTES,
  BARCODE_TYPE_BYTES,
  GS,
  IMAGE_MODE_BYTES,
  QR_ERROR_CORRECTION_BYTES
} from "./constants.js";
import {
  bytePair,
  concatBytes,
  encodeAsciiBytes,
  normalizeByteArray
} from "./bytes.js";
import type {
  BarcodeType,
  ReceiptBarcodeOptions,
  ReceiptImageInput,
  ReceiptImageOptions,
  ReceiptQrOptions
} from "./types.js";
import {
  assertAscii,
  assertIntegerRange,
  assertPattern
} from "./validators.js";
import { throwEncodingError } from "./errors.js";

// ESC/POS command builders

export function buildQrBytes(data: Uint8Array, options: ReceiptQrOptions): Uint8Array {
  const size            = options.size ?? 6;
  const errorCorrection = options.errorCorrection ?? "m";
  const errorByte       = QR_ERROR_CORRECTION_BYTES[errorCorrection];

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

export function buildBarcodeBytes(
  value: string,
  options: ReceiptBarcodeOptions
): Uint8Array {
  const type     = options.type ?? "code39";
  const width    = options.width ?? 3;
  const height   = options.height ?? 80;
  const hri      = options.hri ?? "below";
  const typeByte = BARCODE_TYPE_BYTES[type];
  const hriByte  = BARCODE_HRI_BYTES[hri];
  const data     = encodeBarcodeData(value, type);

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

export function buildImageBytes(
  input: ReceiptImageInput,
  options: ReceiptImageOptions
): Uint8Array {
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

  if (pixels.byteLength !== width * height) {
    throwEncodingError("Image data length must match width and height");
  }

  const [widthLow, widthHigh]   = bytePair(widthBytes, "Image width");
  const [heightLow, heightHigh] = bytePair(height, "Image height");
  const raster                  = new Uint8Array(widthBytes * height);

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
