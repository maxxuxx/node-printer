import { PrinterError, type NetworkPrinterTarget } from "#core";

import type { NormalizedNetworkPrinterTarget } from "../types.js";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_DELIVERY_MODE,
  DEFAULT_PORT,
  DEFAULT_SETTLE_MS,
  DEFAULT_TIMEOUT_MS
} from "./defaults.js";
import { normalizeRetry } from "./retry.js";

// Target normalization

export function normalizeNetworkTarget(
  target: NetworkPrinterTarget
): NormalizedNetworkPrinterTarget {
  if (!target.host) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer host is required"
    });
  }

  const port      = target.port ?? DEFAULT_PORT;
  const timeoutMs = target.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chunkSize = target.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const settleMs = target.settleMs ?? DEFAULT_SETTLE_MS;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer port must be between 1 and 65535"
    });
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer timeoutMs must be greater than 0"
    });
  }

  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer chunkSize must be greater than 0"
    });
  }

  if (!Number.isInteger(settleMs) || settleMs < 0) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Network printer settleMs cannot be negative"
    });
  }

  return {
    type     : "network",
    host     : target.host,
    port,
    timeoutMs,
    retry    : normalizeRetry(target.retry),
    chunkSize,
    deliveryMode: target.deliveryMode ?? DEFAULT_DELIVERY_MODE,
    settleMs
  };
}
