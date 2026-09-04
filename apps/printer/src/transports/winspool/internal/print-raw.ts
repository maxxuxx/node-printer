import { resolveWinspoolBinding } from "../binding.js";
import type { WinspoolBinding, WinspoolPrintRawOptions } from "../types.js";
import { DEFAULT_DOCUMENT_NAME } from "./defaults.js";
import { validatePrintRawOptions } from "./validation.js";

// Raw printing

export async function printRaw(
  options: WinspoolPrintRawOptions,
  binding?: WinspoolBinding
): Promise<{
  ok          : true;
  printerName : string;
  jobId      ?: number;
  bytesWritten: number;
}> {
  validatePrintRawOptions(options);
  const resolvedBinding = resolveWinspoolBinding(binding);

  const result = await resolvedBinding.printRaw({
    ...options,
    documentName: options.documentName ?? DEFAULT_DOCUMENT_NAME
  });

  return {
    ok          : true,
    printerName : options.printerName,
    jobId       : result.jobId,
    bytesWritten: result.bytesWritten
  };
}
