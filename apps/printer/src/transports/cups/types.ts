export interface CupsPrinterInfo {
  name     : string;
  isDefault: boolean;
  state    : CupsPrinterState;
  raw      : string;
}

export type CupsPrinterState = "idle" | "printing" | "disabled" | "unknown";

export interface CupsPrinterDependencies {
  runner          ?: CupsCommandRunner;
  platform        ?: NodeJS.Platform;
  printCommand    ?: CupsPrintCommand;
  defaultTimeoutMs?: number;
}

export type CupsPrintCommand = "lp" | "lpr";

export interface CupsCommandRunner {
  run(request: CupsCommandRequest): Promise<CupsCommandResult>;
}

export interface CupsCommandRequest {
  command  : string;
  args     : string[];
  input   ?: Uint8Array;
  timeoutMs: number;
}

export interface CupsCommandResult {
  stdout  : string;
  stderr  : string;
  exitCode: number | null;
  signal  : NodeJS.Signals | null;
  timedOut?: boolean;
}
