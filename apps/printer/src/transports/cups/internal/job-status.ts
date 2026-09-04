import { PrinterError, type CupsPrinterTarget } from "#core";

import type {
  CupsJobMonitorOptions,
  CupsJobStatus,
  CupsPrinterDependencies
} from "../types.js";
import { resolveCupsDependencies } from "./dependencies.js";
import { assertSupportedPlatform } from "./platform.js";
import { runCupsCommand } from "./runner.js";

const DEFAULT_MONITOR_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_MS = 250;

export async function getCupsJobStatus(
  target: CupsPrinterTarget,
  jobId: string | number,
  dependencies: CupsPrinterDependencies = {}
): Promise<CupsJobStatus> {
  const normalizedJobId = String(jobId).trim();

  if (!normalizedJobId) {
    throw new PrinterError({
      code   : "ERR_INVALID_TARGET",
      message: "CUPS jobId is required"
    });
  }

  const resolved = resolveCupsDependencies(dependencies);
  assertSupportedPlatform(resolved.platform);

  const pending = await listJobs(target, "not-completed", resolved, normalizedJobId);
  const pendingLine = findJobLine(pending, normalizedJobId);

  if (pendingLine) {
    return { jobId: normalizedJobId, state: "queued", raw: pendingLine };
  }

  const completed = await listJobs(target, "completed", resolved, normalizedJobId);
  const completedLine = findJobLine(completed, normalizedJobId);

  return completedLine
    ? { jobId: normalizedJobId, state: "completed", raw: completedLine }
    : { jobId: normalizedJobId, state: "unknown" };
}

export async function monitorCupsJob(
  target: CupsPrinterTarget,
  jobId: string | number,
  options: CupsJobMonitorOptions = {},
  dependencies: CupsPrinterDependencies = {}
): Promise<CupsJobStatus> {
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_MONITOR_TIMEOUT_MS);
  const pollMs   = options.pollMs ?? DEFAULT_POLL_MS;
  let status     = await getCupsJobStatus(target, jobId, dependencies);

  while (status.state === "queued" && Date.now() < deadline) {
    await sleep(pollMs);
    status = await getCupsJobStatus(target, jobId, dependencies);
  }

  return status;
}

type ResolvedCupsDependencies = ReturnType<typeof resolveCupsDependencies>;

async function listJobs(
  target: CupsPrinterTarget,
  which: "completed" | "not-completed",
  resolved: ResolvedCupsDependencies,
  label: string
): Promise<string> {
  const result = await runCupsCommand(
    resolved.runner,
    {
      command  : "lpstat",
      args     : ["-W", which, "-o", target.printerName],
      timeoutMs: target.timeoutMs ?? resolved.defaultTimeoutMs
    },
    `lpstat job ${label}`
  );

  return result.stdout;
}

function findJobLine(output: string, jobId: string): string | undefined {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line === jobId || line.startsWith(`${jobId} `));
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
