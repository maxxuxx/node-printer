# @maxxuxx/node-printer

[한국어](README.ko.md)

Unified ESC/POS receipt printer API for Node.js and Electron

This package provides one entry point for serial, network, CUPS, and Windows Spooler printers

Transport packages are lazy-loaded so importing the package does not immediately load platform-specific native modules

## Tech Stack

| Area           | Stack                                  |
| -------------- | -------------------------------------- |
| Runtime        | Node.js 20+                            |
| Language       | TypeScript                             |
| Module output  | ESM and CommonJS                       |
| Receipt output | ESC/POS bytes                          |
| Transports     | Network, Serial, CUPS, Windows Spooler |
| Native loading | Lazy import with bundled prebuilds     |

## Install

```bash
npm install @maxxuxx/node-printer
```

## What Works

| Feature                    | Status       | Notes                                       |
| -------------------------- | ------------ | ------------------------------------------- |
| Network TCP 9100           | ✅ Available | Works on Windows, macOS, and Linux          |
| Serial COM or tty          | ✅ Available | Uses OS COM or tty devices                  |
| CUPS printing              | ✅ Available | Works on macOS and Linux                    |
| Windows Spooler RAW        | ✅ Available | Works on Windows with bundled prebuilds     |
| Winspool on macOS or Linux | ❌ Not used  | Throws `ERR_UNSUPPORTED_PLATFORM`           |
| npm source build fallback  | ❌ Not used  | Published installs expect bundled prebuilds |

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

## Choose a Printer

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

### Serial

```ts
const printer = createPrinter({
  type: "serial",
  path: "COM3",
  baudRate: 9600
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

Winspool is available only on Windows

The native binding uses bundled prebuilds and does not compile during npm install

## Receipt Builder

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

Supported builder commands include text, rows, alignment, bold, underline, size, feed, cut, QR, barcode, image, and raw bytes

## Platform Support

| Platform | Network      | Serial       | CUPS         | Winspool     |
| -------- | ------------ | ------------ | ------------ | ------------ |
| Windows  | ✅ Supported | ✅ Supported | ❌ No        | ✅ Supported |
| macOS    | ✅ Supported | ✅ Supported | ✅ Supported | ❌ No        |
| Linux    | ✅ Supported | ✅ Supported | ✅ Supported | ❌ No        |

Calling a winspool target on a non-Windows platform throws `ERR_UNSUPPORTED_PLATFORM`

## Prebuilds

Normal installs use the bundled winspool prebuild when running on Windows

Direct native builds are available in the repository for maintainers and contributors who need to validate or refresh prebuild artifacts

| Path                        | Status          | When to use                                 |
| --------------------------- | --------------- | ------------------------------------------- |
| Bundled winspool prebuild   | ✅ Recommended  | App installs and normal package usage       |
| Direct repository build     | ✅ Available    | Native validation and prebuild refresh work |
| Source build during install | ❌ Not provided | Keeps npm installs predictable across OSes  |

## Errors

All package-level errors use `PrinterError`

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

Common error codes include `ERR_INVALID_TARGET`, `ERR_UNSUPPORTED_PLATFORM`, `ERR_CONNECTION_TIMEOUT`, `ERR_WRITE_TIMEOUT`, `ERR_NATIVE_MODULE_UNAVAILABLE`, and transport-specific failure codes

## Internal Modules

Only `@maxxuxx/node-printer` is published to npm

- `@node-printer/core`
- `@node-printer/network`
- `@node-printer/serial`
- `@node-printer/cups`
- `@node-printer/winspool`

## Contributors Welcome

Contributions are welcome for bug fixes, docs, platform checks, and printer validation notes

## Repository

[https://github.com/maxxuxx/node-printer](https://github.com/maxxuxx/node-printer)

## License

MIT
