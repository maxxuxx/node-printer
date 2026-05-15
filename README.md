# node-printer

ESC/POS receipt printer packages for Node.js and Electron

This repository is a pnpm monorepo. Most users should install the unified entry package, while advanced users can install individual transport packages directly

```bash
npm install @maxxuxx/node-printer
```

## Packages


| Package                          | Purpose                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| `@maxxuxx/node-printer`          | Unified entry point with lazy-loaded transports                        |
| `@maxxuxx/node-printer-core`     | Shared types, errors, ESC/POS receipt builder, CP949 encoding          |
| `@maxxuxx/node-printer-network`  | TCP 9100 transport with timeout, retry, chunked write                  |
| `@maxxuxx/node-printer-serial`   | Serial transport backed by `serialport`                                |
| `@maxxuxx/node-printer-cups`     | macOS and Linux system printer transport through `lp`, `lpr`, `lpstat` |
| `@maxxuxx/node-printer-winspool` | Windows Spooler RAW transport with bundled N-API prebuilds             |


## Quick Example

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

Change the target `type` to use another transport

```ts
createPrinter({ type: "serial", path: "COM3", baudRate: 9600 });
createPrinter({ type: "cups", printerName: "Receipt" });
createPrinter({ type: "winspool", printerName: "Receipt" });
```

## Platform Support


| Platform        | Network   | Serial    | CUPS          | Winspool      |
| --------------- | --------- | --------- | ------------- | ------------- |
| Windows ia32    | Supported | Supported | Not supported | Supported     |
| Windows x64     | Supported | Supported | Not supported | Supported     |
| Windows arm64   | Supported | Supported | Not supported | Supported     |
| macOS x64/arm64 | Supported | Supported | Supported     | Not supported |
| Linux x64/arm64 | Supported | Supported | Supported     | Not supported |


`@maxxuxx/node-printer` lazy-loads transport packages. Importing the main package on macOS or Linux does not load the Windows native binding

The winspool package is prebuild-only. It does not run a source build fallback during npm install

## Monorepo Setup

Use Node.js 20 or later

```powershell
corepack enable
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

If Corepack is blocked on Windows, use npm to execute the pinned pnpm version

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

Do not run `npm install` inside an individual workspace package. The packages use `workspace:*` dependencies, so installs must happen at the repository root

## Winspool Prebuilds

The Windows Spooler transport ships only bundled prebuilds

```text
packages/printer-winspool/prebuilds/
  win32-x64/
  win32-ia32/
  win32-arm64/
```

GitHub Actions builds these artifacts on `windows-2022`. To build them manually, use Windows PowerShell with Python and Visual Studio C++ tools installed

```powershell
corepack pnpm --filter @maxxuxx/node-printer-winspool... build
corepack pnpm --filter @maxxuxx/node-printer-winspool prebuild:all
corepack pnpm --filter @maxxuxx/node-printer-winspool pack:check
```

Fresh Build Tools install

```powershell
winget install --id Python.Python.3.13 --exact
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended"
```

More notes

- [Windows setup](docs/windows-setup.md)
- [Winspool N-API design](docs/winspool-napi-design.md)

## Test Server

The repository includes a local printer test UI

```powershell
corepack pnpm build
corepack pnpm test-server
```

Open `http://localhost:3007`

