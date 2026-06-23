import type { CupsPrintCommand } from "../types.js";

export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_PRINT_COMMAND: CupsPrintCommand = "lp";
export const STDIN_CHUNK_SIZE = 64 * 1024;
