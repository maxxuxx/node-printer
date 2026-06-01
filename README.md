# node-printer
[![npm version](https://img.shields.io/npm/v/@maxxuxx/node-printer.svg)](https://www.npmjs.com/package/@maxxuxx/node-printer)

[Korean](README.ko.md)

This project started from the friction of using different libraries for network, serial, CUPS, and Windows Spooler when printing ESC/POS receipts from Node.js, and from recognizing how important prebuilt libraries are when using Winspool

The goal is one small API across those paths, and Windows native modules load only on Windows

## Tech Stack

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

## Install

Most users should install the unified package

```bash
npm install @maxxuxx/node-printer
```

## Platform support


| Platform        | Network | Serial | CUPS        | Winspool |
| --------------- | ------- | ------ | ----------- | -------- |
| Windows ia32    | ✅ Supported | ✅ Supported | ❌ Not supported | ✅ Supported |
| Windows x64     | ✅ Supported | ✅ Supported | ❌ Not supported | ✅ Supported |
| Windows arm64   | ✅ Supported | ✅ Supported | ❌ Not supported | ✅ Supported |
| macOS x64/arm64 | ✅ Supported | ✅ Supported | ✅ Supported     | ❌ Not supported |
| Linux x64/arm64 | ✅ Supported | ✅ Supported | ✅ Supported     | ❌ Not supported |


## Connection modes


| Mode            | Support                 | Description                                      |
| --------------- | ----------------------- | ------------------------------------------------ |
| TCP(network)    | ✅ Supported             | Works on Windows, macOS, and Linux               |
| Serial          | ✅ Supported             | Serial ports through the `serialport` package    |
| CUPS            | ✅ Supported             | `lp`, `lpr`, and `lpstat` on macOS and Linux     |
| Windows Spooler | ✅ Supported (Windows only) | Bundled N-API prebuilds on Windows          |


## Supported encodings

The receipt builder supports the encodings below


| Encoding | Support      | When to use                         |
| -------- | ------------ | ----------------------------------- |
| `utf8`   | ✅ Supported | Default, UTF-8 text output          |
| `ascii`  | ✅ Supported | English and numbers first           |
| `cp949`  | ✅ Supported | Recommended for Korean receipts     |


Korean receipts usually use `cp949`

```ts
const receipt = createReceipt({ encoding: "cp949" }).text("테스트 출력").encode();
```

## Packages


| Package                          | Purpose                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| `@maxxuxx/node-printer`          | Unified entry point with lazy-loaded transports                        |
| `@maxxuxx/node-printer-core`     | Shared types, errors, ESC/POS receipt builder, CP949 encoding          |
| `@maxxuxx/node-printer-network`  | TCP 9100 transport with timeout, retry, and chunked writes             |
| `@maxxuxx/node-printer-serial`   | Serial transport backed by `serialport`                              |
| `@maxxuxx/node-printer-cups`     | macOS and Linux system printers through `lp`, `lpr`, and `lpstat`      |
| `@maxxuxx/node-printer-winspool` | Windows Spooler RAW transport with bundled N-API prebuilds             |


## Quick Start

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

Change `type` to switch printer paths

```ts
createPrinter({ type: "serial", path: "COM3", baudRate: 9600 });
createPrinter({ type: "cups", printerName: "Receipt" });
createPrinter({ type: "winspool", printerName: "Receipt" });
```

## Prebuild

The Windows Spooler package ships bundled N-API prebuilds

```text
packages/printer-winspool/prebuilds/
  win32-x64/
  win32-ia32/
  win32-arm64/
```

Usually you can use the prebuilds shipped with the package as-is. When you need to validate or refresh native artifacts, build in this repository


| Approach                    | Status           | When to use                                      |
| --------------------------- | ---------------- | ------------------------------------------------ |
| Bundled winspool prebuild   | ✅ Recommended    | App installs and typical package usage           |
| Direct repository build     | ✅ Available      | Native validation and refreshing prebuild output |
| Source build during `npm i` | ❌ Not yet available | Planned for a later release                   |


To build manually, use Windows PowerShell with Python and the Visual Studio C++ toolchain installed

```powershell
corepack pnpm --filter @maxxuxx/node-printer-winspool... build
corepack pnpm --filter @maxxuxx/node-printer-winspool prebuild:all
corepack pnpm --filter @maxxuxx/node-printer-winspool pack:check
```

If you need to install Build Tools from scratch, you can use the following commands

```powershell
winget install --id Python.Python.3.13 --exact
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended"
```

## Local development

Use Node.js 20 or later

```powershell
corepack enable
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Do not run `npm install` inside an individual workspace package

This repository uses `workspace:*` dependencies, so installs must run from the repository root

## Test server

This repository includes a local printer test UI

```powershell
corepack pnpm build
corepack pnpm test-server
```

Open `http://localhost:3007` to try each library

## More documentation

- [Windows setup](docs/windows-setup.en.md)
- [Winspool N-API design](docs/winspool-napi-design.en.md)

## Contributors welcome

Bug fixes, documentation, platform validation, and real-printer test notes are welcome

Hardware notes are especially valuable because ESC/POS devices differ by vendor, firmware, and connection type

## License

MIT
