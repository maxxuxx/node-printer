import { type PrintResult, type WinspoolPrinterTarget } from "#core";

import type { WinspoolBinding, WinspoolPrinter } from "../types.js";
import { DEFAULT_DOCUMENT_NAME } from "./defaults.js";
import { printRaw } from "./print-raw.js";

// Transport

export class WinspoolPrinterTransport implements WinspoolPrinter {
  readonly target: WinspoolPrinterTarget;

  constructor(target: WinspoolPrinterTarget, private readonly binding: WinspoolBinding) {
    this.target = {
      ...target,
      documentName: target.documentName ?? DEFAULT_DOCUMENT_NAME
    };
  }

  async print(data: Uint8Array): Promise<PrintResult> {
    const startedAt = Date.now();
    const result    = await printRaw(
      {
        printerName : this.target.printerName,
        data,
        documentName: this.target.documentName
      },
      this.binding
    );

    return {
      ok          : true,
      target      : this.target,
      jobId       : result.jobId,
      bytesWritten: result.bytesWritten,
      durationMs  : Date.now() - startedAt
    };
  }
}
