import type {
  BarcodeHriPosition,
  BarcodeType,
  ImageMode,
  QrErrorCorrection,
  TextAlign
} from "./types.js";

export const ESC = 0x1b;
export const GS  = 0x1d;
export const LF  = 0x0a;

export const ALIGN_BYTES: Record<TextAlign, number> = {
  left  : 0,
  center: 1,
  right : 2
};

export const QR_ERROR_CORRECTION_BYTES: Record<QrErrorCorrection, number> = {
  l: 48,
  m: 49,
  q: 50,
  h: 51
};

export const BARCODE_TYPE_BYTES: Record<BarcodeType, number> = {
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

export const BARCODE_HRI_BYTES: Record<BarcodeHriPosition, number> = {
  none : 0,
  above: 1,
  below: 2,
  both : 3
};

export const IMAGE_MODE_BYTES: Record<ImageMode, number> = {
  normal         : 0,
  "double-width": 1,
  "double-height": 2,
  quad           : 3
};
