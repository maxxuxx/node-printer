# @maxxuxx/node-printer

Unified ESC/POS receipt printer API for Node.js and Electron

This package provides one entry point for serial, network, CUPS, and Windows Spooler printers. Transport packages are lazy-loaded so importing the package does not immediately load platform-specific native modules

## Install

```bash
npm install @maxxuxx/node-printer
```

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

## Transports

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

Winspool is available only on Windows. The native binding is prebuild-only and does not compile during npm install

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

## Platform Notes

| Platform | Network | Serial | CUPS | Winspool |
| --- | --- | --- | --- | --- |
| Windows | Supported | Supported | Not supported | Supported |
| macOS | Supported | Supported | Supported | Not supported |
| Linux | Supported | Supported | Supported | Not supported |

Calling a winspool target on a non-Windows platform throws `ERR_UNSUPPORTED_PLATFORM`

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

## Electron

Use this package from the main process. If you package an app with winspool support, unpack native prebuilds

```json
{
  "asarUnpack": ["**/node_modules/@maxxuxx/node-printer-winspool/prebuilds/**/*.node"]
}
```

## Related Packages

- `@maxxuxx/node-printer-core`
- `@maxxuxx/node-printer-network`
- `@maxxuxx/node-printer-serial`
- `@maxxuxx/node-printer-cups`
- `@maxxuxx/node-printer-winspool`

## Repository

https://github.com/maxxuxx/node-printer
