# Receipt Printer Library Design

## 1. Goal

Windows와 macOS에서 POS 영수증 프린터를 안정적으로 지원하는 TypeScript 기반 Node.js/Electron 프린터 라이브러리를 만든다.

이 프로젝트의 핵심 목표는 다음과 같다.

- Network, Serial, Windows Spooler, macOS CUPS 프린터를 하나의 일관된 API로 다룬다.
- ESC/POS 영수증 데이터를 TypeScript에서 안전하고 예측 가능하게 생성한다.
- native build가 필요한 영역을 최대한 격리해서 설치 실패와 Electron ABI 문제를 줄인다.
- Electron 앱에서는 main process 중심의 안전한 프린팅 구조를 제공한다.
- 초기 버전은 실용적인 출력 경로를 먼저 안정화하고, 이후 discovery, advanced encoding, native binding을 확장한다.

## 2. Supported Printer Targets

지원 대상은 다음 네 종류로 구분한다.

| Target                     | Package                          | Runtime               | Install-time native build |
| -------------------------- | -------------------------------- | --------------------- | ------------------------- |
| Network printer            | `@maxxuxx/node-printer-network`  | `node:net`            | 없음                      |
| Serial printer             | `@maxxuxx/node-printer-serial`   | `serialport`          | 일반적으로 없음           |
| Windows system printer     | `@maxxuxx/node-printer-winspool` | Windows Spooler API   | 있음                      |
| macOS/Linux system printer | `@maxxuxx/node-printer-cups`     | `lpstat`, `lp`, `lpr` | 초기 버전 없음            |

## 2.1 Platform and Architecture Targets

초기 배포 목표는 다음 조합을 기준으로 둔다

| Platform | Arch      | Scope                           |
| -------- | --------- | ------------------------------- |
| Windows  | ia32      | core, serial, network, winspool |
| Windows  | x64       | core, serial, network, winspool |
| Windows  | arm64     | core, serial, network, winspool |
| macOS    | x64       | core, serial, network, cups     |
| macOS    | arm64     | core, serial, network, cups     |
| Linux    | x64/arm64 | core, serial, network, cups     |

`core`, `network`, `cups`는 custom native addon 없이 구현한다. `serial`은 `serialport` prebuild를 lazy load한다. `winspool`은 Windows 전용 N-API addon으로 두고 npm 배포본에서는 prebuild만 로드한다

## 3. Package Structure

권장 패키지 구조는 monorepo 기반이다.

```text
packages/
  printer/
  printer-core/
  printer-network/
  printer-serial/
  printer-winspool/
  printer-cups/
  printer-electron/
```

최종 사용자는 대부분 `@maxxuxx/node-printer`만 설치해서 사용할 수 있어야 한다. 다만 native dependency를 피하고 싶은 사용자를 위해 개별 transport package도 독립적으로 사용할 수 있게 한다.

## 4. Dependency Direction

패키지 의존성은 한 방향으로만 흐르게 한다.

```text
@maxxuxx/node-printer-core
  ↑
  ├─ @maxxuxx/node-printer-network
  ├─ @maxxuxx/node-printer-serial
  ├─ @maxxuxx/node-printer-winspool
  ├─ @maxxuxx/node-printer-cups
  └─ @maxxuxx/node-printer-electron

@maxxuxx/node-printer
  ├─ core
  ├─ network
  ├─ serial
  ├─ cups
  └─ optional winspool
```

`core`는 어떤 runtime transport에도 의존하지 않는다. Transport package는 `core`의 type, error, receipt encoding 계약만 사용한다.

## 5. Package Responsibilities

### 5.1 `@maxxuxx/node-printer-core`

순수 TypeScript 패키지다.

역할:

- 공통 타입 정의
- ESC/POS command 생성
- receipt builder 제공
- transport interface 정의
- 에러 타입 정의
- printer capability 타입 정의
- text encoding, image, barcode, QR code command를 위한 추상화 제공

포함하지 않는 것:

- MSBuild
- `node-gyp`
- native dependency
- `node:net`, `child_process`, `serialport` 같은 transport runtime dependency

### 5.2 `@maxxuxx/node-printer-network`

순수 TypeScript 패키지다.

역할:

- `node:net` 기반 TCP 출력
- 기본 포트 `9100`
- connect timeout, write timeout 지원
- retry 정책 지원
- chunk write 지원
- half-open socket, ECONNRESET, ETIMEDOUT 등 네트워크 오류를 `core` error로 정규화

초기 구현 우선순위:

- `NetworkPrinterTransport`
- `print(data: Uint8Array): Promise<PrintResult>`
- timeout과 retry
- chunk size 옵션

### 5.3 `@maxxuxx/node-printer-serial`

`serialport` 기반 패키지다.

역할:

- Windows COM 포트 출력
- macOS `tty`, `usbserial`, `usbmodem` 출력
- `baudRate`, `dataBits`, `stopBits`, `parity`, `flowControl` 설정 지원
- serial port list 조회
- open, write, drain, close lifecycle 관리

주의사항:

- `@maxxuxx/node-printer-serial` 자체에는 custom native build를 두지 않는다.
- `serialport`는 내부적으로 native binding을 사용하지만, 지원되는 Node.js/Electron/platform 조합에서는 prebuilt binary를 사용하므로 일반적으로 MSBuild가 필요 없다.
- 지원되지 않는 runtime, architecture, libc 조합이거나 prebuilt binary resolution에 실패하면 `node-gyp` fallback build가 발생할 수 있다.
- Electron 환경에서는 `serialport` v10+의 N-API 기반 prebuild를 전제로 하되, packaging 시 native binary 포함 여부와 fallback rebuild 정책을 문서화해야 한다.

### 5.4 `@maxxuxx/node-printer-winspool`

Windows 전용 optional native 패키지다.

상세 설계는 [Winspool N-API Design](./winspool-napi-design.md)을 따른다

역할:

- Windows Spooler printer list 조회
- default printer 조회
- RAW print 출력
- `OpenPrinter`, `StartDocPrinter`, `WritePrinter`, `EndDocPrinter`, `ClosePrinter` 래핑
- printer status와 job id 반환

구현 전략:

- N-API 기반 addon으로 구현해서 Node/Electron ABI 부담을 줄인다.
- `@maxxuxx/node-printer`에서는 optional dependency로 둔다.
- Windows가 아닌 플랫폼에서 import 실패가 전체 설치 실패로 이어지지 않게 한다.
- npm 배포본은 prebuild artifact만 포함하고, 직접 빌드는 저장소에서 prebuild를 만들 때만 사용한다.

초기 native surface:

```ts
export interface WinspoolBinding {
  listPrinters(): Promise<SystemPrinterInfo[]>;
  getDefaultPrinter(): Promise<SystemPrinterInfo | null>;
  printRaw(options: WinspoolPrintOptions): Promise<SystemPrintResult>;
}
```

### 5.5 `@maxxuxx/node-printer-cups`

macOS/Linux system printer 패키지다.

역할:

- `lpstat` 기반 printer list 조회
- `lp` 또는 `lpr` 기반 RAW 출력
- CUPS destination 지원
- command timeout과 stderr parsing
- child process 오류를 `core` error로 정규화

초기 구현 전략:

- native CUPS binding 없이 child process 기반으로 시작한다.
- `lp -d <printer> -o raw` 또는 플랫폼에 맞는 raw option을 우선 사용한다.
- CUPS native binding은 printer status, advanced options, performance 이슈가 명확해진 뒤 검토한다.

### 5.6 `@maxxuxx/node-printer-electron`

Electron 앱에서 쓰기 쉬운 wrapper 패키지다.

역할:

- main process 전용 API 제공
- preload/IPC 샘플 제공
- renderer에 Node API를 직접 노출하지 않는 구조 안내
- native module `asarUnpack` 가이드 제공
- Electron rebuild, packaging, code signing 주의사항 문서화

제공할 샘플:

- `main.ts`에서 printer service 생성
- `preload.ts`에서 제한된 IPC API 노출
- renderer에서 `window.printer.printReceipt(...)` 호출
- printer list 조회와 target 저장 예시

## 6. Public API Draft

최상위 패키지의 기본 사용 예시는 다음과 같다.

```ts
import { createPrinter, createReceipt } from "@maxxuxx/node-printer";

const receipt = createReceipt().text("매장명").divider().text("아메리카노 4,000").cut().encode();

const printer = createPrinter({
  type: "network",
  host: "192.168.0.50",
  port: 9100
});

await printer.print(receipt);
```

## 7. Core Types

```ts
export type PrinterTarget =
  | NetworkPrinterTarget
  | SerialPrinterTarget
  | WinspoolPrinterTarget
  | CupsPrinterTarget;

export interface NetworkPrinterTarget {
  type: "network";
  host: string;
  port?: number;
  timeoutMs?: number;
  retry?: RetryOptions;
  chunkSize?: number;
}

export interface SerialPrinterTarget {
  type: "serial";
  path: string;
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 1.5 | 2;
  parity?: "none" | "even" | "odd" | "mark" | "space";
  flowControl?: boolean | "xon" | "xoff" | "rtscts";
  timeoutMs?: number;
}

export interface WinspoolPrinterTarget {
  type: "winspool";
  printerName: string;
  documentName?: string;
  timeoutMs?: number;
}

export interface CupsPrinterTarget {
  type: "cups";
  printerName: string;
  documentName?: string;
  timeoutMs?: number;
}

export interface RetryOptions {
  retries: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
}

export interface Printer {
  readonly target: PrinterTarget;
  print(data: Uint8Array | Buffer): Promise<PrintResult>;
}

export interface PrintResult {
  ok: true;
  target: PrinterTarget;
  jobId?: string | number;
  bytesWritten?: number;
  durationMs: number;
}
```

## 8. Receipt Builder Design

`core`의 receipt builder는 fluent API를 제공하되, 내부적으로는 command AST 또는 command list를 유지한다.

```ts
const receipt = createReceipt({
  encoding: "cp949",
  width: 48
})
  .initialize()
  .align("center")
  .bold(true)
  .text("매장명")
  .bold(false)
  .divider()
  .align("left")
  .row([
    { text: "아메리카노", width: 32 },
    { text: "4,000", width: 16, align: "right" }
  ])
  .feed(3)
  .cut()
  .encode();
```

초기 builder 기능:

- `initialize()`
- `text(value, options?)`
- `line(value, options?)`
- `row(columns)`
- `divider(char?)`
- `align('left' | 'center' | 'right')`
- `bold(enabled?)`
- `underline(enabled?)`
- `size(width, height)`
- `feed(lines)`
- `cut(mode?)`
- `raw(bytes)`
- `encode()`

확장 기능:

- QR code
- barcode
- raster image
- code page switching
- table layout
- currency formatting hook
- printer profile별 width/capability preset

## 9. ESC/POS Encoding Strategy

초기 구현은 검증된 encoder를 활용하는 방향을 우선한다.

후보:

- `@point-of-sale/receipt-printer-encoder`
- `escpos-buffer`

선택 기준:

- TypeScript 친화성
- code page 지원 범위
- Korean text encoding 지원 가능성
- image, barcode, QR command 지원
- 유지보수 상태
- browser/Electron main process 사용 가능성

라이브러리 내부에서는 외부 encoder에 직접 종속된 API를 노출하지 않는다. `core`의 `ReceiptBuilder`와 `EscPosEncoder` interface 뒤에 감싸서 나중에 encoder 교체가 가능하게 한다.

## 10. Error Model

모든 패키지는 공통 error base class를 사용한다.

```ts
export class PrinterError extends Error {
  readonly code: PrinterErrorCode;
  readonly cause?: unknown;
  readonly retryable: boolean;
}

export type PrinterErrorCode =
  | "ERR_INVALID_TARGET"
  | "ERR_UNSUPPORTED_PLATFORM"
  | "ERR_PRINTER_NOT_FOUND"
  | "ERR_CONNECTION_TIMEOUT"
  | "ERR_WRITE_TIMEOUT"
  | "ERR_CONNECTION_REFUSED"
  | "ERR_SERIAL_OPEN_FAILED"
  | "ERR_SERIAL_WRITE_FAILED"
  | "ERR_WINSPOOL_FAILED"
  | "ERR_CUPS_COMMAND_FAILED"
  | "ERR_ENCODING_FAILED"
  | "ERR_NATIVE_MODULE_UNAVAILABLE";
```

오류 설계 원칙:

- 사용자가 복구할 수 있는 오류와 개발자가 수정해야 하는 오류를 구분한다.
- transport별 low-level error를 그대로 던지지 않는다.
- `cause`에는 원본 오류를 유지한다.
- retry 가능한 오류에는 `retryable: true`를 표시한다.

## 11. Create Printer Factory

`@maxxuxx/node-printer`는 target type에 따라 적절한 transport를 lazy-load한다.

```ts
export async function createPrinter(target: PrinterTarget): Promise<Printer> {
  switch (target.type) {
    case "network":
      return createNetworkPrinter(target);
    case "serial":
      return createSerialPrinter(target);
    case "winspool":
      return createWinspoolPrinter(target);
    case "cups":
      return createCupsPrinter(target);
  }
}
```

동기 factory가 필요하면 top-level package에서 dependency 로딩 정책을 분명히 해야 한다. native optional dependency가 있는 구조에서는 async lazy-load가 더 안전하다.

권장 API:

```ts
const printer = await createPrinter(target);
await printer.print(data);
```

## 12. Printer Discovery API

초기 discovery API는 transport별로 제공하고, top-level package에서 통합한다.

```ts
export async function listPrinters(options?: ListPrintersOptions): Promise<PrinterInfo[]>;
export async function getDefaultPrinter(): Promise<PrinterInfo | null>;
export async function listSerialPorts(): Promise<SerialPortInfo[]>;
```

통합 printer info:

```ts
export interface PrinterInfo {
  id: string;
  name: string;
  type: "serial" | "winspool" | "cups";
  displayName?: string;
  isDefault?: boolean;
  status?: PrinterStatus;
  metadata?: Record<string, unknown>;
}
```

Network printer는 일반적으로 자동 discovery가 환경마다 다르므로 초기 버전에서는 직접 host 입력을 기본으로 한다. 추후 mDNS, SNMP, vendor-specific discovery를 별도 기능으로 검토한다.

## 13. Build Strategy

프로젝트가 직접 소유하는 native build 대상은 `winspool` 패키지로 격리한다.

| Package    | Project-owned native build | Strategy                                                          |
| ---------- | -------------------------- | ----------------------------------------------------------------- |
| `core`     | 없음                       | pure TypeScript                                                   |
| `network`  | 없음                       | `node:net`                                                        |
| `serial`   | 없음                       | `serialport` prebuild 사용, fallback source build 가능성만 문서화 |
| `winspool` | 있음                       | N-API addon + prebuild only                                       |
| `cups`     | 없음                       | child process 기반                                                |
| `electron` | 없음                       | wrapper only                                                      |

권장 도구:

- TypeScript project references
- `tsup` 또는 `unbuild` 기반 ESM/CJS dual package build
- `prebuildify`
- GitHub Actions release artifacts
- npm optional dependencies

## 14. Electron Strategy

Electron 지원 원칙:

- 프린터 접근은 main process에서만 수행한다.
- renderer에는 제한된 IPC API만 노출한다.
- receipt data 생성은 renderer와 main 중 어느 쪽에서도 가능하지만, 실제 출력은 main에서 수행한다.
- native module은 `asarUnpack` 대상에 포함한다.
- Electron major version별 native rebuild 부담을 줄이기 위해 winspool은 N-API를 사용한다.

권장 IPC shape:

```ts
// preload.ts
contextBridge.exposeInMainWorld("printer", {
  listPrinters: () => ipcRenderer.invoke("printer:list"),
  print: (request: PrintRequest) => ipcRenderer.invoke("printer:print", request)
});
```

renderer에 노출할 request는 serial path, printer name, host 같은 필요한 정보만 포함하고 Node API나 raw module object는 노출하지 않는다.

## 15. Security Considerations

- renderer에서 임의 command 실행이 불가능해야 한다.
- CUPS package는 printer name과 document name을 child process argument로 안전하게 전달한다.
- shell interpolation을 사용하지 않는다.
- IPC payload는 schema validation을 거친다.
- network printer host와 port는 앱 정책에 따라 allowlist를 둘 수 있게 한다.
- receipt raw bytes 입력은 신뢰 경계를 명확히 문서화한다.

## 16. Testing Strategy

### 16.1 Unit Tests

- receipt builder command output
- Korean text encoding fixture
- row/table layout
- error normalization
- retry/backoff policy
- target validation

### 16.2 Integration Tests

- network transport: local TCP server로 bytes 수신 검증
- serial transport: mock binding 또는 loopback 가능한 환경에서 검증
- cups transport: child process wrapper mocking
- winspool transport: binding interface mocking

### 16.3 Platform Tests

GitHub Actions matrix:

- Windows latest: winspool build, unit test
- macOS latest: cups command wrapper test
- Ubuntu latest: cups command wrapper test
- Node LTS versions

Electron smoke test:

- Electron main process에서 package import
- IPC handler 등록
- packaged app에서 native module resolution 확인

### 16.4 Hardware Tests

실제 POS 프린터로 검증할 항목:

- TCP 9100 출력
- serial COM 출력
- Windows RAW spooler 출력
- macOS CUPS RAW 출력
- cut command
- Korean text
- QR code
- 긴 영수증 출력
- 연속 출력 시 안정성

## 17. Release Strategy

초기 release는 transport별 안정성을 기준으로 단계적으로 진행한다.

### Phase 0: Repository Setup

- monorepo 구성
- package naming 결정
- TypeScript build/test/lint 설정
- core type과 error model 추가
- CI 기본 matrix 구성

### Phase 1: Core + Serial

- receipt builder MVP
- ESC/POS 기본 command
- serial transport
- serial port list API
- serial option validation
- serial write/drain lifecycle
- top-level `createPrinter` serial 지원

### Phase 2: Network

- network transport
- local TCP integration test
- timeout, retry, chunk write
- top-level `createPrinter` network 지원

### Phase 3: CUPS

- `lpstat` printer list
- `lp`/`lpr` RAW 출력
- command wrapper와 timeout
- macOS/Linux CI smoke test

### Phase 4: Winspool

- N-API addon scaffold
- printer list/default printer
- RAW print
- prebuild artifact
- Windows hardware validation

### Phase 5: Electron Wrapper

- main process service
- preload/IPC sample
- asar unpack guide
- example Electron app
- packaged app smoke test

### Phase 6: Advanced Receipt Features

- QR code
- barcode
- image rasterization
- printer profiles
- code page presets
- layout helpers

## 18. Initial Monorepo Tooling Recommendation

권장 기본값:

- package manager: `pnpm`
- monorepo: `pnpm-workspace.yaml`
- build: `tsup`
- test: `vitest`
- lint/format: `eslint`, `prettier`
- type checking: `tsc --build`
- native addon: `node-addon-api`, `node-gyp`, `prebuildify`

초기 `package.json` scripts 예시:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint"
  }
}
```

## 19. Open Decisions

구현 전에 확정하면 좋은 항목:

- npm scope 이름
- top-level package가 `serial`과 `winspool`을 기본 dependency로 포함할지 여부
- `createPrinter`를 sync API로 둘지 async API로 둘지 여부
- 기본 ESC/POS encoder 선택
- Korean encoding 기본값
- Windows winspool package의 배포 방식
- CUPS RAW 출력 옵션의 플랫폼별 호환 범위
- Electron example app 포함 여부

## 20. Recommended MVP

현재 구현 우선순위 기준의 MVP는 다음 범위다.

- `@maxxuxx/node-printer-core`
  - 공통 타입
  - error model
  - receipt builder MVP
  - ESC/POS 기본 command
- `@maxxuxx/node-printer-serial`
  - serialport 기반 출력
  - serial port list API
  - serial option validation
  - timeout
  - open/write/drain/close lifecycle
- `@maxxuxx/node-printer`
  - `createReceipt`
  - `createPrinter`
  - serial target 지원
- 테스트
  - receipt encoding unit test
  - serial mock binding unit test

이 MVP를 먼저 완성하면 Windows COM 포트와 macOS tty/usbserial 계열 POS 프린터를 실제로 출력 경로에 연결할 수 있다. 이후 network, CUPS, winspool 순서로 확장한다.
