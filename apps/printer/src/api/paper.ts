import {
  columnsFromDots,
  DEFAULT_COLUMNS,
  paperPresetToCapabilities,
  PrinterError,
  resolvePrintableDots,
  type CupsPrinterTarget,
  type PaperCapabilities,
  type PaperInfo,
  type PaperPreset,
  type PrinterTarget,
  type ReceiptFont,
  type WinspoolPrinterTarget
} from "#core";

import type { PrinterMethodOptions } from "./types.js";

// Paper width options

export interface PaperInfoOptions extends PrinterMethodOptions {
  // 시스템 프린터(winspool/cups)에서 드라이버 너비를 사용할지 여부입니다 (기본 true)
  useSystemWidth?: boolean;
  // columns 계산에 사용할 폰트 폭 기준입니다 (기본 "a")
  font          ?: ReceiptFont;
  // 시스템 조회 성공 후 너비를 못 구할 때 사용할 수동 용지 지정입니다
  paper         ?: PaperPreset | PaperCapabilities;
  // 모든 자동 계산을 무시하고 강제할 columns 값입니다
  columns       ?: number;
}

// Paper width resolution

// columns 명시 > 시스템 너비 > 수동 용지 > 기본값 순으로 용지 정보를 결정합니다
export async function getPaperInfo(
  target: PrinterTarget,
  options: PaperInfoOptions = {}
): Promise<PaperInfo> {
  const font = options.font ?? "a";

  // 1순위: 사용자가 columns를 직접 지정하면 그대로 사용합니다
  if (typeof options.columns === "number") {
    return { target, source: "manual", font, columns: options.columns };
  }

  // 2순위: 시스템 프린터의 드라이버 너비 (기본 활성화, 너비 미검출 시 폴백)
  if (options.useSystemWidth ?? true) {
    const systemInfo = await querySystemCapabilities(target, options);
    const resolved   = systemInfo && toPaperInfo(target, "system", font, systemInfo);

    if (resolved) {
      return resolved;
    }
  }

  // 3순위: 수동으로 선언한 용지 프리셋 또는 측정값
  if (options.paper) {
    const capabilities = typeof options.paper === "string"
      ? paperPresetToCapabilities(options.paper)
      : options.paper;
    const resolved     = toPaperInfo(target, "manual", font, capabilities);

    if (resolved) {
      return resolved;
    }
  }

  // 4순위: 어떤 너비도 못 구하면 기본 columns로 폴백합니다
  return { target, source: "default", font, columns: DEFAULT_COLUMNS };
}

// 최종 columns 값만 빠르게 얻는 편의 함수입니다 (createReceipt({ columns }) 연동용)
export async function resolveColumns(
  target: PrinterTarget,
  options: PaperInfoOptions = {}
): Promise<number> {
  return (await getPaperInfo(target, options)).columns;
}

// 용지 측정값을 columns가 포함된 PaperInfo로 환산합니다 (도트 환산 불가 시 undefined)
function toPaperInfo(
  target: PrinterTarget,
  source: PaperInfo["source"],
  font: ReceiptFont,
  capabilities: PaperCapabilities
): PaperInfo | undefined {
  const printableWidthDots = resolvePrintableDots(capabilities);

  if (typeof printableWidthDots !== "number") {
    return undefined;
  }

  return {
    target,
    source,
    font,
    columns: columnsFromDots(printableWidthDots, font),
    printableWidthDots,
    widthMm: capabilities.widthMm,
    dpi    : capabilities.dpi
  };
}

// 시스템 프린터(winspool/cups)에서만 드라이버 너비를 조회합니다
async function querySystemCapabilities(
  target: PrinterTarget,
  options: PaperInfoOptions
): Promise<PaperCapabilities | undefined> {
  if (target.type === "winspool") {
    // Windows가 아니면 winspool 너비 조회 실패를 명시 오류로 전달합니다
    if (process.platform !== "win32") {
      throw new PrinterError({
        code   : "ERR_UNSUPPORTED_PLATFORM",
        message: "Winspool paper info is only supported on Windows"
      });
    }

    const { getWinspoolPaperInfo } = await import("#winspool");

    return getWinspoolPaperInfo(target as WinspoolPrinterTarget, options.winspool);
  }

  if (target.type === "cups") {
    const { getCupsPaperInfo } = await import("#cups");

    return getCupsPaperInfo(target as CupsPrinterTarget, options.cups);
  }

  // serial/network 직접 연결은 시스템 너비를 제공하지 않습니다
  return undefined;
}
