import {
  type PaperCapabilities,
  type PrinterStatus,
  type PrintResult,
  type SystemPrinterTarget
} from "#core";

import { resolveSystemBackend } from "./internal/platform.js";
import type { SystemPrinterDependencies, SystemPrinterInfo } from "./types.js";

export async function printSystem(
  target: SystemPrinterTarget,
  data: Uint8Array,
  dependencies: SystemPrinterDependencies = {}
): Promise<PrintResult> {
  const backend = resolveSystemBackend(target, dependencies.platform);

  if (backend === "winspool") {
    const { createWinspoolPrinter } = await import("#winspool");

    return createWinspoolPrinter({
      type         : "winspool",
      printerName  : target.printerName,
      documentName : target.documentName
    }, dependencies.winspool).print(data);
  }

  const { printRaw } = await import("#cups");

  return printRaw({
    type         : "cups",
    printerName  : target.printerName,
    documentName : target.documentName,
    timeoutMs    : target.timeoutMs
  }, data, dependencies.cups);
}

export async function listSystemPrinters(
  dependencies: SystemPrinterDependencies = {}
): Promise<SystemPrinterInfo[]> {
  const target: SystemPrinterTarget = {
    type        : "system",
    printerName : "discovery",
    backend     : "auto"
  };
  const backend = resolveSystemBackend(target, dependencies.platform);

  if (backend === "winspool") {
    const { listWinspoolPrinters } = await import("#winspool");
    return listWinspoolPrinters(dependencies.winspool);
  }

  const { listCupsPrinters } = await import("#cups");
  return listCupsPrinters(dependencies.cups);
}

export async function getSystemStatus(
  target: SystemPrinterTarget,
  dependencies: SystemPrinterDependencies = {}
): Promise<PrinterStatus> {
  const backend = resolveSystemBackend(target, dependencies.platform);

  if (backend === "winspool") {
    const { getWinspoolStatus } = await import("#winspool");
    const status = await getWinspoolStatus({
      type        : "winspool",
      printerName : target.printerName
    }, dependencies.winspool);
    return { ...status, target };
  }

  const { getCupsStatus } = await import("#cups");
  const status = await getCupsStatus({
    type        : "cups",
    printerName : target.printerName,
    timeoutMs   : target.timeoutMs
  }, dependencies.cups);
  return { ...status, target };
}

export async function getSystemPaperInfo(
  target: SystemPrinterTarget,
  dependencies: SystemPrinterDependencies = {}
): Promise<PaperCapabilities> {
  const backend = resolveSystemBackend(target, dependencies.platform);

  if (backend === "winspool") {
    const { getWinspoolPaperInfo } = await import("#winspool");
    return getWinspoolPaperInfo({
      type        : "winspool",
      printerName : target.printerName
    }, dependencies.winspool);
  }

  const { getCupsPaperInfo } = await import("#cups");
  return getCupsPaperInfo({
    type        : "cups",
    printerName : target.printerName,
    timeoutMs   : target.timeoutMs
  }, dependencies.cups);
}
