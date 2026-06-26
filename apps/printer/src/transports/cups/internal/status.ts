import type { CupsPrinterTarget, PrinterStatus } from "#core";

import type { CupsPrinterDependencies } from "../types.js";
import { resolveCupsDependencies } from "./dependencies.js";
import { assertSupportedPlatform } from "./platform.js";
import { runCupsCommand } from "./runner.js";

// Status query

// lpstat 출력의 상태 문구와 printer-state-reasons 토큰을 정규화합니다 (ESC/POS 불필요)
export function decodeCupsStatus(output: string): Omit<PrinterStatus, "target" | "source"> {
  const normalized = output.toLowerCase();

  return {
    online   : !normalized.includes("disabled"),
    busy     : normalized.includes("now printing") || normalized.includes("processing"),
    paperOut : hasReason(normalized, ["media-empty", "media-needed", "paper-out", "out of paper"]),
    paperJam : hasReason(normalized, ["media-jam", "jam"]),
    coverOpen: hasReason(normalized, ["cover-open", "door-open", "cover open"]),
    error    : hasReason(normalized, ["error", "marker-supply-empty"]),
    raw      : { output: output.trim() }
  };
}

// CUPS lpstat 장문 출력에서 대상 프린터의 상태를 조회합니다
export async function getCupsStatus(
  target: CupsPrinterTarget,
  dependencies: CupsPrinterDependencies = {}
): Promise<PrinterStatus> {
  const resolved = resolveCupsDependencies(dependencies);

  assertSupportedPlatform(resolved.platform);

  const result = await runCupsCommand(
    resolved.runner,
    {
      command  : "lpstat",
      args     : ["-l", "-p", target.printerName],
      timeoutMs: resolved.defaultTimeoutMs
    },
    "lpstat"
  );

  return {
    target,
    source: "cups",
    ...decodeCupsStatus(result.stdout)
  };
}

// 정규화된 출력에 reason 토큰 중 하나라도 포함되는지 검사합니다
function hasReason(normalized: string, tokens: string[]): boolean {
  return tokens.some((token) => normalized.includes(token));
}
