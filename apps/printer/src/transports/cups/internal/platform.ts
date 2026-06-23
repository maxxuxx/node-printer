import { PrinterError } from "#core";

// Platform guard

export function assertSupportedPlatform(platform: NodeJS.Platform): void {
  if (platform === "darwin" || platform === "linux") {
    return;
  }

  throw new PrinterError({
    code   : "ERR_UNSUPPORTED_PLATFORM",
    message: `CUPS printers are supported only on macOS and Linux, current platform is ${platform}`
  });
}
