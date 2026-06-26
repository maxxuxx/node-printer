import { PrinterError, type PrinterStatus, type WinspoolPrinterTarget } from "#core";

import { assertWindows, loadWinspoolBinding } from "../binding.js";
import type { WinspoolBinding } from "../types.js";
import { listWinspoolPrinters } from "./list-printers.js";

// Windows Spooler PRINTER_STATUS 비트 플래그입니다
const PRINTER_STATUS_PAUSED            = 0x00000001;
const PRINTER_STATUS_ERROR             = 0x00000002;
const PRINTER_STATUS_PAPER_JAM         = 0x00000008;
const PRINTER_STATUS_PAPER_OUT         = 0x00000010;
const PRINTER_STATUS_PAPER_PROBLEM     = 0x00000040;
const PRINTER_STATUS_OFFLINE           = 0x00000080;
const PRINTER_STATUS_BUSY              = 0x00000200;
const PRINTER_STATUS_PRINTING          = 0x00000400;
const PRINTER_STATUS_OUT_OF_MEMORY     = 0x00200000;
const PRINTER_STATUS_DOOR_OPEN         = 0x00400000;
const PRINTER_STATUS_USER_INTERVENTION = 0x00100000;

// Status query

// OS 스풀러가 보고한 status 비트를 정규화된 상태로 디코딩합니다 (ESC/POS 불필요)
export function decodeWinspoolStatus(status: number): Omit<PrinterStatus, "target" | "source"> {
  const hasErrorFlag =
    (status & (PRINTER_STATUS_ERROR | PRINTER_STATUS_PAPER_PROBLEM | PRINTER_STATUS_OUT_OF_MEMORY | PRINTER_STATUS_USER_INTERVENTION)) !== 0;

  return {
    online   : (status & PRINTER_STATUS_OFFLINE) === 0,
    paperOut : (status & PRINTER_STATUS_PAPER_OUT) !== 0,
    paperJam : (status & PRINTER_STATUS_PAPER_JAM) !== 0,
    coverOpen: (status & PRINTER_STATUS_DOOR_OPEN) !== 0,
    paused   : (status & PRINTER_STATUS_PAUSED) !== 0,
    busy     : (status & (PRINTER_STATUS_BUSY | PRINTER_STATUS_PRINTING)) !== 0,
    error    : hasErrorFlag,
    raw      : { status }
  };
}

// winspool 프린터 목록에서 대상 프린터의 status를 찾아 상태를 조회합니다
export async function getWinspoolStatus(
  target: WinspoolPrinterTarget,
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<PrinterStatus> {
  assertWindows();

  const printers = await listWinspoolPrinters(binding);
  const printer  = printers.find((item) => item.name === target.printerName);

  if (!printer) {
    throw new PrinterError({
      code   : "ERR_PRINTER_NOT_FOUND",
      message: `Winspool printer was not found: ${target.printerName}`
    });
  }

  return {
    target,
    source: "winspool",
    ...decodeWinspoolStatus(printer.status ?? 0)
  };
}
