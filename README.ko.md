# node-printer

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
[![prebuildify](https://img.shields.io/badge/prebuildify-prebuilds-222222?style=flat-square)](https://github.com/prebuild/prebuildify)
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
| Serial          | ✅ 지원              | `serialport` 패키지로 시리얼 포트 출력                   |
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

## 패키지


| 패키지                              | 용도                                                         |
| -------------------------------- | ---------------------------------------------------------- |
| `@maxxuxx/node-printer`          | lazy-loaded transport를 제공하는 통합 진입점                         |
| `@maxxuxx/node-printer-core`     | 공통 타입, 오류, ESC/POS 영수증 builder, CP949 인코딩                  |
| `@maxxuxx/node-printer-network`  | timeout, retry, chunked write를 갖춘 TCP 9100 transport       |
| `@maxxuxx/node-printer-serial`   | `serialport` 기반 serial transport                           |
| `@maxxuxx/node-printer-cups`     | `lp`, `lpr`, `lpstat`을 사용하는 macOS와 Linux 시스템 프린터 transport |
| `@maxxuxx/node-printer-winspool` | bundled N-API prebuild를 포함한 Windows Spooler RAW transport  |


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

`type`만 바꾸면 다른 출력 방식을 사용할 수 있습니다

```ts
createPrinter({ type: "serial", path: "COM3", baudRate: 9600 });
createPrinter({ type: "cups", printerName: "Receipt" });
createPrinter({ type: "winspool", printerName: "Receipt" });
```

## Prebuild

Windows Spooler 패키지는 bundled N-API prebuild를 포함합니다

```text
packages/printer-winspool/prebuilds/
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


수동으로 빌드하려면 Python과 Visual Studio C++ 도구가 설치된 Windows PowerShell을 사용합니다

```powershell
corepack pnpm --filter @maxxuxx/node-printer-winspool... build
corepack pnpm --filter @maxxuxx/node-printer-winspool prebuild:all
corepack pnpm --filter @maxxuxx/node-printer-winspool pack:check
```

Build Tools를 새로 설치해야 한다면 다음 명령을 사용할 수 있습니다

```powershell
winget install --id Python.Python.3.13 --exact
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