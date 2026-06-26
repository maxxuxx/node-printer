import {
  ESC_POS_STATUS_QUERY,
  ESC_POS_STATUS_RESPONSE_BYTES,
  decodeEscPosStatus,
  PrinterError,
  type NetworkPrinterTarget,
  type PrinterStatus
} from "#core";

import { listNetworkPrinters } from "./internal/list-printers.js";
import { NetworkPrinterTransport } from "./internal/transport.js";
import type { NetworkPrinterDependencies } from "./types.js";

// Public API

export { listNetworkPrinters, NetworkPrinterTransport };

export function createNetworkPrinter(
  target: NetworkPrinterTarget,
  dependencies: NetworkPrinterDependencies = {}
): NetworkPrinterTransport {
  return new NetworkPrinterTransport(target, dependencies);
}

// ESC/POS 실시간 상태 명령으로 network 프린터 상태를 조회합니다
export async function getNetworkStatus(
  target: NetworkPrinterTarget,
  dependencies: NetworkPrinterDependencies = {}
): Promise<PrinterStatus> {
  const transport = createNetworkPrinter(target, dependencies);

  try {
    const response = await transport.queryStatus(ESC_POS_STATUS_QUERY, ESC_POS_STATUS_RESPONSE_BYTES);

    // 응답이 전혀 없으면 해당 프린터가 실시간 상태를 지원하지 않는 것으로 봅니다
    if (response.byteLength === 0) {
      throw new PrinterError({
        code   : "ERR_CONNECTION_TIMEOUT",
        message: "Network printer did not respond to ESC/POS status query"
      });
    }

    return {
      target,
      source: "escpos",
      ...decodeEscPosStatus(response)
    };
  } finally {
    await transport.close();
  }
}
