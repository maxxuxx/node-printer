import { PrinterError, type SerialPrinterTarget } from "#core";

import type { SerialOpenOptions } from "../types.js";
import {
  DEFAULT_BAUD_RATE,
  DEFAULT_DATA_BITS,
  DEFAULT_PARITY,
  DEFAULT_STOP_BITS,
  DEFAULT_TIMEOUT_MS
} from "./defaults.js";

export type NormalizedSerialPrinterTarget = Required<SerialPrinterTarget>;

// Target normalization

export function normalizeSerialTarget(
  target: SerialPrinterTarget
): NormalizedSerialPrinterTarget {
  if (!target.path) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Serial printer path is required"
    });
  }

  return {
    type       : "serial",
    path       : target.path,
    baudRate   : target.baudRate ?? DEFAULT_BAUD_RATE,
    dataBits   : target.dataBits ?? DEFAULT_DATA_BITS,
    stopBits   : target.stopBits ?? DEFAULT_STOP_BITS,
    parity     : target.parity ?? DEFAULT_PARITY,
    flowControl: target.flowControl ?? false,
    timeoutMs  : target.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };
}

export function toSerialOpenOptions(
  target: NormalizedSerialPrinterTarget
): SerialOpenOptions {
  return {
    path    : target.path,
    baudRate: target.baudRate,
    autoOpen: false,
    dataBits: target.dataBits,
    stopBits: target.stopBits,
    parity  : target.parity,
    ...flowControlOptions(target.flowControl)
  };
}

function flowControlOptions(flowControl: NormalizedSerialPrinterTarget["flowControl"]): {
  rtscts?: boolean;
  xon   ?: boolean;
  xoff  ?: boolean;
} {
  if (flowControl === true || flowControl === "rtscts") {
    return { rtscts: true };
  }

  if (flowControl === "xon") {
    return { xon: true };
  }

  if (flowControl === "xoff") {
    return { xoff: true };
  }

  return {};
}
