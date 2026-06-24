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
| Serial COM or tty          | ✅ Available | Works on Windows, macOS, and Linux with bundled prebuilds |
| CUPS printing              | ✅ Available | Works on macOS and Linux                    |
| Windows Spooler RAW        | ✅ Available | Works on Windows with bundled prebuilds     |
| Winspool on macOS or Linux | ❌ Not used  | Throws `ERR_UNSUPPORTED_PLATFORM`           |
| npm source build fallback  | ❌ Not used  | Published installs expect bundled prebuilds |

## Quick Start

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

## Choose a Printer

### Network

```ts
await print({
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
}, receipt);
```

### Serial

```ts
await print({
  type: "serial",
  path: "COM3",
  baudRate: 9600
}, receipt);
```

### CUPS

```ts
await print({
  type: "cups",
  printerName: "Receipt",
  documentName: "Receipt"
}, receipt);
```

### Windows Spooler

```ts
await print({
  type: "winspool",
  printerName: "Receipt",
  documentName: "Receipt"
}, receipt);
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
| Android  | ⚠️ Runtime dependent | ⚠️ Prebuild included | ❌ No | ❌ No |

Calling a winspool target on a non-Windows platform throws `ERR_UNSUPPORTED_PLATFORM`

Android serial arm and arm64 prebuilds are included, but Android runtime support is experimental because serial device access depends on the host Node environment and OS permissions

## List Printers

```ts
import { listPrinters } from "@maxxuxx/node-printer";

const serialPorts = await listPrinters("serial");
const usbPrinters = await listPrinters("usb");
const networkPrinters = await listPrinters("network");
```

## Electron bridge

Register the settings file path from Electron and merge the printer API into an existing bridge

Prepare `printersJsonPath` from Electron main under `app.getPath("userData")`

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

The web page can discover real printers and save the printer profile used by the app

```ts
const printers = await window.electronAPI.printer.listPrinters("usb");
const saved = await window.electronAPI.printer.savePrinter({
  name: "Counter",
  type: "usb",
  printerName: printers[0].name,
  receipt: {
    encoding: "cp949",
    paperWidth: 80,
    charsPerLine: 48
  }
});
```

Build and print a receipt through the saved printer id

```ts
await window.electronAPI.printer
  .createReceipt(saved.id)
  .initialize()
  .text("Test print")
  .divider()
  .text("Total 4,500")
  .feed(3)
  .cut()
  .print({ copies: 2 });
```

Use an id list to send the same receipt commands to multiple printers

```ts
await window.electronAPI.printer
  .createReceipt([counterId, kitchenId])
  .text("Test print")
  .cut()
  .print();
```

`exposePrinterBridge(contextBridge)` is still available when you want the default `window.nodePrinter` name

Only expose the bridge to trusted URLs because the page receives printer access through the bridge

## Prebuilds

Normal installs use bundled serial prebuilds on Windows, macOS, Linux, and Android arm or arm64

Normal installs use the bundled winspool prebuild when running on Windows

Direct native builds are available in the repository for maintainers and contributors who need to validate or refresh prebuild artifacts

| Path                        | Status          | When to use                                 |
| --------------------------- | --------------- | ------------------------------------------- |
| Bundled serial prebuild     | ✅ Recommended  | App installs and normal package usage       |
| Bundled winspool prebuild   | ✅ Recommended  | Windows spooler app installs                |
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

## Contributors Welcome

Contributions are welcome for bug fixes, docs, platform checks, and printer validation notes

## Repository

[https://github.com/maxxuxx/node-printer](https://github.com/maxxuxx/node-printer)

## License

MIT
