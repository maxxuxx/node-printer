import type { NetworkPrinterTarget } from "#core";

import type { NormalizedNetworkPrinterTarget, NormalizedRetryOptions } from "../types.js";
import {
  DEFAULT_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_RETRY_FACTOR,
  DEFAULT_RETRY_MAX_MS
} from "./defaults.js";
import type { PrinterError } from "#core";

// Retry options

export function normalizeRetry(
  retry: NetworkPrinterTarget["retry"]
): NormalizedRetryOptions {
  const retries    = retry?.retries ?? DEFAULT_RETRIES;
  const minDelayMs = retry?.minDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxDelayMs = retry?.maxDelayMs ?? DEFAULT_RETRY_MAX_MS;
  const factor     = retry?.factor ?? DEFAULT_RETRY_FACTOR;

  return {
    retries   : Math.max(0, retries),
    minDelayMs: Math.max(0, minDelayMs),
    maxDelayMs: Math.max(0, maxDelayMs),
    factor    : Math.max(1, factor)
  };
}

export function shouldRetry(
  error: PrinterError,
  attempt: number,
  retry: NormalizedRetryOptions
): boolean {
  return error.retryable && attempt < retry.retries;
}

export function getRetryDelayMs(
  retry: NormalizedRetryOptions,
  attempt: number
): number {
  const delayMs = retry.minDelayMs * retry.factor ** attempt;

  return Math.min(delayMs, retry.maxDelayMs);
}

export function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export type NetworkSleep = (delayMs: number) => Promise<void>;
export type NetworkRetryTarget = NormalizedNetworkPrinterTarget;
