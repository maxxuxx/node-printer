import type { CupsPrinterTarget, PaperCapabilities } from "#core";

import type { CupsPrinterDependencies } from "../types.js";
import { resolveCupsDependencies } from "./dependencies.js";
import { assertSupportedPlatform } from "./platform.js";
import { runCupsCommand } from "./runner.js";

// Paper capabilities

// lpoptions의 PageSize 선택값에서 용지 너비(mm)를 best-effort로 추출합니다
export async function getCupsPaperInfo(
  target: CupsPrinterTarget,
  dependencies: CupsPrinterDependencies = {}
): Promise<PaperCapabilities> {
  const resolved = resolveCupsDependencies(dependencies);

  assertSupportedPlatform(resolved.platform);

  const result = await runCupsCommand(
    resolved.runner,
    {
      command  : "lpoptions",
      args     : ["-p", target.printerName, "-l"],
      timeoutMs: resolved.defaultTimeoutMs
    },
    "lpoptions"
  );

  const widthMm = parsePageWidthMm(result.stdout);

  return widthMm === undefined ? {} : { widthMm };
}

// PageSize 옵션 줄에서 선택된(*) 항목의 너비 mm를 파싱합니다
export function parsePageWidthMm(output: string): number | undefined {
  const pageSizeLine = output
    .split(/\r?\n/)
    .find((line) => /^pagesize\b/i.test(line.trim()));

  if (!pageSizeLine) {
    return undefined;
  }

  // 선택 표시(*) 다음의 옵션 토큰을 우선 사용하고, 없으면 줄 전체에서 너비를 찾습니다
  const selected = /\*([^\s]+)/.exec(pageSizeLine)?.[1] ?? pageSizeLine;

  return extractWidthMm(selected) ?? extractWidthMm(pageSizeLine);
}

// "80x297mm", "Custom.80x297mm", "X80MM" 같은 토큰에서 너비 mm를 추출합니다
function extractWidthMm(token: string): number | undefined {
  const matrixMatch = /(\d+(?:\.\d+)?)\s*x\s*\d+(?:\.\d+)?\s*mm/i.exec(token);

  if (matrixMatch?.[1]) {
    return Number(matrixMatch[1]);
  }

  const singleMatch = /(\d+(?:\.\d+)?)\s*mm/i.exec(token);

  if (singleMatch?.[1]) {
    return Number(singleMatch[1]);
  }

  return undefined;
}
