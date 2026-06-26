import type { ReceiptFont } from "./receipt/types.js";
import type { PrinterTarget } from "./types.js";

// Paper / width model

// 용지 너비를 어떤 근거로 결정했는지 표시합니다
export type PaperWidthSource = "system" | "manual" | "default";

// 흔히 쓰는 열전사 용지 프리셋입니다 (203dpi 기준)
export type PaperPreset = "58mm" | "80mm";

export interface PaperInfo {
  target            : PrinterTarget;
  source            : PaperWidthSource;
  font              : ReceiptFont;
  columns           : number;
  widthMm           ?: number;
  printableWidthDots?: number;
  dpi               ?: number;
}

// 시스템 조회 결과로 들어오는 물리 용지 정보입니다
export interface PaperCapabilities {
  printableWidthDots?: number;
  widthMm           ?: number;
  dpi               ?: number;
}

// 폰트별 1글자 가로 도트 폭입니다 (203dpi 표준 열전사 기준)
export const FONT_CHAR_WIDTH_DOTS: Record<ReceiptFont, number> = {
  a: 12,
  b: 9
};

// 프리셋별 인쇄 가능 도트 폭과 물리 너비입니다
export const PAPER_PRESETS: Record<PaperPreset, Required<Pick<PaperCapabilities, "printableWidthDots" | "widthMm">>> = {
  "58mm": { printableWidthDots: 384, widthMm: 58 },
  "80mm": { printableWidthDots: 576, widthMm: 80 }
};

// 시스템 너비를 못 구하고 프리셋도 없을 때 사용하는 기본 글자 수입니다
export const DEFAULT_COLUMNS = 42;

// 표준 열전사 해상도입니다 (widthMm만 있을 때 도트 환산에 사용)
export const DEFAULT_DPI = 203;

// 인쇄 가능 도트 폭과 폰트로 한 줄 글자 수를 계산합니다
export function columnsFromDots(printableWidthDots: number, font: ReceiptFont = "a"): number {
  const charWidth = FONT_CHAR_WIDTH_DOTS[font] ?? FONT_CHAR_WIDTH_DOTS.a;

  return Math.max(1, Math.floor(printableWidthDots / charWidth));
}

// 물리 너비(mm)와 해상도로 인쇄 가능 도트 폭을 환산합니다
export function dotsFromMm(widthMm: number, dpi: number = DEFAULT_DPI): number {
  return Math.round((widthMm / 25.4) * dpi);
}

// 프리셋 이름을 용지 정보로 변환합니다
export function paperPresetToCapabilities(preset: PaperPreset): PaperCapabilities {
  const value = PAPER_PRESETS[preset];

  return { printableWidthDots: value.printableWidthDots, widthMm: value.widthMm, dpi: DEFAULT_DPI };
}

// 용지 정보에서 인쇄 가능 도트 폭을 우선순위에 따라 도출합니다
export function resolvePrintableDots(capabilities: PaperCapabilities): number | undefined {
  if (typeof capabilities.printableWidthDots === "number" && capabilities.printableWidthDots > 0) {
    return capabilities.printableWidthDots;
  }

  if (typeof capabilities.widthMm === "number" && capabilities.widthMm > 0) {
    return dotsFromMm(capabilities.widthMm, capabilities.dpi ?? DEFAULT_DPI);
  }

  return undefined;
}
