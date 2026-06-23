import type { NetworkPrinterTarget } from "#core";

import { listNetworkPrinters } from "./internal/list-printers.js";
import { NetworkPrinterTransport } from "./internal/transport.js";
import type { NetworkPrinterDependencies } from "./types.js";

// Public API

export { listNetworkPrinters, NetworkPrinterTransport };

export function createNetworkPrinter(
  target: NetworkPrinterTarget,
  dependencies: NetworkPrinterDependencies = {}
): NetworkPrinterTransport {
  return new NetworkPrinterTransport(target, dependencies);
}
