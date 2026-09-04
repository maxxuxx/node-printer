import type { BluetoothPrinterInfo, BluetoothPrinterDependencies } from "../types.js";

const BLUETOOTH_PATTERN = /(?:bluetooth|\bbth\b|rfcomm)/iu;

export async function listBluetoothPrinters(
  dependencies: BluetoothPrinterDependencies = {}
): Promise<BluetoothPrinterInfo[]> {
  const [{ listSerialPorts }, { listSystemPrinters }] = await Promise.all([
    import("#serial"),
    import("#system")
  ]);
  const [serialPorts, systemPrinters, blePrinters] = await Promise.all([
    listSerialPorts(dependencies.serial),
    listSystemPrinters(dependencies.system),
    dependencies.ble?.list?.() ?? Promise.resolve([])
  ]);

  const spp: BluetoothPrinterInfo[] = serialPorts
    .filter((port) => BLUETOOTH_PATTERN.test([
      port.path,
      port.manufacturer,
      port.pnpId,
      port.locationId
    ].filter(Boolean).join(" ")))
    .map((port) => ({
      name        : port.path,
      mode        : "spp" as const,
      path        : port.path,
      manufacturer: port.manufacturer
    }));
  const system: BluetoothPrinterInfo[] = systemPrinters
    .filter((printer) => BLUETOOTH_PATTERN.test(JSON.stringify(printer)))
    .map((printer) => ({
      name       : printer.name,
      mode       : "system" as const,
      printerName: printer.name
    }));

  return [...spp, ...system, ...blePrinters];
}
