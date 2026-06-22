# @maxxuxx/node-printer

[English](README.md)

통합 ESC/POS 영수증 프린터 API입니다

이 패키지는 serial, network, CUPS, Windows Spooler 프린터를 하나의 진입점으로 제공합니다



## 사용 스택


| 영역             | 스택                                     |
| -------------- | -------------------------------------- |
| Runtime        | Node.js 20+                            |
| Language       | TypeScript                             |
| Module output  | ESM, CommonJS                          |
| Receipt output | ESC/POS bytes                          |
| Transports     | Network, Serial, CUPS, Windows Spooler |
| Native loading | Lazy import, bundled prebuild          |




## 설치

```bash
npm install @maxxuxx/node-printer
```



## 가능 여부


| 기능                         | 상태    | 설명                               |
| -------------------------- | ----- | -------------------------------- |
| Network TCP 9100           | ✅ 가능  | Windows, macOS, Linux에서 사용 가능    |
| Serial COM 또는 tty          | ✅ 가능  | OS COM 또는 tty 장치 사용          |
| CUPS 출력                    | ✅ 가능  | macOS, Linux에서 사용 가능             |
| Windows Spooler RAW        | ✅ 가능  | Windows에서 bundled prebuild로 동작   |
| macOS 또는 Linux Winspool    | ❌ 불가능 | `ERR_UNSUPPORTED_PLATFORM` throw |
| npm install 중 source build | ❌ 미제공 | 배포 패키지는 bundled prebuild를 기대     |




## 빠른 시작

```ts
import { createPrinter, createReceipt } from "@maxxuxx/node-printer";

const receipt = createReceipt({ encoding: "cp949" })
  .initialize()
  .text("테스트 출력")
  .divider()
  .text("NETWORK OK")
  .feed(3)
  .cut()
  .encode();

const printer = createPrinter({
  type: "network",
  host: "192.168.0.50",
  port: 9100
});

await printer.print(receipt);
await printer.close?.();
```

## 프린터 선택

### Serial

```ts
const printer = createPrinter({
  type: "serial",
  path: "COM3",
  baudRate: 9600
});
```

### Network

```ts
const printer = createPrinter({
  type: "network",
  host: "192.168.0.50",
  port: 9100,
  timeoutMs: 5000,
  retry: {
    retries: 2,
    minDelayMs: 100,
    maxDelayMs: 1000,
    factor: 2
  }
});
```

### CUPS

```ts
const printer = createPrinter({
  type: "cups",
  printerName: "Receipt",
  documentName: "Receipt"
});
```

### Windows Spooler

```ts
const printer = createPrinter({
  type: "winspool",
  printerName: "Receipt",
  documentName: "Receipt"
});
```

Winspool은 Windows에서만 사용할 수 있습니다



## 영수증 Builder

```ts
const receipt = createReceipt({ width: 48, encoding: "cp949" })
  .initialize()
  .align("center")
  .bold()
  .text("STORE NAME")
  .bold(false)
  .divider()
  .row([
    { text: "Americano", width: 32 },
    { text: "4,500", width: 16, align: "right" }
  ])
  .qr("https://github.com/maxxuxx/node-printer")
  .feed(3)
  .cut()
  .encode();
```

지원하는 builder command는 text, row, align, bold, underline, size, feed, cut, QR, barcode, image, raw bytes입니다



## 플랫폼 지원


| 플랫폼     | Network | Serial | CUPS  | Winspool |
| ------- | ------- | ------ | ----- | -------- |
| Windows | ✅ 지원    | ✅ 지원   | ❌ 미지원 | ✅ 지원     |
| macOS   | ✅ 지원    | ✅ 지원   | ✅ 지원  | ❌ 미지원    |
| Linux   | ✅ 지원    | ✅ 지원   | ✅ 지원  | ❌ 미지원    |


Windows가 아닌 플랫폼에서 winspool target을 호출하면 `ERR_UNSUPPORTED_PLATFORM`이 throw됩니다



## Prebuild

Windows에서 일반 설치는 bundled winspool prebuild를 사용합니다

관리자와 contributor가 prebuild artifact를 검증하거나 갱신해야 할 때는 저장소에서 native addon을 직접 빌드할 수 있습니다


| 방식                         | 상태    | 사용 시점                     |
| -------------------------- | ----- | ------------------------- |
| bundled winspool prebuild  | ✅ 권장  | 앱 설치와 일반 패키지 사용           |
| repository 직접 빌드           | ✅ 가능  | native 검증과 prebuild 갱신    |
| npm install 중 source build | ❌ 미제공 | OS별 설치 예측 가능성을 위해 제공하지 않음 |




## 오류

패키지 수준 오류는 모두 `PrinterError`를 사용합니다

```ts
import { PrinterError, isPrinterError } from "@maxxuxx/node-printer";

try {
  await printer.print(receipt);
} catch (error) {
  if (isPrinterError(error)) {
    console.error(error.code, error.retryable);
  }
}
```

대표 오류 코드는 `ERR_INVALID_TARGET`, `ERR_UNSUPPORTED_PLATFORM`, `ERR_CONNECTION_TIMEOUT`, `ERR_WRITE_TIMEOUT`, `ERR_NATIVE_MODULE_UNAVAILABLE`와 transport-specific failure code입니다



## 내부 모듈

npm에는 `@maxxuxx/node-printer`만 배포합니다

- `@node-printer/core`
- `@node-printer/network`
- `@node-printer/serial`
- `@node-printer/cups`
- `@node-printer/winspool`



## Contributors 환영

버그 수정, 문서 개선, 플랫폼 검증, 프린터 테스트 기록 기여를 환영합니다



## Repository

[https://github.com/maxxuxx/node-printer](https://github.com/maxxuxx/node-printer)



## License

MIT
