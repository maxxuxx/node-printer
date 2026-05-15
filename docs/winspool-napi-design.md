# Winspool N-API Design

`@maxxuxx/node-printer-winspool`은 Windows 전용 optional native 패키지로 둡니다

목표는 Windows Spooler RAW 출력과 프린터 목록 조회를 직접 구현하되, top-level `@maxxuxx/node-printer` 설치가 Windows 외 플랫폼에서 실패하지 않게 격리하는 것입니다

## 기본 방향

- N-API addon을 직접 작성
- C 또는 C++에서 Windows Spooler API 호출
- JavaScript API는 Promise 기반으로 제공
- `node-addon-api` 사용을 우선 검토
- `prebuildify`로 prebuilt binary 생성
- npm 배포본은 prebuild만 로드하고 source build fallback을 제공하지 않음

N-API를 쓰는 이유는 Node와 Electron의 V8 ABI 차이를 피하기 위해서입니다. Electron major version마다 native addon rebuild가 필요한 구조를 줄이고, N-API 안정 ABI 위에서 같은 binding을 재사용하는 것이 목표입니다

## Package Strategy

패키지는 Windows 전용 optional package로 설계합니다

```text
packages/
  printer-winspool/
```

권장 의존 방향은 다음과 같습니다

```text
@maxxuxx/node-printer-core
  ↑
@maxxuxx/node-printer-winspool
```

top-level `@maxxuxx/node-printer`는 winspool package를 Windows platform guard 뒤에서 다룹니다. Windows가 아닌 플랫폼에서는 import 또는 함수 호출이 전체 라이브러리 실패로 이어지면 안 됩니다

## Native API Scope

초기 native binding은 Windows Spooler RAW 출력에 필요한 최소 함수만 감쌉니다

- `OpenPrinterW`
- `StartDocPrinterW`
- `StartPagePrinter`
- `WritePrinter`
- `EndPagePrinter`
- `EndDocPrinter`
- `ClosePrinter`
- `EnumPrintersW`
- `GetDefaultPrinterW`

RAW 출력 경로는 다음 순서로 동작합니다

```text
OpenPrinterW
StartDocPrinterW with pDatatype = RAW
StartPagePrinter
WritePrinter
EndPagePrinter
EndDocPrinter
ClosePrinter
```

실패 시 열린 handle과 시작된 document/page는 가능한 범위에서 정리합니다

## JavaScript API Shape

패키지 public API는 transport 패키지답게 단순하게 둡니다

```ts
export interface WinspoolPrinterInfo {
  name: string;
  isDefault: boolean;
  status?: number;
  driverName?: string;
  portName?: string;
}

export interface WinspoolPrintRawOptions {
  printerName: string;
  data: Uint8Array | Buffer;
  documentName?: string;
  timeoutMs?: number;
}

export interface WinspoolPrintResult {
  ok: true;
  printerName: string;
  jobId?: number;
  bytesWritten: number;
}

export function listPrinters(): Promise<WinspoolPrinterInfo[]>;
export function getDefaultPrinter(): Promise<WinspoolPrinterInfo | null>;
export function printRaw(options: WinspoolPrintRawOptions): Promise<WinspoolPrintResult>;
```

top-level `@maxxuxx/node-printer`에서는 이 API를 감싸서 공통 `Printer` interface로 노출합니다

```ts
const printer = createPrinter({
  type: "winspool",
  printerName: "EPSON TM-T88"
});

await printer.print(receipt);
```

## Error Mapping

native error는 `GetLastError` 값을 포함해서 JavaScript로 전달합니다

권장 error detail은 다음 필드를 포함합니다

```ts
interface WinspoolNativeErrorDetail {
  operation: string;
  printerName?: string;
  win32Code: number;
  message: string;
}
```

transport layer는 이를 `PrinterError`로 정규화합니다

- printer not found -> `ERR_PRINTER_NOT_FOUND`
- unsupported platform -> `ERR_UNSUPPORTED_PLATFORM`
- native module load failure -> `ERR_NATIVE_MODULE_UNAVAILABLE`
- spooler operation failure -> `ERR_WINSPOOL_FAILED`

## Prebuild Strategy

배포는 prebuilt binary 우선으로 진행합니다

- `prebuildify`로 Windows ia32, x64, arm64 artifact 생성
- runtime에서는 `prebuilds/win32-{arch}` 아래의 `.node` 파일만 직접 로드
- GitHub Actions Windows runner에서 build
- npm package에는 prebuild artifact 포함
- source build는 저장소에서 prebuild를 만들 때만 사용

N-API 호환 범위는 `binding.gyp`의 `NAPI_VERSION=3`으로 시작합니다

prebuild script는 다음처럼 둡니다

```json
{
  "prebuild:x64": "node scripts/prebuild.cjs x64",
  "prebuild:ia32": "node scripts/prebuild.cjs ia32",
  "prebuild:arm64": "node scripts/prebuild.cjs arm64"
}
```

prebuild wrapper는 `vswhere`로 필요한 Visual Studio C++ 컴포넌트가 있는 설치 경로를 찾고 `npm_config_msvs_version`으로 node-gyp에 전달합니다
ARM64 cross build는 x64 host 도구와 ARM64 도구를 모두 요구합니다

산출물 구조는 `prebuildify` 기본 구조를 사용합니다

```text
prebuilds/
  win32-x64/
    *.node
  win32-ia32/
    *.node
  win32-arm64/
    *.node
```

prebuildify 버전에 따라 `node.napi.node` 또는 package name 기반 파일명이 생성될 수 있으므로 runtime loader는 해당 디렉터리의 `.node` 파일을 사용합니다

npm package에는 `dist/**`와 `prebuilds/**/*.node`만 포함하고 `native/`, `binding.gyp`, `scripts/`, `build/`, `.pdb`, `.iobj`, `.ipdb`는 포함하지 않습니다

install script는 npm 기본 `node-gyp rebuild`를 막는 no-op으로만 둡니다
prebuild가 없으면 런타임에서 `ERR_NATIVE_MODULE_UNAVAILABLE`로 실패합니다

초기 target은 다음으로 제한합니다

| Platform | Arch      | Status      |
| -------- | --------- | ----------- |
| win32    | ia32      | required    |
| win32    | x64       | required    |
| win32    | arm64     | required    |
| darwin   | x64/arm64 | unsupported |
| linux    | x64/arm64 | unsupported |

Windows 외 플랫폼에서는 패키지 import 또는 함수 호출 시 명확한 `ERR_UNSUPPORTED_PLATFORM`을 반환합니다

## Electron Strategy

Electron 앱에서는 main process에서만 winspool package를 import합니다

- renderer에 native module object를 노출하지 않음
- preload에서는 제한된 IPC 함수만 제공
- packaged app에서는 native binary를 `asarUnpack` 대상에 포함
- N-API 기반으로 Electron rebuild 부담을 줄임

## Test Strategy

테스트는 세 단계로 나눕니다

1. Unit test
   - JavaScript wrapper validation
   - error normalization
   - unsupported platform behavior

2. Native integration test
   - Windows runner에서 binding load
   - `listPrinters` 호출 smoke test
   - default printer 조회 smoke test

3. Hardware test
   - 실제 Windows RAW capable printer에서 ESC/POS bytes 출력
   - `WritePrinter` bytes count 확인
   - cut command 확인
   - 연속 출력 안정성 확인

CI에서는 실제 출력까지 강제하지 않습니다. 하드웨어 테스트는 수동 또는 별도 self-hosted Windows machine에서 수행합니다

## Risks

- Windows printer driver가 RAW datatype을 지원하지 않을 수 있음
- USB 프린터가 COM 포트가 아니라 Spooler printer로만 보일 수 있음
- Spooler job은 성공했지만 장치 출력이 실패하는 경우가 있음
- printer status 값이 driver마다 일관되지 않을 수 있음
- Electron packaging에서 native binary 경로 resolution 문제가 생길 수 있음
- Windows 보안 정책이나 권한 제한으로 Spooler 접근이 막힐 수 있음
- prebuild가 없는 architecture에서는 winspool transport를 사용할 수 없음

## Initial Implementation Steps

1. `packages/printer-winspool` scaffold
2. N-API addon build 설정
3. unsupported platform JavaScript fallback
4. `listPrinters` native binding
5. `getDefaultPrinter` native binding
6. `printRaw` native binding
7. top-level `createPrinter({ type: 'winspool' })` platform guard integration
8. Windows CI prebuild
9. hardware validation

## Current Native Status

- `packages/printer-winspool` package scaffold exists
- TypeScript wrapper exposes `listWinspoolPrinters`, `getDefaultWinspoolPrinter`, `printRaw`, and `createWinspoolPrinter`
- non-Windows calls fail with `ERR_UNSUPPORTED_PLATFORM`
- `binding.gyp` builds `native/src/winspool.cc` with C++17
- native binding now implements `EnumPrintersW`, `GetDefaultPrinterW`, and RAW `WritePrinter` flow
- RAW print runs through `napi_async_work` so Spooler writes do not block the Node event loop
- native errors include `code`, `operation`, `win32Code`, and optional `printerName`
- top-level `@maxxuxx/node-printer` integration is wired through the Windows platform guard
- Windows hardware validation is still required
