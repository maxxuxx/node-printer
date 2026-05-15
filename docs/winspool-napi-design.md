# Winspool N-API 설계

[English](winspool-napi-design.en.md)

`@maxxuxx/node-printer-winspool`은 Windows 전용 optional native 패키지로 둡니다

Windows Spooler RAW 출력과 프린터 목록 조회를 직접 구현하되, 최상위 `@maxxuxx/node-printer` 설치가 Windows가 아닌 환경에서 실패하지 않도록 격리하는 것이 목표입니다

## 사용 스택


| 영역           | 스택                |
| -------------- | ------------------- |
| Runtime        | Node.js 20+         |
| Native API     | Windows Spooler API |
| Native binding | N-API, C++17        |
| Prebuild       | prebuildify         |
| Package        | TypeScript, tsup    |


## 지원 여부


| 항목                     | 지원        | 설명                                  |
| ------------------------ | ----------- | ------------------------------------- |
| Windows ia32 prebuild    | ✅ 지원      | 번들 artifact 대상                    |
| Windows x64 prebuild     | ✅ 지원      | 번들 artifact 대상                    |
| Windows arm64 prebuild   | ✅ 지원      | 번들 artifact 대상                    |
| macOS Winspool           | ❌ 미지원    | Windows Spooler API 없음              |
| Linux Winspool           | ❌ 미지원    | Windows Spooler API 없음              |
| `npm install` 중 소스 빌드 | ❌ 미제공    | 배포 패키지는 번들 prebuild만 사용      |


## 기본 방향

- N-API addon을 직접 작성합니다
- C++에서 Windows Spooler API를 호출합니다
- JavaScript API는 Promise 기반으로 제공합니다
- `node-addon-api` 사용을 우선 검토합니다
- `prebuildify`로 prebuilt binary를 생성합니다
- npm 배포본은 prebuild만 로드하고, 설치 시점의 소스 빌드 폴백은 제공하지 않습니다

N-API를 쓰는 이유는 Node와 Electron의 V8 ABI 차이를 피하기 위해서입니다

Electron 메이저마다 native addon을 다시 빌드해야 하는 부담을 줄이고, 안정적인 N-API ABI 위에서 같은 binding을 재사용하는 것을 목표로 합니다

## 패키지 전략

패키지는 Windows 전용 optional 패키지로 설계합니다

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

최상위 `@maxxuxx/node-printer`는 winspool 패키지를 Windows 플랫폼 가드 뒤에서 로드합니다

Windows가 아닌 플랫폼에서는 import나 함수 호출이 전체 라이브러리 실패로 이어지면 안 됩니다

## 네이티브 API 범위

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

실패 시 열린 handle과 시작된 document 또는 page는 가능한 범위에서 정리합니다

## JavaScript 공개 API

패키지의 공개 TypeScript API는 transport에 맞게 단순하게 유지합니다

네이티브 addon이 export하는 `listPrinters` / `getDefaultPrinter`는 바인딩 레이어 이름이고, npm 패키지에서 권장하는 진입점은 아래 함수들입니다

```ts
import type { WinspoolPrinterTarget } from "@maxxuxx/node-printer-core";

export interface WinspoolPrinterInfo {
  name: string;
  isDefault: boolean;
  status?: number;
  driverName?: string;
  portName?: string;
}

export interface WinspoolPrintRawOptions {
  printerName: string;
  data: Uint8Array;
  documentName?: string;
}

export async function listWinspoolPrinters(): Promise<WinspoolPrinterInfo[]>;

export async function getDefaultWinspoolPrinter(): Promise<WinspoolPrinterInfo | null>;

export async function printRaw(options: WinspoolPrintRawOptions): Promise<{
  ok: true;
  printerName: string;
  jobId?: number;
  bytesWritten: number;
}>;

export function createWinspoolPrinter(target: WinspoolPrinterTarget): WinspoolPrinter;
```

최상위 `@maxxuxx/node-printer`에서는 이 API를 감싸 공통 `Printer` 계약으로 노출합니다

```ts
const printer = createPrinter({
  type: "winspool",
  printerName: "EPSON TM-T88"
});

await printer.print(receipt);
```

## 오류 매핑

native 오류는 `GetLastError` 값을 포함해 JavaScript로 전달합니다

권장 오류 detail 필드는 다음과 같습니다

```ts
interface WinspoolNativeErrorDetail {
  operation: string;
  printerName?: string;
  win32Code: number;
  message: string;
}
```

transport 레이어는 이를 `PrinterError`로 정규화합니다

- printer not found → `ERR_PRINTER_NOT_FOUND`
- unsupported platform → `ERR_UNSUPPORTED_PLATFORM`
- native module load failure → `ERR_NATIVE_MODULE_UNAVAILABLE`
- spooler operation failure → `ERR_WINSPOOL_FAILED`

## Prebuild 전략

배포는 prebuilt binary 우선으로 진행합니다

- `prebuildify`로 Windows ia32, x64, arm64 artifact 생성
- 런타임에는 `prebuilds/win32-{arch}` 아래의 `.node` 파일만 직접 로드
- GitHub Actions Windows runner에서 빌드
- npm 패키지에 prebuild artifact 포함
- 소스 빌드는 저장소에서 prebuild를 만들 때만 사용

N-API 호환 범위는 `binding.gyp`의 `NAPI_VERSION=3`으로 시작합니다

prebuild 스크립트는 다음 형태를 사용합니다

```json
{
  "prebuild:x64": "node scripts/prebuild.cjs x64",
  "prebuild:ia32": "node scripts/prebuild.cjs ia32",
  "prebuild:arm64": "node scripts/prebuild.cjs arm64"
}
```

prebuild 래퍼는 `vswhere`로 Visual Studio C++ 구성요소가 설치된 경로를 찾고 `npm_config_msvs_version`을 node-gyp에 넘깁니다

ARM64 교차 빌드는 x64 호스트 도구와 ARM64 도구를 함께 요구합니다

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

`prebuildify` 버전에 따라 `node.napi.node` 또는 패키지 이름 기반 파일명이 생성될 수 있으므로, 런타임 로더는 해당 디렉터리의 `.node` 파일을 탐색해 로드합니다

npm 패키지에는 `dist/**`와 `prebuilds/**/*.node`만 포함하고 `native/`, `binding.gyp`, `scripts/`, `build/`, `.pdb`, `.iobj`, `.ipdb`는 포함하지 않습니다

install 스크립트는 npm 기본 `node-gyp rebuild`를 막는 no-op으로만 둡니다

prebuild가 없으면 런타임에서 `ERR_NATIVE_MODULE_UNAVAILABLE`로 실패합니다

초기 타깃 플랫폼은 다음으로 제한합니다


| Platform | Arch      | 지원        |
| -------- | --------- | ----------- |
| win32    | ia32      | ✅ 지원      |
| win32    | x64       | ✅ 지원      |
| win32    | arm64     | ✅ 지원      |
| darwin   | x64/arm64 | ❌ 미지원    |
| linux    | x64/arm64 | ❌ 미지원    |


Windows가 아닌 플랫폼에서는 패키지 import 또는 함수 호출 시 `ERR_UNSUPPORTED_PLATFORM`을 반환합니다

## 테스트 전략

테스트는 세 단계로 나눕니다

1. Unit test
   - JavaScript wrapper 검증
   - 오류 정규화
   - 미지원 플랫폼 동작

2. Native integration test
   - Windows runner에서 binding 로드
   - `listWinspoolPrinters` 스모크 테스트
   - 기본 프린터 조회 스모크 테스트

3. Hardware test
   - 실제 Windows RAW 가능 프린터에서 ESC/POS 바이트 출력
   - `WritePrinter` 바이트 수 확인
   - 컷 명령 확인
   - 연속 출력 안정성 확인

CI에서는 실제 프린터 출력까지 강제하지 않습니다

하드웨어 테스트는 수동으로 하거나, 별도 self-hosted Windows 머신에서 수행합니다

## 초기 구현 단계

1. `packages/printer-winspool` 스캐폴드
2. N-API addon 빌드 설정
3. 미지원 플랫폼 JavaScript 폴백
4. `listPrinters` native binding
5. `getDefaultPrinter` native binding
6. `printRaw` native binding
7. 최상위 `createPrinter({ type: "winspool" })` 플랫폼 가드 연동
8. Windows CI prebuild
9. 하드웨어 검증

## 현재 네이티브 구현 상태

- `packages/printer-winspool` 패키지 스캐폴드가 존재합니다
- TypeScript 래퍼는 `listWinspoolPrinters`, `getDefaultWinspoolPrinter`, `printRaw`, `createWinspoolPrinter`를 노출합니다
- Windows가 아닌 환경에서의 호출은 `ERR_UNSUPPORTED_PLATFORM`으로 실패합니다
- `binding.gyp`는 `native/src/winspool.cc`를 C++17로 빌드합니다
- native binding은 `EnumPrintersW`, `GetDefaultPrinterW`, RAW `WritePrinter` 흐름을 구현합니다
- RAW 출력은 `napi_async_work`로 실행되어 Spooler 쓰기가 Node 이벤트 루프를 오래 막지 않습니다
- native 오류에는 `code`, `operation`, `win32Code`, 선택적 `printerName`이 포함됩니다
- 최상위 `@maxxuxx/node-printer` 연동은 Windows 플랫폼 가드를 통해 연결되어 있습니다
- 실제 Windows 하드웨어 검증은 계속 필요합니다

## 기여

Windows 프린터 모델별 검증 결과, prebuild 갱신, 오류 매핑 개선에 대한 기여를 환영합니다

## License

MIT
