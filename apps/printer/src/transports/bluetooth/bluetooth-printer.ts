import {
  type BluetoothPrinterTarget,
  PrinterError,
  type PrinterStatus,
  type PrintResult,
  type SerialPrinterTarget,
  type SystemPrinterTarget
} from "#core";

import { printBluetoothBle } from "./internal/ble-transport.js";
import { listBluetoothPrinters } from "./internal/resolver.js";
import type { BluetoothPrinterDependencies } from "./types.js";

export { listBluetoothPrinters };

export async function printBluetooth(
  target: BluetoothPrinterTarget,
  data: Uint8Array,
  dependencies: BluetoothPrinterDependencies = {}
): Promise<PrintResult> {
  if (target.mode === "spp") {
    const { printSerial } = await import("#serial");
    const serialTarget: SerialPrinterTarget = {
      type       : "serial",
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

    return printSerial(serialTarget, data, dependencies.serial);
  }

  if (target.mode === "system") {
    const { printSystem } = await import("#system");
    const systemTarget: SystemPrinterTarget = {
      type        : "system",
      printerName : target.printerName,
      documentName: target.documentName,
      timeoutMs   : target.timeoutMs,
      backend     : target.backend
    };

    return printSystem(systemTarget, data, dependencies.system);
  }

  return printBluetoothBle(target, data, dependencies.ble);
}

export async function getBluetoothStatus(
  target: BluetoothPrinterTarget,
  dependencies: BluetoothPrinterDependencies = {}
): Promise<PrinterStatus> {
  if (target.mode === "spp") {
    const { getSerialStatus } = await import("#serial");
    const status = await getSerialStatus({
      type       : "serial",
      path       : target.path,
      baudRate   : target.baudRate,
      dataBits   : target.dataBits,
      stopBits   : target.stopBits,
      parity     : target.parity,
      flowControl: target.flowControl,
      timeoutMs  : target.timeoutMs,
      chunkSize  : target.chunkSize,
      idleCloseMs: target.idleCloseMs
    }, dependencies.serial);
    return { ...status, target };
  }

  if (target.mode === "system") {
    const { getSystemStatus } = await import("#system");
    return getSystemStatus({
      type        : "system",
      printerName : target.printerName,
      documentName: target.documentName,
      timeoutMs   : target.timeoutMs,
      backend     : target.backend
    }, dependencies.system).then((status) => ({ ...status, target }));
  }

  if (dependencies.ble?.getStatus) {
    return dependencies.ble.getStatus(target);
  }

  throw new PrinterError({
    code   : "ERR_UNSUPPORTED_PLATFORM",
    message: "The Bluetooth LE adapter does not provide printer status"
  });
}
