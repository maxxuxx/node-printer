import { PrinterError } from "./errors.js";
import type { PrinterTarget } from "./types.js";

export function getPrinterEndpointKey(target: PrinterTarget): string {
  switch (target.type) {
    case "network":
      return `network:${target.host.toLowerCase()}:${target.port ?? 9100}`;
    case "serial":
      return `serial:${normalizeSerialPath(target.path)}`;
    case "winspool":
      return `winspool:${target.printerName.toLowerCase()}`;
    case "cups":
      return `cups:${target.printerName.toLowerCase()}`;
    case "system":
      return `system:${target.printerName.toLowerCase()}`;
    case "bluetooth":
      if (target.mode === "spp") {
        return `bluetooth:spp:${normalizeSerialPath(target.path)}`;
      }

      if (target.mode === "system") {
        return `bluetooth:system:${target.printerName.toLowerCase()}`;
      }

      if (target.mode === "ble" && target.deviceId && target.profileId) {
        return `bluetooth:ble:${target.deviceId.toLowerCase()}:${target.profileId}`;
      }

      throw invalidTarget();
    default:
      throw invalidTarget();
  }
}

function invalidTarget(): PrinterError {
  return new PrinterError({
    code   : "ERR_INVALID_TARGET",
    message: "Printer target type or connection details are invalid"
  });
}

function normalizeSerialPath(path: string): string {
  const normalized = path.trim();

  if (process.platform !== "win32") {
    return normalized;
  }

  return normalized
    .replace(/^\\\\\.\\/u, "")
    .replace(/:$/u, "")
    .toUpperCase();
}
