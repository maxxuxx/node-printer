import { PrinterError, type PaperCapabilities, type WinspoolPrinterTarget } from "#core";

import { assertWindows, loadWinspoolBinding } from "../binding.js";
import type { WinspoolBinding } from "../types.js";

// Paper capabilities

// 드라이버에 설정된 용지 너비 정보를 native(GetDeviceCaps)에서 조회합니다
export async function getWinspoolPaperInfo(
  target: WinspoolPrinterTarget,
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<PaperCapabilities> {
  assertWindows();

  // 구버전 prebuild로는 capabilities 함수가 없을 수 있어 명시 오류로 안내합니다
  if (typeof binding.getPrinterCapabilities !== "function") {
    throw new PrinterError({
      code   : "ERR_NATIVE_MODULE_UNAVAILABLE",
      message: "Winspool prebuild does not support getPrinterCapabilities. Rebuild the native prebuild."
    });
  }

  const capabilities = await binding.getPrinterCapabilities(target.printerName);

  return {
    printableWidthDots: toPositive(capabilities.printableWidthDots),
    widthMm           : toPositive(capabilities.widthMm),
    dpi               : toPositive(capabilities.dpi)
  };
}

// 0 이하 값은 의미 없는 측정으로 보고 undefined로 정리합니다
function toPositive(value: number | undefined): number | undefined {
  return typeof value === "number" && value > 0 ? value : undefined;
}
