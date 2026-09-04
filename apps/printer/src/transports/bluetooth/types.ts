import type {
  BluetoothBlePrinterTarget,
  BluetoothPrinterTarget,
  PrinterStatus
} from "#core";
import type { SerialPrinterDependencies } from "#serial";
import type { SystemPrinterDependencies } from "#system";

export type BluetoothPrinterInfo =
  | {
      name        : string;
      mode        : "spp";
      path        : string;
      manufacturer?: string;
    }
  | {
      name       : string;
      mode       : "system";
      printerName: string;
    }
  | {
      name      : string;
      mode      : "ble";
      deviceId  : string;
      profileId?: string;
    };

export interface BluetoothPrinterDependencies {
  serial?: SerialPrinterDependencies;
  system?: SystemPrinterDependencies;
  ble   ?: BluetoothBleAdapter;
}

export interface BluetoothBleAdapter {
  list?(): Promise<BluetoothPrinterInfo[]>;
  connect(target: BluetoothBlePrinterTarget): Promise<BluetoothBleConnection>;
  getStatus?(target: BluetoothBlePrinterTarget): Promise<PrinterStatus>;
}

export interface BluetoothBleConnection {
  maxWriteSize?: number;
  write(data: Uint8Array): Promise<void>;
  drain?(): Promise<void>;
  close(): Promise<void>;
}

export type NormalizedBluetoothPrinterTarget = BluetoothPrinterTarget;
