import type { CupsPrinterDependencies, CupsPrinterInfo } from "#cups";
import type { BluetoothPrinterDependencies, BluetoothPrinterInfo } from "#bluetooth";
import type { NetworkPrinterDependencies, NetworkPrinterInfo } from "#network";
import type { SerialPortInfo, SerialPrinterDependencies } from "#serial";
import type { WinspoolBinding, WinspoolPrinterInfo } from "#winspool";
import type { SystemPrinterDependencies, SystemPrinterInfo } from "#system";

// Method API options

export interface PrinterMethodOptions {
  bluetooth?: BluetoothPrinterDependencies;
  cups    ?: CupsPrinterDependencies;
  network ?: NetworkPrinterDependencies;
  serial  ?: SerialPrinterDependencies;
  system  ?: SystemPrinterDependencies;
  winspool?: WinspoolBinding;
}

export type ListPrinterType = "serial" | "usb" | "system" | "network" | "bluetooth";
export type LegacyListPrinterType = "cups" | "winspool";
export type AnyListPrinterType = ListPrinterType | LegacyListPrinterType;
export type UsbPrinterInfo = CupsPrinterInfo | WinspoolPrinterInfo;

export type PrinterListResult<TType extends AnyListPrinterType = ListPrinterType> =
  TType extends "serial" ? SerialPortInfo[] :
  TType extends "usb" ? UsbPrinterInfo[] :
  TType extends "network" ? NetworkPrinterInfo[] :
  TType extends "system" ? SystemPrinterInfo[] :
  TType extends "bluetooth" ? BluetoothPrinterInfo[] :
  TType extends "cups" ? CupsPrinterInfo[] :
  TType extends "winspool" ? WinspoolPrinterInfo[] :
  never;
