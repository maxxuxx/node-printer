# Winspool N-API Design

[Korean](winspool-napi-design.md)

`@maxxuxx/node-printer-winspool` is a Windows-only optional native package

The goal is to implement Windows Spooler RAW printing and printer discovery directly, while keeping top-level `@maxxuxx/node-printer` installs from failing on non-Windows platforms

## Tech stack


| Area           | Stack               |
| -------------- | ------------------- |
| Runtime        | Node.js 20+         |
| Native API     | Windows Spooler API |
| Native binding | N-API, C++17        |
| Prebuild       | prebuildify         |
| Package        | TypeScript, tsup    |


## Support matrix


| Item                       | Support        | Notes                                 |
| -------------------------- | -------------- | ------------------------------------- |
| Windows ia32 prebuild      | ✅ Supported  | Bundled artifact target               |
| Windows x64 prebuild       | ✅ Supported  | Bundled artifact target               |
| Windows arm64 prebuild     | ✅ Supported  | Bundled artifact target               |
| macOS Winspool             | ❌ Not supported | Windows Spooler API is unavailable |
| Linux Winspool             | ❌ Not supported | Windows Spooler API is unavailable |
| Source build during `npm i` | ❌ Not provided | Published packages ship prebuilds only |


## Core direction

- Implement the N-API addon directly
- Call the Windows Spooler API from C++
- Expose a Promise-based JavaScript API
- Prefer `node-addon-api` where practical
- Generate prebuilt binaries with `prebuildify`
- Load bundled prebuilds from the npm package only
- Do not provide an install-time source build fallback

N-API avoids V8 ABI differences between Node and Electron

The intent is to reduce rebuild pressure across Electron major versions by reusing one binding on the stable N-API ABI

## Package strategy

The package is designed as a Windows-only optional package

```text
packages/
  printer-winspool/
```

Recommended dependency direction

```text
@maxxuxx/node-printer-core
  ↑
@maxxuxx/node-printer-winspool
```

The top-level `@maxxuxx/node-printer` package loads winspool behind a Windows platform guard

On non-Windows platforms, imports and calls must not take down the whole library

## Native API scope

The native binding wraps the minimum set of functions required for Windows Spooler RAW printing

- `OpenPrinterW`
- `StartDocPrinterW`
- `StartPagePrinter`
- `WritePrinter`
- `EndPagePrinter`
- `EndDocPrinter`
- `ClosePrinter`
- `EnumPrintersW`
- `GetDefaultPrinterW`

RAW printing follows this order

```text
OpenPrinterW
StartDocPrinterW with pDatatype = RAW
StartPagePrinter
WritePrinter
EndPagePrinter
EndDocPrinter
ClosePrinter
```

On failure, opened handles and started document or page state are cleaned up where possible

## Public JavaScript API

The published TypeScript API stays small and transport-focused

The native addon exports `listPrinters` and `getDefaultPrinter` at the binding layer, but the npm package entry points are the functions below

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

The top-level `@maxxuxx/node-printer` package wraps this API behind the common `Printer` contract

```ts
const printer = createPrinter({
  type: "winspool",
  printerName: "EPSON TM-T88"
});

await printer.print(receipt);
```

## Error mapping

Native errors are passed to JavaScript with the `GetLastError` value

Recommended error details include these fields

```ts
interface WinspoolNativeErrorDetail {
  operation: string;
  printerName?: string;
  win32Code: number;
  message: string;
}
```

The transport layer normalizes them into `PrinterError`

- printer not found → `ERR_PRINTER_NOT_FOUND`
- unsupported platform → `ERR_UNSUPPORTED_PLATFORM`
- native module load failure → `ERR_NATIVE_MODULE_UNAVAILABLE`
- spooler operation failure → `ERR_WINSPOOL_FAILED`

## Prebuild strategy

Distribution is prebuilt-binary first

- Generate Windows ia32, x64, and arm64 artifacts with `prebuildify`
- Load only the `.node` file under `prebuilds/win32-{arch}` at runtime
- Build on a GitHub Actions Windows runner
- Ship prebuild artifacts inside the npm package
- Use source builds only when generating prebuilds in this repository

N-API compatibility starts with `NAPI_VERSION=3` in `binding.gyp`

Prebuild scripts follow this shape

```json
{
  "prebuild:x64": "node scripts/prebuild.cjs x64",
  "prebuild:ia32": "node scripts/prebuild.cjs ia32",
  "prebuild:arm64": "node scripts/prebuild.cjs arm64"
}
```

The prebuild wrapper uses `vswhere` to locate a Visual Studio C++ installation and passes `npm_config_msvs_version` to node-gyp

ARM64 cross builds require both x64 host tools and ARM64 tools

Output follows the default `prebuildify` layout

```text
prebuilds/
  win32-x64/
    *.node
  win32-ia32/
    *.node
  win32-arm64/
    *.node
```

Depending on the `prebuildify` version, the generated file may be named `node.napi.node` or use a package-based name

The runtime loader discovers the `.node` file inside the matching directory

The npm package includes only `dist/**` and `prebuilds/**/*.node`

It does not ship `native/`, `binding.gyp`, `scripts/`, `build/`, `.pdb`, `.iobj`, or `.ipdb`

The install script is a no-op that prevents npm's default `node-gyp rebuild`

If no prebuild is available, runtime fails with `ERR_NATIVE_MODULE_UNAVAILABLE`

Initial targets are limited to these platforms


| Platform | Arch      | Support        |
| -------- | --------- | -------------- |
| win32    | ia32      | ✅ Supported    |
| win32    | x64       | ✅ Supported    |
| win32    | arm64     | ✅ Supported    |
| darwin   | x64/arm64 | ❌ Not supported |
| linux    | x64/arm64 | ❌ Not supported |


Non-Windows platforms return `ERR_UNSUPPORTED_PLATFORM` on import or public API calls

## Test strategy

Tests are split into three levels

1. Unit tests
   - JavaScript wrapper validation
   - Error normalization
   - Unsupported platform behavior

2. Native integration tests
   - Binding load on a Windows runner
   - `listWinspoolPrinters` smoke test
   - Default printer lookup smoke test

3. Hardware tests
   - ESC/POS bytes on a real Windows RAW-capable printer
   - `WritePrinter` byte count checks
   - Cut command checks
   - Repeated print stability

CI does not require a physical printer

Hardware testing is manual or runs on a separate self-hosted Windows machine

## Initial implementation steps

1. `packages/printer-winspool` scaffold
2. N-API addon build wiring
3. Unsupported platform JavaScript fallback
4. `listPrinters` native binding
5. `getDefaultPrinter` native binding
6. `printRaw` native binding
7. Top-level `createPrinter({ type: "winspool" })` platform guard integration
8. Windows CI prebuild
9. Hardware validation

## Current native status

- The `packages/printer-winspool` scaffold exists
- The TypeScript wrapper exposes `listWinspoolPrinters`, `getDefaultWinspoolPrinter`, `printRaw`, and `createWinspoolPrinter`
- Non-Windows calls fail with `ERR_UNSUPPORTED_PLATFORM`
- `binding.gyp` builds `native/src/winspool.cc` with C++17
- The native binding implements `EnumPrintersW`, `GetDefaultPrinterW`, and the RAW `WritePrinter` flow
- RAW printing runs through `napi_async_work` so Spooler writes do not block the Node event loop for long stretches
- Native errors include `code`, `operation`, `win32Code`, and optional `printerName`
- Top-level `@maxxuxx/node-printer` integration is wired through the Windows platform guard
- Real Windows hardware validation is still required

## Contributing

Windows printer validation notes, prebuild refreshes, and error mapping improvements are welcome

## License

MIT
