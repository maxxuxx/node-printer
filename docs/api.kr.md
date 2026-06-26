# API 사용 문서

이 문서는 `@maxxuxx/node-printer` 루트 export로 사용할 수 있는 공개 API와 사용 예제를 정리합니다

내부 source alias인 `#serial`, `#network`, `#cups`, `#winspool`의 개별 transport 생성 함수는 npm 패키지의 public import 경로가 아니므로 직접 import 예제로 다루지 않습니다

## 공개 API 요약

| API                                | 용도                                                                  |
| ---------------------------------- | --------------------------------------------------------------------- |
| `createReceipt(options?)`          | ESC/POS 영수증 바이트를 체인 방식으로 생성                            |
| `print(target, data, options?)`    | `Uint8Array` 데이터를 serial, network, CUPS, Winspool target으로 출력 |
| `listPrinters(type, options?)`     | serial, usb, network 프린터 목록 조회                                 |
| `getStatus(target, options?)`      | 프린터 상태 조회 (online, 용지 없음, 커버 열림, 오류 등)              |
| `getPaperInfo(target, options?)`   | 용지 너비와 그에 맞는 영수증 `columns` 계산                          |
| `resolveColumns(target, options?)` | 계산된 `columns` 값만 반환                                            |
| `configurePrinterSettings(config)` | 저장 프린터 JSON 파일 경로 설정                                       |
| `savePrinter(input)`               | 프린터 target과 영수증 profile 저장                                   |
| `listSavedPrinters()`              | 저장된 프린터 전체 조회                                               |
| `getSavedPrinter(id)`              | 저장된 프린터 단건 조회                                               |
| `removeSavedPrinter(id)`           | 저장된 프린터 삭제                                                    |
| `clearSavedPrinters()`             | 저장된 프린터 전체 삭제                                               |
| `isPrinterError(error)`            | 오류가 `PrinterError`인지 확인                                        |
| `PrinterError`                     | 패키지 공통 오류 클래스                                               |
| `PRINTER_ERROR_CODES`              | 패키지가 사용하는 오류 코드 목록                                      |

## 기본 출력 흐름

`createReceipt`로 영수증 데이터를 만들고 `print`에 printer target과 함께 넘깁니다

```ts
import { createReceipt, print } from "@maxxuxx/node-printer";

const receipt = createReceipt({ columns: 42, encoding: "cp949" })
  .initialize()
  .align("center")
  .bold()
  .text("매장명")
  .bold(false)
  .divider()
  .leftRight("아메리카노", "4,500")
  .feed(3)
  .cut()
  .encode();

const result = await print(
  {
    type: "network",
    host: "192.168.0.50",
    port: 9100
  },
  receipt
);

console.log(result.ok, result.bytesWritten, result.durationMs);
```

`print`는 성공하면 `PrintResult`를 반환합니다

```ts
interface PrintResult {
  ok: true;
  target: PrinterTarget;
  jobId?: string | number;
  bytesWritten?: number;
  durationMs: number;
}
```

## Printer target

`print`의 첫 번째 인자는 transport별 target 객체입니다

### Network

TCP 9100 계열 네트워크 프린터에 RAW 데이터를 전송합니다

```ts
await print(
  {
    type: "network",
    host: "192.168.0.50",
    port: 9100,
    timeoutMs: 5000,
    chunkSize: 16 * 1024,
    retry: {
      retries: 2,
      minDelayMs: 100,
      maxDelayMs: 1000,
      factor: 2
    }
  },
  receipt
);
```

기본값은 `port: 9100`, `timeoutMs: 5000`, `chunkSize: 16384`, `retry.retries: 0`입니다

### Serial

COM port나 tty serial 프린터에 출력합니다

```ts
await print(
  {
    type: "serial",
    path: "COM3",
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: false,
    timeoutMs: 5000
  },
  receipt
);
```

기본값은 `baudRate: 9600`, `dataBits: 8`, `stopBits: 1`, `parity: "none"`, `flowControl: false`, `timeoutMs: 5000`입니다

`flowControl`은 `true`, `"rtscts"`, `"xon"`, `"xoff"`, `false`를 사용할 수 있습니다

### CUPS

macOS와 Linux의 CUPS 프린터에 `lp` 또는 `lpr` 기반 RAW 출력을 보냅니다

```ts
await print(
  {
    type: "cups",
    printerName: "Receipt",
    documentName: "Receipt",
    timeoutMs: 5000
  },
  receipt
);
```

기본값은 `timeoutMs: 5000`입니다

### Winspool

Windows Spooler RAW 출력 경로를 사용합니다

```ts
await print(
  {
    type: "winspool",
    printerName: "Receipt",
    documentName: "Receipt"
  },
  receipt
);
```

`winspool` target은 Windows에서만 사용할 수 있습니다

## listPrinters

`listPrinters(type, options?)`는 프린터 검색 결과 배열을 반환합니다

```ts
import { listPrinters } from "@maxxuxx/node-printer";

const serialPorts = await listPrinters("serial");
const usbPrinters = await listPrinters("usb");
const networkPrinters = await listPrinters("network");
```

| type         | 결과                                             | 동작                                          |
| ------------ | ------------------------------------------------ | --------------------------------------------- |
| `"serial"`   | `SerialPortInfo[]`                               | serialport 목록 조회                          |
| `"usb"`      | `CupsPrinterInfo[]` 또는 `WinspoolPrinterInfo[]` | Windows는 Winspool, macOS와 Linux는 CUPS 사용 |
| `"network"`  | `NetworkPrinterInfo[]`                           | 로컬 IPv4 대역에서 열린 9100 포트 검색        |
| `"cups"`     | `CupsPrinterInfo[]`                              | CUPS 목록 직접 조회                           |
| `"winspool"` | `WinspoolPrinterInfo[]`                          | Windows Spooler 목록 직접 조회                |

`"usb"`는 OS별 프린터 목록을 하나의 이름으로 쓰기 위한 권장 값입니다

`"cups"`와 `"winspool"`은 OS 경로를 직접 지정해야 할 때만 사용합니다

네트워크 검색 범위는 `PrinterMethodOptions.network`로 좁힐 수 있습니다

```ts
const printers = await listPrinters("network", {
  network: {
    discoveryHosts: ["192.168.0.50", "192.168.0.51"],
    discoveryPort: 9100,
    discoveryTimeoutMs: 250,
    discoveryConcurrency: 8
  }
});
```

## getStatus

`getStatus(target, options?)`는 `PrinterStatus`를 반환합니다

조회 출처는 target에 따라 다릅니다. serial과 network는 ESC/POS 실시간 상태 명령(`DLE EOT`)을 사용하고, winspool과 cups는 ESC/POS 없이 OS 스풀러 상태를 읽습니다

```ts
import { getStatus } from "@maxxuxx/node-printer";

const status = await getStatus({ type: "winspool", printerName: "Receipt" });

console.log(status.online, status.paperOut, status.coverOpen);
```

```ts
interface PrinterStatus {
  target: PrinterTarget;
  source: "escpos" | "winspool" | "cups";
  online?: boolean;
  paperOut?: boolean;
  paperNearEnd?: boolean;
  coverOpen?: boolean;
  paperJam?: boolean;
  drawerOpen?: boolean;
  error?: boolean;
  paused?: boolean;
  busy?: boolean;
  raw?: Record<string, number | string | boolean>;
}
```

각 boolean 값은 해당 출처가 보고하지 못하면 `undefined`로 남아, `undefined`(알 수 없음)와 `false`(정상)를 구분합니다

| target              | source       | 동작                                                          |
| ------------------- | ------------ | ------------------------------------------------------------- |
| `serial`/`network`  | `"escpos"`   | `DLE EOT 1~4`를 보내고 응답 바이트를 디코딩                    |
| `winspool`          | `"winspool"` | Windows Spooler `PRINTER_STATUS` 비트 플래그 디코딩           |
| `cups`              | `"cups"`     | `lpstat -l -p` 상태 문구와 `printer-state-reasons` 파싱       |

serial과 network 상태 조회는 ESC/POS 실시간 상태를 지원하는 프린터가 필요하며, 응답이 없으면 timeout 오류를 던집니다

## getPaperInfo

`getPaperInfo(target, options?)`는 인쇄 가능한 용지 너비와 사용할 영수증 `columns`를 계산합니다

```ts
import { getPaperInfo, createReceipt } from "@maxxuxx/node-printer";

const info = await getPaperInfo({ type: "winspool", printerName: "Receipt" });

const receipt = createReceipt({ columns: info.columns, encoding: "cp949" })
  .text("너비 기반 출력")
  .cut()
  .encode();
```

```ts
interface PaperInfo {
  target: PrinterTarget;
  source: "system" | "manual" | "default";
  font: "a" | "b";
  columns: number;
  widthMm?: number;
  printableWidthDots?: number;
  dpi?: number;
}
```

`columns`는 다음 우선순위로 결정됩니다

1. 명시한 `options.columns` (source `"manual"`)
2. `useSystemWidth`가 켜져 있을 때 시스템 드라이버 너비, `winspool`과 `cups`만 해당 (source `"system"`)
3. 수동 `options.paper` 프리셋 또는 측정값 (source `"manual"`)
4. 기본값 `42` (source `"default"`)

| option           | 기본값  | 의미                                                             |
| ---------------- | ------- | ---------------------------------------------------------------- |
| `useSystemWidth` | `true`  | `winspool`과 `cups`에서 OS 드라이버 너비를 조회                  |
| `font`           | `"a"`   | 도트 → columns 계산에 사용할 폰트 폭 기준                        |
| `paper`          | -       | 수동 `"58mm"`/`"80mm"` 프리셋 또는 `{ widthMm, printableWidthDots, dpi }` |
| `columns`        | -       | `columns`를 강제하고 모든 자동 감지를 건너뜀                     |

serial과 network 직접 연결은 시스템 너비를 읽을 수 없으므로 `paper` 또는 기본값으로 폴백합니다

`resolveColumns(target, options?)`는 `columns`만 반환하는 편의 함수입니다

```ts
import { resolveColumns, createReceipt } from "@maxxuxx/node-printer";

const columns = await resolveColumns(
  { type: "winspool", printerName: "Receipt" },
  { font: "a" }
);

const receipt = createReceipt({ columns }).text("Sized").cut().encode();
```

## createReceipt

`createReceipt(options?)`는 `ReceiptBuilder`를 반환합니다

```ts
const receipt = createReceipt({
  columns: 42,
  encoding: "cp949"
});
```

| option     | 기본값   | 의미                                                            |
| ---------- | -------- | --------------------------------------------------------------- |
| `columns`  | `42`     | 한 줄 문자 폭                                                   |
| `encoding` | `"utf8"` | 문자열을 ESC/POS 바이트로 바꿀 때 사용할 인코딩                 |
| `paper`    | -        | `columns`를 생략했을 때 `columns`를 계산하는 `"58mm"`/`"80mm"` 프리셋 |
| `font`     | `"a"`    | `paper`로 `columns`를 계산할 때 쓰는 폰트 폭 기준               |

시스템 너비를 읽을 수 없는 serial이나 IP 직접 연결은 `paper`로 너비를 수동 선언합니다

```ts
const receipt = createReceipt({ paper: "80mm", encoding: "cp949" }); // columns가 48로 계산됨
```

winspool이나 cups 시스템 프린터는 `getPaperInfo`로 드라이버에서 `columns`를 구해 넘깁니다

지원 인코딩, 주 사용 국가, ESC/POS code page 참고는 [인코딩 문서](encoding.kr.md)를 확인합니다

`encoding(value)`는 이후 문자열을 어떤 문자셋으로 바이트 변환할지 정합니다

`codePage(page)`는 일반 출력에 필수가 아니며, 프린터의 ESC/POS code page를 직접 바꿔야 할 때만 사용합니다

code page 변경이 필요한 프린터에서는 `initialize()`, `codePage(page)`, `encoding(value)` 순서로 호출합니다

```ts
const receipt = createReceipt({ columns: 42 })
  .initialize()
  .codePage(21)
  .encoding("cp949")
  .text("매장")
  .encode();
```

### 텍스트와 줄 구성

| 메서드                             | 용도                               |
| ---------------------------------- | ---------------------------------- |
| `initialize()`                     | 프린터 초기화 명령 추가            |
| `text(value, options?)`            | 텍스트 출력, 기본으로 줄바꿈 포함  |
| `line(value, options?)`            | 줄바꿈이 포함된 텍스트 출력        |
| `row(columns)`                     | 고정 폭 column 배열을 한 줄로 출력 |
| `divider(options?)`                | 구분선 출력                        |
| `blank(lines?)`                    | 빈 줄 추가                         |
| `wrap(value, options?)`            | 지정 폭에 맞춰 줄바꿈              |
| `truncate(value, options?)`        | 지정 폭을 넘는 텍스트 자르기       |
| `leftRight(left, right, options?)` | 좌측과 우측 텍스트를 한 줄에 배치  |
| `keyValue(label, value, options?)` | label과 value를 좌우로 배치        |
| `columns(columns, options?)`       | 여러 column 출력, `wrap` 옵션 지원 |
| `table(options)`                   | header와 row 기반 표 출력          |

```ts
const receipt = createReceipt({ columns: 42, encoding: "cp949" })
  .title("STORE")
  .divider()
  .leftRight("Subtotal", "12,000")
  .keyValue("Order", "A12")
  .columns([
    { text: "Americano", width: 30 },
    { text: "4,500", width: 12, align: "right" }
  ])
  .wrap("긴 설명은 설정한 폭에 맞춰 여러 줄로 나뉩니다", {
    width: 42,
    indent: 2
  })
  .encode();
```

### 금액과 주문 행

| 메서드                    | 용도                                           |
| ------------------------- | ---------------------------------------------- |
| `amount(value, options?)` | 숫자를 locale, currency, unit 옵션에 맞춰 출력 |
| `items(items, options?)`  | 상품명, 수량, 금액 행 여러 개 출력             |
| `totals(rows, options?)`  | 합계 행 여러 개 출력                           |

```ts
const receipt = createReceipt({ columns: 42, encoding: "cp949" })
  .items(
    [
      { name: "Americano", quantity: 2, amount: 9000 },
      { name: "Latte", quantity: 1, amount: 5000 }
    ],
    {
      locale: "ko-KR",
      currency: "KRW"
    }
  )
  .divider()
  .totals([{ label: "Total", amount: 14000, bold: true }], {
    locale: "ko-KR",
    currency: "KRW"
  })
  .encode();
```

### 스타일

| 메서드                     | 용도                                 |
| -------------------------- | ------------------------------------ |
| `title(value, options?)`   | 가운데 정렬 중심의 제목 출력         |
| `section(value, options?)` | section 제목 또는 divider 출력       |
| `style(options, build)`    | 임시 스타일 적용 후 이전 스타일 복원 |
| `align(value)`             | `left`, `center`, `right` 정렬 설정  |
| `bold(enabled?)`           | 굵게 설정                            |
| `underline(enabled?)`      | 밑줄 설정                            |
| `font(value)`              | `a` 또는 `b` font 선택               |
| `invert(enabled?)`         | 흑백 반전 설정                       |
| `size(width, height)`      | 문자 확대 설정                       |

```ts
const receipt = createReceipt()
  .style({ align: "center", bold: true }, (styled) => {
    styled.text("STORE");
  })
  .text("Normal text")
  .encode();
```

`style`은 callback 안에서만 스타일을 바꾸고 callback 이후에는 이전 스타일로 되돌립니다

### 프린터 제어와 raw 데이터

| 메서드                      | 용도                                 |
| --------------------------- | ------------------------------------ |
| `codePage(page, encoding?)` | ESC/POS code page 명령 추가          |
| `encoding(value)`           | 이후 텍스트 인코딩 변경              |
| `cashDrawer(options?)`      | 금전함 kick 명령 추가                |
| `beep(count?, duration?)`   | buzzer 명령 추가                     |
| `feed(lines?)`              | 용지 feed 명령 추가                  |
| `cut(mode?)`                | `full` 또는 `partial` 커팅 명령 추가 |
| `qr(value, options?)`       | QR code 명령 추가                    |
| `barcode(value, options?)`  | barcode 명령 추가                    |
| `image(input, options?)`    | raster image 명령 추가               |
| `raw(bytes)`                | 직접 만든 ESC/POS byte 추가          |

```ts
const receipt = createReceipt({ encoding: "cp949" })
  .qr("https://example.com", {
    size: 6,
    errorCorrection: "q"
  })
  .barcode("8801234567890", {
    type: "ean13",
    width: 3,
    height: 80,
    hri: "below"
  })
  .feed(3)
  .cut("full")
  .encode();
```

`qr`, `barcode`, `image`는 명령 생성에 실패하면 기본 fallback 문구를 출력합니다

오류를 그대로 던지고 싶으면 `fallbackText: false`를 넘깁니다

```ts
createReceipt().qr("", { fallbackText: false }).encode();
```

### 결과 변환

| 메서드      | 반환                                   |
| ----------- | -------------------------------------- |
| `preview()` | 영수증 builder에 누적된 텍스트 preview |
| `toHex()`   | 최종 바이트를 hex 문자열로 변환        |
| `encode()`  | 출력 가능한 `Uint8Array` 반환          |

`preview`는 텍스트 확인용이며 실제 ESC/POS 명령 전체를 표현하지는 않습니다

## 저장 프린터 설정 API

저장 프린터 API를 쓰려면 먼저 `configurePrinterSettings`로 JSON 파일 경로를 지정해야 합니다

```ts
import {
  configurePrinterSettings,
  savePrinter,
  listSavedPrinters,
  getSavedPrinter,
  print,
  createReceipt
} from "@maxxuxx/node-printer";

configurePrinterSettings({
  filePath: "C:/Users/me/AppData/Roaming/my-app/printers.json"
});

const saved = await savePrinter({
  name: "Counter",
  type: "serial",
  path: "COM3",
  baudRate: 9600,
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});

const receipt = createReceipt(saved.receipt)
  .initialize()
  .text("Saved printer print")
  .cut()
  .encode();

await print(saved.target, receipt);

const printers = await listSavedPrinters();
const first = await getSavedPrinter(saved.id);
```

저장 파일이 없으면 빈 목록으로 시작하고, 저장할 때 필요한 디렉터리를 자동 생성합니다

### savePrinter 입력

USB 저장은 현재 OS에 따라 실제 target이 달라집니다

Windows에서는 `winspool`, macOS와 Linux에서는 `cups` target으로 저장됩니다

```ts
await savePrinter({
  name: "Counter",
  type: "usb",
  printerName: "Receipt",
  documentName: "Receipt",
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});
```

Serial 저장은 `SerialPrinterTarget`에서 `type`을 제외한 값을 받습니다

```ts
await savePrinter({
  name: "Counter serial",
  type: "serial",
  path: "COM3",
  baudRate: 9600,
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});
```

Network 저장은 `NetworkPrinterTarget`에서 `type`을 제외한 값을 받습니다

```ts
await savePrinter({
  name: "Kitchen",
  type: "network",
  host: "192.168.0.50",
  port: 9100,
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});
```

### 저장 API 메서드

| 메서드                                   | 반환                                 | 동작                         |
| ---------------------------------------- | ------------------------------------ | ---------------------------- |
| `configurePrinterSettings({ filePath })` | `void`                               | 저장 JSON 파일 경로 설정     |
| `savePrinter(input)`                     | `Promise<SavedPrinter>`              | 프린터와 영수증 profile 저장 |
| `listSavedPrinters()`                    | `Promise<SavedPrinter[]>`            | 저장 목록 조회               |
| `getSavedPrinter(id)`                    | `Promise<SavedPrinter \| undefined>` | id로 단건 조회               |
| `removeSavedPrinter(id)`                 | `Promise<void>`                      | id로 삭제                    |
| `clearSavedPrinters()`                   | `Promise<void>`                      | 전체 삭제                    |

## PrinterMethodOptions

대부분의 앱 코드는 `options`를 넘기지 않아도 됩니다

테스트나 Electron 환경 제어가 필요할 때 transport dependency를 주입할 수 있습니다

```ts
await listPrinters("serial", {
  serial: {
    SerialPort: FakeSerialPort
  }
});

await print(
  {
    type: "network",
    host: "192.168.0.50"
  },
  receipt,
  {
    network: {
      createConnection: createFakeConnection
    }
  }
);
```

| option     | 용도                                                        |
| ---------- | ----------------------------------------------------------- |
| `serial`   | serialport 생성자와 port 목록 조회 함수 주입                |
| `network`  | TCP connection, host discovery, port probe, sleep 함수 주입 |
| `cups`     | CUPS command runner, platform, print command, timeout 주입  |
| `winspool` | Winspool native binding 구현 주입                           |

## 오류 처리

패키지가 직접 던지는 오류는 `PrinterError`이며 `isPrinterError`로 구분할 수 있습니다

```ts
import { isPrinterError, print } from "@maxxuxx/node-printer";

try {
  await print(
    {
      type: "network",
      host: "192.168.0.50"
    },
    receipt
  );
} catch (error) {
  if (isPrinterError(error)) {
    console.error(error.code, error.retryable, error.message);
  } else {
    throw error;
  }
}
```

주요 오류 코드는 다음과 같습니다

| code                                  | 의미                                     |
| ------------------------------------- | ---------------------------------------- |
| `ERR_INVALID_TARGET`                  | target 값이 부족하거나 잘못됨            |
| `ERR_UNSUPPORTED_PLATFORM`            | 현재 OS에서 지원하지 않는 transport 사용 |
| `ERR_PRINTER_NOT_FOUND`               | 저장된 프린터 id를 찾지 못함             |
| `ERR_CONNECTION_TIMEOUT`              | 네트워크 연결 시간 초과                  |
| `ERR_WRITE_TIMEOUT`                   | 네트워크 쓰기 시간 초과                  |
| `ERR_CONNECTION_REFUSED`              | 네트워크 연결 거부                       |
| `ERR_HOST_NOT_FOUND`                  | host 조회 실패                           |
| `ERR_NETWORK_UNREACHABLE`             | 네트워크 접근 불가                       |
| `ERR_SERIAL_TIMEOUT`                  | serial 작업 시간 초과                    |
| `ERR_SERIAL_OPEN_FAILED`              | serial port 열기 실패                    |
| `ERR_SERIAL_WRITE_FAILED`             | serial 쓰기 또는 drain 실패              |
| `ERR_SERIAL_CLOSE_FAILED`             | serial port 닫기 실패                    |
| `ERR_WINSPOOL_FAILED`                 | Winspool 작업 실패                       |
| `ERR_CUPS_COMMAND_FAILED`             | CUPS command 실패                        |
| `ERR_ENCODING_FAILED`                 | 영수증 인코딩 또는 byte range 검증 실패  |
| `ERR_NATIVE_MODULE_UNAVAILABLE`       | native prebuild를 불러올 수 없음         |
| `ERR_PRINTER_SETTINGS_NOT_CONFIGURED` | 저장 설정 파일 경로가 설정되지 않음      |
| `ERR_INVALID_PRINTER_SETTINGS`        | 저장 프린터 입력값이 잘못됨              |

## 타입 import 예시

앱에서 target과 결과 타입을 명시하고 싶으면 루트 패키지에서 type import를 함께 사용합니다

```ts
import {
  createReceipt,
  print,
  type NetworkPrinterTarget,
  type PrintResult,
  type ReceiptEncoding
} from "@maxxuxx/node-printer";

const encoding: ReceiptEncoding = "cp949";

const target: NetworkPrinterTarget = {
  type: "network",
  host: "192.168.0.50"
};

const receipt = createReceipt({ encoding }).text("Typed print").cut().encode();

const result: PrintResult = await print(target, receipt);
```
