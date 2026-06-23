import type { PrintResult, SerialPrinterTarget } from "#core";

import { listSerialPorts, resolveSerialPortConstructor } from "./internal/serialport.js";
import { SerialPrinterTransport } from "./internal/transport.js";
import type { SerialPortInfo, SerialPrinterDependencies } from "./types.js";

// Public API

export { listSerialPorts, SerialPrinterTransport };
export type { SerialPortInfo };

export async function printSerial(
  target: SerialPrinterTarget,
  data: Uint8Array,
  dependencies: SerialPrinterDependencies = {}
): Promise<PrintResult> {
  return createSerialPrinter(target, dependencies).print(data);
}

export function createSerialPrinter(
  target: SerialPrinterTarget,
  dependencies: SerialPrinterDependencies = {}
): SerialPrinterTransport {
  return new SerialPrinterTransport(target, resolveSerialPortConstructor(dependencies));
}
