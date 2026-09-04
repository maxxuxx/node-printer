import { PrinterError, type WinspoolPrinterTarget } from "#core";

import { assertWindows, loadWinspoolBinding } from "../binding.js";
import type {
  WinspoolBinding,
  WinspoolJobInfo,
  WinspoolJobMonitorOptions,
  WinspoolJobState,
  WinspoolJobStatus
} from "../types.js";

const JOB_STATUS_PAUSED            = 0x0001;
const JOB_STATUS_ERROR             = 0x0002;
const JOB_STATUS_DELETING          = 0x0004;
const JOB_STATUS_SPOOLING          = 0x0008;
const JOB_STATUS_PRINTING          = 0x0010;
const JOB_STATUS_OFFLINE           = 0x0020;
const JOB_STATUS_PAPEROUT          = 0x0040;
const JOB_STATUS_PRINTED           = 0x0080;
const JOB_STATUS_DELETED           = 0x0100;
const JOB_STATUS_BLOCKED_DEVQ      = 0x0200;
const JOB_STATUS_USER_INTERVENTION = 0x0400;
const JOB_STATUS_COMPLETE          = 0x1000;

const DEFAULT_MONITOR_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_MS = 250;

export async function getWinspoolJobStatus(
  target: WinspoolPrinterTarget,
  jobId: number,
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<WinspoolJobStatus> {
  assertWindows();

  if (!Number.isInteger(jobId) || jobId <= 0) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "Winspool jobId must be a positive integer"
    });
  }

  if (!binding.getJobInfo) {
    throw new PrinterError({
      code   : "ERR_NATIVE_MODULE_UNAVAILABLE",
      message: "Winspool prebuild does not support getJobInfo. Rebuild the native prebuild."
    });
  }

  const info = await binding.getJobInfo(target.printerName, jobId);

  return info
    ? { jobId, state: decodeWinspoolJobState(info), raw: info }
    : { jobId, state: "completed" };
}

export async function monitorWinspoolJob(
  target: WinspoolPrinterTarget,
  jobId: number,
  options: WinspoolJobMonitorOptions = {},
  binding: WinspoolBinding = loadWinspoolBinding()
): Promise<WinspoolJobStatus> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_MONITOR_TIMEOUT_MS;
  const pollMs    = options.pollMs ?? DEFAULT_POLL_MS;
  const deadline  = Date.now() + timeoutMs;

  while (true) {
    const status = await getWinspoolJobStatus(target, jobId, binding);

    if (status.state === "completed" || status.state === "error" || status.state === "paused") {
      return status;
    }

    if (Date.now() >= deadline) {
      return status;
    }

    await sleep(pollMs);
  }
}

export function decodeWinspoolJobState(info: WinspoolJobInfo): WinspoolJobState {
  const status = info.status;

  if ((status & (JOB_STATUS_ERROR
    | JOB_STATUS_DELETING
    | JOB_STATUS_OFFLINE
    | JOB_STATUS_PAPEROUT
    | JOB_STATUS_DELETED
    | JOB_STATUS_BLOCKED_DEVQ
    | JOB_STATUS_USER_INTERVENTION)) !== 0) {
    return "error";
  }

  if ((status & JOB_STATUS_PAUSED) !== 0) {
    return "paused";
  }

  if ((status & (JOB_STATUS_PRINTED | JOB_STATUS_COMPLETE)) !== 0) {
    return "completed";
  }

  if ((status & JOB_STATUS_PRINTING) !== 0) {
    return "printing";
  }

  if ((status & JOB_STATUS_SPOOLING) !== 0) {
    return "spooling";
  }

  return status === 0 ? "queued" : "unknown";
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
