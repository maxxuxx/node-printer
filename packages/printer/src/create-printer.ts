import {
  PrinterError,
  type CupsPrinterTarget,
  type NetworkPrinterTarget,
  type Printer,
  type PrinterTarget,
  type PrintResult,
  type SerialPrinterTarget,
  type WinspoolPrinterTarget
} from "@node-printer/printer-core";
import type { CupsPrinterDependencies } from "@node-printer/printer-cups";
import type { NetworkPrinterDependencies } from "@node-printer/printer-network";
import type { SerialPrinterDependencies } from "@node-printer/printer-serial";
import type { WinspoolBinding } from "@node-printer/printer-winspool";

// 생성 옵션
export interface CreatePrinterOptions {
  cups    ?: CupsPrinterDependencies;
  network ?: NetworkPrinterDependencies;
  serial  ?: SerialPrinterDependencies;
  winspool?: WinspoolBinding;
}

// 첫 print 호출 시점에 transport 구현 모듈을 동적 로드함
// 비-Windows에서 winspool native가, 비-Linux/macOS에서 serial/cups native가 미리 로드되지 않도록 격리함
class LazyPrinter implements Printer {
  readonly target: PrinterTarget;

  private innerPromise?: Promise<Printer>;

  constructor(target: PrinterTarget, private readonly factory: () => Promise<Printer>) {
    this.target = target;
  }

  async print(data: Uint8Array): Promise<PrintResult> {
    const inner = await this.resolveInner();

    return inner.print(data);
  }

  async close(): Promise<void> {
    // 한 번도 print하지 않은 transport는 닫을 inner가 없으므로 무시함
    if (!this.innerPromise) {
      return;
    }

    const inner = await this.innerPromise;

    await inner.close?.();
  }

  // 동일 인스턴스에서 print를 여러 번 호출해도 한 번만 import하도록 캐싱함
  private resolveInner(): Promise<Printer> {
    if (!this.innerPromise) {
      this.innerPromise = this.factory();
    }

    return this.innerPromise;
  }
}

// 프린터 팩토리
// 대상 type에 맞는 transport만 동적으로 로드해 import 단계에서 native 모듈을 끌어오지 않게 합니다
export function createPrinter(
  target: PrinterTarget,
  options: CreatePrinterOptions = {}
): Printer {
  const targetType = target?.type;

  switch (targetType) {
    case "serial":
      return new LazyPrinter(target, async () => {
        const { createSerialPrinter } = await import("@node-printer/printer-serial");

        return createSerialPrinter(target as SerialPrinterTarget, options.serial);
      });

    case "network":
      return new LazyPrinter(target, async () => {
        const { createNetworkPrinter } = await import("@node-printer/printer-network");

        return createNetworkPrinter(target as NetworkPrinterTarget, options.network);
      });

    case "cups":
      return new LazyPrinter(target, async () => {
        const { createCupsPrinter } = await import("@node-printer/printer-cups");

        return createCupsPrinter(target as CupsPrinterTarget, options.cups);
      });

    case "winspool":
      // 비-Windows 환경은 동기적으로 거부해 호출자가 print 전에 platform 오류를 인지하게 함
      if (process.platform !== "win32") {
        throw new PrinterError({
          code   : "ERR_UNSUPPORTED_PLATFORM",
          message: "Winspool printing is only supported on Windows"
        });
      }

      return new LazyPrinter(target, async () => {
        const { createWinspoolPrinter } = await import("@node-printer/printer-winspool");

        return createWinspoolPrinter(target as WinspoolPrinterTarget, options.winspool);
      });

    default:
      // 알 수 없는 target은 공통 오류 코드로 빠르게 거부합니다
      throw new PrinterError({
        code   : "ERR_INVALID_TARGET",
        message: "Printer target type is invalid"
      });
  }
}
