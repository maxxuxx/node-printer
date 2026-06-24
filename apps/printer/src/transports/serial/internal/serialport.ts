import type { SerialPortConstructor, SerialPortInfo, SerialPrinterDependencies } from "../types.js";
import { getBundledSerialPortConstructor } from "./bundled-serialport.js";

// Serialport binding resolution

export function resolveSerialPortConstructor(
  dependencies: SerialPrinterDependencies = {}
): SerialPortConstructor {
  return dependencies.SerialPort ?? getBundledSerialPortConstructor();
}

export async function listSerialPorts(
  dependencies: SerialPrinterDependencies = {}
): Promise<SerialPortInfo[]> {
  if (dependencies.listPorts) {
    return dependencies.listPorts();
  }

  return resolveSerialPortConstructor(dependencies).list();
}
