import net from "node:net";
import { networkInterfaces } from "node:os";

import type { NetworkPrinterDependencies, NetworkPrinterInfo } from "../types.js";
import { DEFAULT_PORT } from "./defaults.js";

const DEFAULT_DISCOVERY_CONCURRENCY = 64;
const DEFAULT_DISCOVERY_TIMEOUT_MS   = 250;

// Printer discovery

export async function listNetworkPrinters(
  dependencies: NetworkPrinterDependencies = {}
): Promise<NetworkPrinterInfo[]> {
  const hosts       = getDiscoveryHosts(dependencies);
  const port        = dependencies.discoveryPort ?? DEFAULT_PORT;
  const timeoutMs   = dependencies.discoveryTimeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
  const concurrency = normalizeConcurrency(dependencies.discoveryConcurrency);
  const isPortOpen  = dependencies.isPortOpen ?? isNetworkPortOpen;

  return scanHosts(hosts, port, timeoutMs, concurrency, isPortOpen);
}

// Host scanning

async function scanHosts(
  hosts: string[],
  port: number,
  timeoutMs: number,
  concurrency: number,
  isPortOpen: Required<NetworkPrinterDependencies>["isPortOpen"]
): Promise<NetworkPrinterInfo[]> {
  const found: Array<{ index: number; printer: NetworkPrinterInfo }> = [];
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, hosts.length) },
    async () => {
      while (nextIndex < hosts.length) {
        const index = nextIndex;
        const host  = hosts[nextIndex];

        nextIndex += 1;

        if (!host) {
          continue;
        }

        if (await isPortOpen(host, port, timeoutMs)) {
          found.push({
            index,
            printer: { host, port }
          });
        }
      }
    }
  );

  await Promise.all(workers);

  return found
    .sort((left, right) => left.index - right.index)
    .map((item) => item.printer);
}

function isNetworkPortOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const finish = (open: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

// Local subnet hosts

function getDiscoveryHosts(dependencies: NetworkPrinterDependencies): string[] {
  const hosts = dependencies.discoveryHosts ?? getLocalSubnetHosts(dependencies);

  return [...new Set(hosts.filter(Boolean))];
}

function getLocalSubnetHosts(dependencies: NetworkPrinterDependencies): string[] {
  const interfaces = dependencies.getNetworkInterfaces?.() ?? networkInterfaces();
  const hosts      : string[] = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        hosts.push(...getIpv4ClassCHosts(entry.address));
      }
    }
  }

  return hosts;
}

function getIpv4ClassCHosts(address: string): string[] {
  const parts = address.split(".");

  if (parts.length !== 4) {
    return [];
  }

  const prefix = parts.slice(0, 3).join(".");

  return Array.from({ length: 254 }, (_item, index) => `${prefix}.${index + 1}`);
}

function normalizeConcurrency(value?: number): number {
  if (!value || value < 1) {
    return DEFAULT_DISCOVERY_CONCURRENCY;
  }

  return Math.floor(value);
}
