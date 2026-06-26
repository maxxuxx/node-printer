import {
  ESC_POS_STATUS_QUERY,
  ESC_POS_STATUS_RESPONSE_BYTES,
  decodeEscPosStatus,
  PrinterError,
  type PrinterStatus,
  type PrintResult,
  type SerialPrinterTarget
} from "#core";

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

// ESC/POS 실시간 상태 명령으로 serial 프린터 상태를 조회합니다
export async function getSerialStatus(
  target: SerialPrinterTarget,
  dependencies: SerialPrinterDependencies = {}
): Promise<PrinterStatus> {
  const transport = createSerialPrinter(target, dependencies);
  const response  = await transport.queryStatus(ESC_POS_STATUS_QUERY, ESC_POS_STATUS_RESPONSE_BYTES);

  // 응답이 전혀 없으면 해당 프린터가 실시간 상태를 지원하지 않는 것으로 봅니다
  if (response.byteLength === 0) {
    throw new PrinterError({
      code   : "ERR_SERIAL_TIMEOUT",
      message: "Serial printer did not respond to ESC/POS status query"
    });
  }

  return {
    target,
    source: "escpos",
    ...decodeEscPosStatus(response)
  };
}
