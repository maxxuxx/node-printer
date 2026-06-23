import type { CupsPrinterDependencies, CupsPrinterInfo } from "#cups";
import type { NetworkPrinterDependencies, NetworkPrinterInfo } from "#network";
import type { SerialPortInfo, SerialPrinterDependencies } from "#serial";
import type { WinspoolBinding, WinspoolPrinterInfo } from "#winspool";

// Method API options

export interface PrinterMethodOptions {
  cups    ?: CupsPrinterDependencies;
  network ?: NetworkPrinterDependencies;
  serial  ?: SerialPrinterDependencies;
  winspool?: WinspoolBinding;
}

export type ListPrinterType = "serial" | "usb" | "network";
export type LegacyListPrinterType = "cups" | "winspool";
export type AnyListPrinterType = ListPrinterType | LegacyListPrinterType;
export type UsbPrinterInfo = CupsPrinterInfo | WinspoolPrinterInfo;

export type PrinterListResult<TType extends AnyListPrinterType = ListPrinterType> =
  TType extends "serial" ? SerialPortInfo[] :
  TType extends "usb" ? UsbPrinterInfo[] :
  TType extends "network" ? NetworkPrinterInfo[] :
  TType extends "cups" ? CupsPrinterInfo[] :
  TType extends "winspool" ? WinspoolPrinterInfo[] :
  never;
