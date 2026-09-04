import type { PrinterTarget } from "#core";

import type { PrinterMethodOptions } from "./types.js";

export async function closePrinter(
  target: PrinterTarget,
  options: PrinterMethodOptions = {}
): Promise<void> {
  if (target.type === "serial") {
    const { createSerialPrinter } = await import("#serial");
    await createSerialPrinter(target, options.serial).close();
    return;
  }

  if (target.type === "bluetooth" && target.mode === "spp") {
    const { createSerialPrinter } = await import("#serial");
    const serialTarget = {
      type       : "serial" as const,
      path       : target.path,
      baudRate   : target.baudRate,
      dataBits   : target.dataBits,
      stopBits   : target.stopBits,
      parity     : target.parity,
      flowControl: target.flowControl,
      timeoutMs  : target.timeoutMs,
      chunkSize  : target.chunkSize,
      idleCloseMs: target.idleCloseMs
    };
    await createSerialPrinter(serialTarget, options.bluetooth?.serial).close();
  }
}

export async function closeAllPrinters(): Promise<void> {
  const { closeAllSerialSessions } = await import("#serial");
  await closeAllSerialSessions();
}
