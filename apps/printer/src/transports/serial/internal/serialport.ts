import { SerialPort as NodeSerialPort } from "serialport";

import type { SerialPortConstructor, SerialPortInfo, SerialPrinterDependencies } from "../types.js";

const DEFAULT_SERIAL_PORT = NodeSerialPort as unknown as SerialPortConstructor;

// Serialport binding resolution

export function resolveSerialPortConstructor(
  dependencies: SerialPrinterDependencies = {}
): SerialPortConstructor {
  return dependencies.SerialPort ?? DEFAULT_SERIAL_PORT;
}

export async function listSerialPorts(
  dependencies: SerialPrinterDependencies = {}
): Promise<SerialPortInfo[]> {
  if (dependencies.listPorts) {
    return dependencies.listPorts();
  }

  return resolveSerialPortConstructor(dependencies).list();
}
