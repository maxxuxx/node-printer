import { PrinterError, type SystemPrinterTarget } from "#core";

import type { SystemPrinterBackend } from "../types.js";

export function resolveSystemBackend(
  target: SystemPrinterTarget,
  platform: NodeJS.Platform = process.platform
): SystemPrinterBackend {
  if (target.backend && target.backend !== "auto") {
    assertBackendPlatform(target.backend, platform);
    return target.backend;
  }

  if (platform === "win32") {
    return "winspool";
  }

  if (platform === "darwin" || platform === "linux") {
    return "cups";
  }

  throw new PrinterError({
    code   : "ERR_UNSUPPORTED_PLATFORM",
    message: `System printer queues are not supported on ${platform}`
  });
}

function assertBackendPlatform(backend: SystemPrinterBackend, platform: NodeJS.Platform): void {
  const supported = backend === "winspool"
    ? platform === "win32"
    : platform === "darwin" || platform === "linux";

  if (!supported) {
    throw new PrinterError({
      code   : "ERR_UNSUPPORTED_PLATFORM",
      message: `${backend} printer queues are not supported on ${platform}`
    });
  }
}
