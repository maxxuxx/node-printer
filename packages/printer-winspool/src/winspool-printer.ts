import { PrinterError, type PrintResult, type WinspoolPrinterTarget } from "@node-printer/printer-core";

import { assertWindows, loadWinspoolBinding } from "./binding.js";
import type {
  WinspoolBinding,
  WinspoolPrintRawOptions,
  WinspoolPrinter,
  WinspoolPrinterInfo
} from "./types.js";

const DEFAULT_DOCUMENT_NAME = "RAW Document";

// Public API

// native 목록과 기본 프린터 이름을 합쳐 TS용 printer info를 만듦
export async function listWinspoolPrinters(
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<WinspoolPrinterInfo[]> {
  assertWindows();

  // 목록 조회와 기본 프린터 조회를 병렬로 요청함
  const [printers, defaultPrinterName] = await Promise.all([
    binding.listPrinters(),
    binding.getDefaultPrinter()
  ]);

  return printers.map((printer) => ({
    ...printer,
    isDefault: printer.name === defaultPrinterName
  }));
}

// 기본 프린터 이름으로 목록 결과를 보강해 반환함
export async function getDefaultWinspoolPrinter(
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<WinspoolPrinterInfo | null> {
  assertWindows();

  const defaultPrinterName = await binding.getDefaultPrinter();

  // 기본 프린터가 없으면 null로 공개 API 계약을 맞춤
  if (!defaultPrinterName) {
    return null;
  }

  const printer = (await listWinspoolPrinters(binding)).find(
    (item) => item.name === defaultPrinterName
  );

  // 목록 조회에 없더라도 기본 프린터 이름은 보존함
  return printer ?? {
    name     : defaultPrinterName,
    isDefault: true
  };
}

// raw 출력 옵션을 검증한 뒤 native binding 호출 결과를 감쌈
export async function printRaw(
  options: WinspoolPrintRawOptions,
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<{
  ok          : true;
  printerName : string;
  jobId      ?: number;
  bytesWritten: number;
}> {
  assertWindows();
  validatePrintOptions(options);

  // 문서명이 없으면 공통 기본값을 채워 native로 전달함
  const result = await binding.printRaw({
    ...options,
    documentName: options.documentName ?? DEFAULT_DOCUMENT_NAME
  });

  return {
    ok          : true,
    printerName : options.printerName,
    jobId       : result.jobId,
    bytesWritten: result.bytesWritten
  };
}

// target을 검증하고 재사용 가능한 transport 인스턴스를 만듦
export function createWinspoolPrinter(
  target: WinspoolPrinterTarget,
  binding: WinspoolBinding = loadWinspoolBinding()
): WinspoolPrinter {
  assertWindows();
  validateTarget(target);

  return new WinspoolPrinterTransport(target, binding);
}

// Transport

class WinspoolPrinterTransport implements WinspoolPrinter {
  readonly target: WinspoolPrinterTarget;

  // transport target에 기본 문서명을 고정해 이후 출력에서 재사용함
  constructor(target: WinspoolPrinterTarget, private readonly binding: WinspoolBinding) {
    this.target = {
      ...target,
      documentName: target.documentName ?? DEFAULT_DOCUMENT_NAME
    };
  }

  // transport print 호출을 printRaw 계약과 PrintResult 계약 사이에서 변환함
  async print(data: Uint8Array): Promise<PrintResult> {
    const startedAt = Date.now();
    const result    = await printRaw(
      {
        printerName : this.target.printerName,
        data,
        documentName: this.target.documentName
      },
      this.binding
    );

    return {
      ok          : true,
      target      : this.target,
      jobId       : result.jobId,
      bytesWritten: result.bytesWritten,
      durationMs  : Date.now() - startedAt
    };
  }
}

// Validation

// transport 생성 단계에서 printerName 필수값을 확인함
function validateTarget(target: WinspoolPrinterTarget): void {
  if (!target.printerName) {
    throw new PrinterError({
      code: "ERR_INVALID_TARGET",
      message: "Winspool printerName is required"
    });
  }
}

// raw 출력 진입점에서 printerName과 데이터 존재 여부를 검증함
function validatePrintOptions(options: WinspoolPrintRawOptions): void {
  // 프린터 이름 누락은 native 호출 전에 사용자 입력 오류로 차단함
  if (!options.printerName) {
    throw new PrinterError({
      code: "ERR_INVALID_TARGET",
      message: "Winspool printerName is required"
    });
  }

  // 빈 데이터는 native 호출 전에 사용자 입력 오류로 차단함
  if (!options.data.byteLength) {
    throw new PrinterError({
      code: "ERR_INVALID_TARGET",
      message: "Winspool print data is required"
    });
  }
}
