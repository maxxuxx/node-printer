# node-printer

[![npm version](https://img.shields.io/npm/v/@maxxuxx/node-printer.svg)](https://www.npmjs.com/package/@maxxuxx/node-printer)

[English](README.md)

이 프로젝트는 Node.js에서 ESC/POS 영수증 프린터를 다룰 때 네트워크, 시리얼, CUPS, Windows Spooler마다 다른 라이브러리를 사용해야 하는 불편함과, Winspool 사용하기 위해 Prebuild 라이브러리의 중요성을 확인하여 시작되었습니다

여러 출력 방식을 하나의 작은 API로 다루고, Windows native 모듈은 Windows OS에서만 로드되게 합니다

## 사용 스택

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.1.1-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![tsup](https://img.shields.io/badge/tsup-8-FF6B00?style=flat-square)](https://tsup.egoist.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-4-729B1B?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)  
[![ESLint](https://img.shields.io/badge/ESLint-10-4B32C3?style=flat-square&logo=eslint&logoColor=white)](https://eslint.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev/)
[![N-API](https://img.shields.io/badge/N--API%20%28winspool%29-C%2B%2B17-0078D4?style=flat-square&logo=windows&logoColor=white)](https://nodejs.org/api/n-api.html)

## 설치

대부분의 사용자는 통합 패키지를 설치하면 됩니다

```bash
npm install @maxxuxx/node-printer
```

## 플랫폼 지원


| 플랫폼             | Network | Serial | CUPS  | Winspool |
| --------------- | ------- | ------ | ----- | -------- |
| Windows ia32    | ✅ 지원    | ✅ 지원   | ❌ 미지원 | ✅ 지원     |
| Windows x64     | ✅ 지원    | ✅ 지원   | ❌ 미지원 | ✅ 지원     |
| Windows arm64   | ✅ 지원    | ✅ 지원   | ❌ 미지원 | ✅ 지원     |
| macOS x64/arm64 | ✅ 지원    | ✅ 지원   | ✅ 지원  | ❌ 미지원    |
| Linux x64/arm64 | ✅ 지원    | ✅ 지원   | ✅ 지원  | ❌ 미지원    |


## 연결 방식


| 방식              | 지원                | 설명                                            |
| --------------- | ----------------- | --------------------------------------------- |
| TCP(네트워크)       | ✅ 지원              | Windows, macOS, Linux에서 사용 가능                 |
| Serial          | ✅ 지원              | serialport 기반 COM 또는 tty 장치 출력                  |
| CUPS            | ✅ 지원              | macOS, Linux에서 `lp` / `lpr` / `lpstat` 계열로 출력 |
| Windows Spooler | ✅ 지원 (Windows 전용) | Windows에서 번들된 N-API prebuild로 동작              |


## 지원 인코딩

영수증 builder는 아래 인코딩을 지원합니다


| 인코딩     | 지원   | 사용 상황             |
| ------- | ---- | ----------------- |
| `utf8`  | ✅ 지원 | 기본값, UTF-8 텍스트 출력 |
| `ascii` | ✅ 지원 | 영문과 숫자 중심 출력      |
| `cp949` | ✅ 지원 | 한글 영수증 출력 권장      |


한글 영수증은 보통 `cp949`를 사용합니다

```ts
const receipt = createReceipt({ encoding: "cp949" }).text("테스트 출력").encode();
```

## 워크스페이스 모듈

npm에는 `@maxxuxx/node-printer`만 배포하고, 나머지 이름은 private 내부 alias로만 사용합니다

기존 `@maxxuxx/node-printer-*` 개별 패키지는 npm에서 deprecated 처리하고 `@maxxuxx/node-printer`로 대체합니다


| 모듈                       | 용도                                                         |
| ------------------------ | ---------------------------------------------------------- |
| `@maxxuxx/node-printer`  | lazy-loaded transport를 제공하는 배포 진입점                         |
| `apps/printer/src/core`     | 공통 타입, 오류, ESC/POS 영수증 builder, CP949 인코딩                  |
| `apps/printer/src/transports/network`  | timeout, retry, chunked write를 갖춘 TCP 9100 transport       |
| `apps/printer/src/transports/serial`   | serialport 기반 COM 또는 tty 장치를 사용하는 serial transport          |
| `apps/printer/src/transports/cups`     | `lp`, `lpr`, `lpstat`을 사용하는 macOS와 Linux 시스템 프린터 transport |
| `apps/printer/src/transports/winspool` | bundled N-API prebuild를 포함한 Windows Spooler RAW transport        |


## 빠른 시작

```ts
import { createReceipt, print } from "@maxxuxx/node-printer";

const receipt = createReceipt({ encoding: "cp949" })
  .initialize()
  .text("테스트 출력")
  .divider()
  .text("NETWORK OK")
  .feed(3)
  .cut()
  .encode();

await print({
  type: "network",
  host: "192.168.0.50",
  port: 9100
}, receipt);
```

`type`만 바꾸면 다른 출력 방식을 사용할 수 있습니다

```ts
await print({ type: "serial", path: "COM3", baudRate: 9600 }, receipt);
await print({ type: "cups", printerName: "Receipt" }, receipt);
await print({ type: "winspool", printerName: "Receipt" }, receipt);
```

조회 가능한 transport는 프린터 목록을 가져올 수 있습니다

```ts
import { listPrinters } from "@maxxuxx/node-printer";

const serialPorts = await listPrinters("serial");
const usbPrinters = await listPrinters("usb");
const networkPrinters = await listPrinters("network");
```

## Electron bridge

Electron preload에서 설정 파일 경로를 등록하고 기존 bridge에 printer API를 합칠 수 있습니다

`printersJsonPath`는 Electron main 쪽에서 `app.getPath("userData")` 아래 경로로 준비하는 것을 권장합니다

```ts
import { contextBridge } from "electron";
import {
  configurePrinterSettings,
  createPrinterBridge
} from "@maxxuxx/node-printer";

configurePrinterSettings({ filePath: printersJsonPath });

contextBridge.exposeInMainWorld("electronAPI", {
  printer: createPrinterBridge()
});
```

웹에서는 실제 프린터를 조회하고 사용할 프린터를 저장합니다

```ts
const printers = await window.electronAPI.printer.listPrinters("usb");
const saved = await window.electronAPI.printer.savePrinter({
  name: "카운터",
  type: "usb",
  printerName: printers[0].name,
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});
```

저장된 프린터 id로 영수증을 만들고 출력합니다

```ts
await window.electronAPI.printer
  .createReceipt(saved.id)
  .initialize()
  .text("테스트 출력")
  .divider()
  .text("합계 4,500")
  .feed(3)
  .cut()
  .print({ copies: 2 });
```

여러 프린터에 같은 영수증을 보낼 때는 id 배열을 사용합니다

```ts
await window.electronAPI.printer
  .createReceipt([counterId, kitchenId])
  .text("테스트 출력")
  .cut()
  .print();
```

`exposePrinterBridge(contextBridge)`를 쓰면 기본 이름인 `window.nodePrinter`로 노출됩니다

외부 웹 페이지에 bridge를 노출하면 프린터 권한도 함께 노출되므로 신뢰할 수 있는 URL에만 연결해야 합니다

## Prebuild

Windows Spooler 패키지는 bundled N-API prebuild를 포함합니다

```text
apps/printer/prebuilds/
  win32-x64/
  win32-ia32/
  win32-arm64/
```

일반적으로 라이브러리에 포함 된 prebuild를 그대로 사용하면 되고, native artifact를 검증하거나 갱신해야 하는 경우에는 이 저장소에서 직접 빌드할 수 있습니다


| 방식                         | 상태      | 사용 시점                  |
| -------------------------- | ------- | ---------------------- |
| bundled winspool prebuild  | ✅ 권장    | 앱 설치와 일반 패키지 사용        |
| repository 직접 빌드           | ✅ 가능    | native 검증과 prebuild 갱신 |
| npm install 중 source build | ❌ 현재 불가 | 추후 추가 예정               |


winspool prebuild를 수동으로 갱신하려면 Visual Studio C++ Build Tools와 Windows SDK가 설치된 Windows PowerShell을 사용합니다

```powershell
corepack pnpm --filter @maxxuxx/node-printer build
corepack pnpm --filter @maxxuxx/node-printer prebuild:all
corepack pnpm --filter @maxxuxx/node-printer pack:check
```

Build Tools를 새로 설치해야 한다면 다음 명령을 사용할 수 있습니다

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended"
```

## 로컬 개발

Node.js 20 이상을 사용합니다

```powershell
corepack enable
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

개별 workspace package 안에서 `npm install`을 실행하지 않습니다

이 저장소는 `workspace:*` 의존성을 사용하므로 설치는 root 경로에서 실행해야 합니다

## 테스트 서버

저장소에는 로컬 프린터 테스트 UI가 포함되어 있습니다

```powershell
corepack pnpm build
corepack pnpm test-server
```

`http://localhost:3007`에 접속하여 각 라이브러리를 테스트 해볼 수 있습니다

## 추가 문서

- [Windows setup](docs/windows-setup.md)
- [Winspool N-API design](docs/winspool-napi-design.md)

## Contributors 환영

버그 수정, 문서 개선, 플랫폼 검증, 프린터 테스트 기록 기여를 환영합니다

실제 ESC/POS 프린터는 제조사, 펌웨어, 연결 방식에 따라 차이가 커서 하드웨어 검증 기록이 특히 도움이 됩니다

## License

MIT
