# API usage

This document summarizes the public API and usage examples available from the `@maxxuxx/node-printer` root export

Individual transport factory functions from internal source aliases such as `#serial`, `#network`, `#cups`, and `#winspool` are not public npm import paths, so they are not shown as direct import examples

## Public API summary

| API                                | Purpose                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `createReceipt(options?)`          | Builds ESC/POS receipt bytes with a chainable builder             |
| `print(target, data, options?)`    | Prints `Uint8Array` data to serial, network, CUPS, or Winspool    |
| `listPrinters(type, options?)`     | Lists serial, usb, or network printers                            |
| `getStatus(target, options?)`      | Reads printer status such as online, paper out, cover open, error |
| `getPaperInfo(target, options?)`   | Resolves paper width and receipt `columns`                        |
| `resolveColumns(target, options?)` | Returns only the resolved `columns` value                         |
| `configurePrinterSettings(config)` | Configures the saved printer JSON file path                       |
| `savePrinter(input)`               | Saves a printer target and receipt profile                        |
| `listSavedPrinters()`              | Lists all saved printers                                          |
| `getSavedPrinter(id)`              | Reads one saved printer                                           |
| `removeSavedPrinter(id)`           | Removes one saved printer                                         |
| `clearSavedPrinters()`             | Removes all saved printers                                        |
| `isPrinterError(error)`            | Checks whether an error is a `PrinterError`                       |
| `PrinterError`                     | Shared package error class                                        |
| `PRINTER_ERROR_CODES`              | Error code list used by the package                               |

## Basic print flow

Create receipt data with `createReceipt`, then pass it to `print` with a printer target

```ts
import { createReceipt, print } from "@maxxuxx/node-printer";

const receipt = createReceipt({ columns: 42, encoding: "cp949" })
  .initialize()
  .align("center")
  .bold()
  .text("Store")
  .bold(false)
  .divider()
  .leftRight("Americano", "4,500")
  .feed(3)
  .cut()
  .encode();

const result = await print(
  {
    type: "network",
    host: "192.168.0.50",
    port: 9100
  },
  receipt
);

console.log(result.ok, result.bytesWritten, result.durationMs);
```

`print` returns a `PrintResult` on success

```ts
interface PrintResult {
  ok: true;
  target: PrinterTarget;
  jobId?: string | number;
  bytesWritten?: number;
  durationMs: number;
}
```

## Printer target

The first argument to `print` is a target object for one transport

### Network

Sends RAW data to a TCP 9100 style network printer

```ts
await print(
  {
    type: "network",
    host: "192.168.0.50",
    port: 9100,
    timeoutMs: 5000,
    chunkSize: 16 * 1024,
    retry: {
      retries: 2,
      minDelayMs: 100,
      maxDelayMs: 1000,
      factor: 2
    }
  },
  receipt
);
```

Defaults are `port: 9100`, `timeoutMs: 5000`, `chunkSize: 16384`, and `retry.retries: 0`

### Serial

Prints to a COM port or tty serial printer

```ts
await print(
  {
    type: "serial",
    path: "COM3",
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: false,
    timeoutMs: 5000
  },
  receipt
);
```

Defaults are `baudRate: 9600`, `dataBits: 8`, `stopBits: 1`, `parity: "none"`, `flowControl: false`, and `timeoutMs: 5000`

`flowControl` can be `true`, `"rtscts"`, `"xon"`, `"xoff"`, or `false`

### CUPS

Sends RAW output through `lp` or `lpr` for macOS and Linux CUPS printers

```ts
await print(
  {
    type: "cups",
    printerName: "Receipt",
    documentName: "Receipt",
    timeoutMs: 5000
  },
  receipt
);
```

Default is `timeoutMs: 5000`

### Winspool

Uses the Windows Spooler RAW print path

```ts
await print(
  {
    type: "winspool",
    printerName: "Receipt",
    documentName: "Receipt"
  },
  receipt
);
```

The `winspool` target is available only on Windows

## listPrinters

`listPrinters(type, options?)` returns an array of printer discovery results

```ts
import { listPrinters } from "@maxxuxx/node-printer";

const serialPorts = await listPrinters("serial");
const usbPrinters = await listPrinters("usb");
const networkPrinters = await listPrinters("network");
```

| type         | Result                                           | Behavior                                               |
| ------------ | ------------------------------------------------ | ------------------------------------------------------ |
| `"serial"`   | `SerialPortInfo[]`                               | Lists serialport devices                               |
| `"usb"`      | `CupsPrinterInfo[]` or `WinspoolPrinterInfo[]`   | Uses Winspool on Windows and CUPS on macOS or Linux    |
| `"network"`  | `NetworkPrinterInfo[]`                           | Scans local IPv4 ranges for open 9100 ports            |
| `"cups"`     | `CupsPrinterInfo[]`                              | Lists CUPS printers directly                           |
| `"winspool"` | `WinspoolPrinterInfo[]`                          | Lists Windows Spooler printers directly                |

`"usb"` is the recommended value when an app wants one name for OS-specific printer discovery

Use `"cups"` and `"winspool"` only when the app needs to choose an OS path directly

Network discovery can be narrowed with `PrinterMethodOptions.network`

```ts
const printers = await listPrinters("network", {
  network: {
    discoveryHosts: ["192.168.0.50", "192.168.0.51"],
    discoveryPort: 9100,
    discoveryTimeoutMs: 250,
    discoveryConcurrency: 8
  }
});
```

## getStatus

`getStatus(target, options?)` returns a `PrinterStatus`

The source depends on the target. Serial and network targets use ESC/POS real-time status commands (`DLE EOT`), while winspool and cups read the OS spooler state without sending ESC/POS

```ts
import { getStatus } from "@maxxuxx/node-printer";

const status = await getStatus({ type: "winspool", printerName: "Receipt" });

console.log(status.online, status.paperOut, status.coverOpen);
```

```ts
interface PrinterStatus {
  target: PrinterTarget;
  source: "escpos" | "winspool" | "cups";
  online?: boolean;
  paperOut?: boolean;
  paperNearEnd?: boolean;
  coverOpen?: boolean;
  paperJam?: boolean;
  drawerOpen?: boolean;
  error?: boolean;
  paused?: boolean;
  busy?: boolean;
  raw?: Record<string, number | string | boolean>;
}
```

Each boolean is left `undefined` when the source cannot report that field, so `undefined` and `false` are distinguished

| target              | source     | Behavior                                                       |
| ------------------- | ---------- | -------------------------------------------------------------- |
| `serial`/`network`  | `"escpos"` | Sends `DLE EOT 1~4` and decodes the response bytes             |
| `winspool`          | `"winspool"` | Decodes the Windows Spooler `PRINTER_STATUS` bit flags       |
| `cups`              | `"cups"`   | Parses `lpstat -l -p` state text and `printer-state-reasons`   |

Serial and network status requires a printer that supports ESC/POS real-time status, and throws a timeout error when there is no response

## getPaperInfo

`getPaperInfo(target, options?)` resolves the printable paper width and the receipt `columns` to use

```ts
import { getPaperInfo, createReceipt } from "@maxxuxx/node-printer";

const info = await getPaperInfo({ type: "winspool", printerName: "Receipt" });

const receipt = createReceipt({ columns: info.columns, encoding: "cp949" })
  .text("Width-aware print")
  .cut()
  .encode();
```

```ts
interface PaperInfo {
  target: PrinterTarget;
  source: "system" | "manual" | "default";
  font: "a" | "b";
  columns: number;
  widthMm?: number;
  printableWidthDots?: number;
  dpi?: number;
}
```

`columns` is resolved in this priority order

1. Explicit `options.columns` (source `"manual"`)
2. System driver width when `useSystemWidth` is enabled, for `winspool` and `cups` only (source `"system"`)
3. Manual `options.paper` preset or measurement (source `"manual"`)
4. Default `42` (source `"default"`)

| option           | Default | Meaning                                                          |
| ---------------- | ------- | ---------------------------------------------------------------- |
| `useSystemWidth` | `true`  | Reads the OS driver width for `winspool` and `cups`              |
| `font`           | `"a"`   | Font width basis for the dots-to-columns calculation             |
| `paper`          | -       | Manual `"58mm"`/`"80mm"` preset or `{ widthMm, printableWidthDots, dpi }` |
| `columns`        | -       | Forces a fixed `columns` value and skips all detection           |

Serial and network direct connections cannot read a system width, so they fall back to `paper` or the default

`resolveColumns(target, options?)` is a convenience wrapper that returns only `columns`

```ts
import { resolveColumns, createReceipt } from "@maxxuxx/node-printer";

const columns = await resolveColumns(
  { type: "winspool", printerName: "Receipt" },
  { font: "a" }
);

const receipt = createReceipt({ columns }).text("Sized").cut().encode();
```

## createReceipt

`createReceipt(options?)` returns a `ReceiptBuilder`

```ts
const receipt = createReceipt({
  columns: 42,
  encoding: "cp949"
});
```

| option     | Default  | Meaning                                                          |
| ---------- | -------- | ---------------------------------------------------------------- |
| `columns`  | `42`     | Character width for one line                                     |
| `encoding` | `"utf8"` | Encoding used to convert receipt text into bytes                 |
| `paper`    | -        | `"58mm"`/`"80mm"` preset that derives `columns` when `columns` is omitted |
| `font`     | `"a"`    | Font width basis used when deriving `columns` from `paper`        |

For serial or IP direct connections that cannot read a system width, declare the width manually with `paper`

```ts
const receipt = createReceipt({ paper: "80mm", encoding: "cp949" }); // columns is derived as 48
```

For winspool or cups system printers, resolve `columns` from the driver with `getPaperInfo` and pass it in

See [Encoding guide](encoding.md) for supported values, common country usage, and ESC/POS code page notes

`encoding(value)` decides which character set is used for subsequent text-to-byte conversion

`codePage(page)` is not required for normal text output and should be used only when the printer ESC/POS code page must be changed directly

For printers that require code page changes, call methods in the order `initialize()`, `codePage(page)`, and `encoding(value)`

```ts
const receipt = createReceipt({ columns: 42 })
  .initialize()
  .codePage(21)
  .encoding("cp949")
  .text("Store")
  .encode();
```

### Text and line layout

| Method                             | Purpose                                            |
| ---------------------------------- | -------------------------------------------------- |
| `initialize()`                     | Adds the printer initialize command                |
| `text(value, options?)`            | Prints text with a newline by default              |
| `line(value, options?)`            | Prints text with a newline                         |
| `row(columns)`                     | Prints fixed-width columns on one line             |
| `divider(options?)`                | Prints a divider line                              |
| `blank(lines?)`                    | Adds blank lines                                   |
| `wrap(value, options?)`            | Wraps text to a configured width                   |
| `truncate(value, options?)`        | Truncates text beyond a configured width           |
| `leftRight(left, right, options?)` | Places left and right text on one line             |
| `keyValue(label, value, options?)` | Places label and value on opposite sides           |
| `columns(columns, options?)`       | Prints multiple columns with `wrap` support        |
| `table(options)`                   | Prints a header and row based table                |

```ts
const receipt = createReceipt({ columns: 42, encoding: "cp949" })
  .title("STORE")
  .divider()
  .leftRight("Subtotal", "12,000")
  .keyValue("Order", "A12")
  .columns([
    { text: "Americano", width: 30 },
    { text: "4,500", width: 12, align: "right" }
  ])
  .wrap("Long descriptions wrap across multiple lines at the configured width", {
    width: 42,
    indent: 2
  })
  .encode();
```

### Amount and order rows

| Method                    | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `amount(value, options?)` | Formats a number with locale, currency, and unit options       |
| `items(items, options?)`  | Prints multiple product name, quantity, and amount rows        |
| `totals(rows, options?)`  | Prints multiple total rows                                     |

```ts
const receipt = createReceipt({ columns: 42, encoding: "cp949" })
  .items(
    [
      { name: "Americano", quantity: 2, amount: 9000 },
      { name: "Latte", quantity: 1, amount: 5000 }
    ],
    {
      locale: "ko-KR",
      currency: "KRW"
    }
  )
  .divider()
  .totals([{ label: "Total", amount: 14000, bold: true }], {
    locale: "ko-KR",
    currency: "KRW"
  })
  .encode();
```

### Style

| Method                     | Purpose                                             |
| -------------------------- | --------------------------------------------------- |
| `title(value, options?)`   | Prints a centered title                             |
| `section(value, options?)` | Prints a section title or divider                   |
| `style(options, build)`    | Temporarily applies styles and then restores them   |
| `align(value)`             | Sets `left`, `center`, or `right` alignment         |
| `bold(enabled?)`           | Toggles bold text                                   |
| `underline(enabled?)`      | Toggles underline text                              |
| `font(value)`              | Selects font `a` or `b`                             |
| `invert(enabled?)`         | Toggles black and white inversion                   |
| `size(width, height)`      | Sets character scaling                              |

```ts
const receipt = createReceipt()
  .style({ align: "center", bold: true }, (styled) => {
    styled.text("STORE");
  })
  .text("Normal text")
  .encode();
```

`style` changes the style only inside the callback and restores the previous style after the callback

### Printer control and raw data

| Method                      | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `codePage(page, encoding?)` | Adds an ESC/POS code page command            |
| `encoding(value)`           | Changes encoding for subsequent text         |
| `cashDrawer(options?)`      | Adds a cash drawer kick command              |
| `beep(count?, duration?)`   | Adds a buzzer command                        |
| `feed(lines?)`              | Adds paper feed commands                     |
| `cut(mode?)`                | Adds a `full` or `partial` cut command       |
| `qr(value, options?)`       | Adds a QR code command                       |
| `barcode(value, options?)`  | Adds a barcode command                       |
| `image(input, options?)`    | Adds a raster image command                  |
| `raw(bytes)`                | Adds custom ESC/POS bytes                    |

```ts
const receipt = createReceipt({ encoding: "cp949" })
  .qr("https://example.com", {
    size: 6,
    errorCorrection: "q"
  })
  .barcode("8801234567890", {
    type: "ean13",
    width: 3,
    height: 80,
    hri: "below"
  })
  .feed(3)
  .cut("full")
  .encode();
```

`qr`, `barcode`, and `image` print default fallback text when command generation fails

Pass `fallbackText: false` to throw the error instead

```ts
createReceipt().qr("", { fallbackText: false }).encode();
```

### Result conversion

| Method      | Return value                                      |
| ----------- | ------------------------------------------------- |
| `preview()` | Text preview accumulated in the receipt builder   |
| `toHex()`   | Final bytes converted to a hex string             |
| `encode()`  | Printable `Uint8Array`                            |

`preview` is for text inspection and does not represent every ESC/POS command

## Saved printer settings API

Call `configurePrinterSettings` with a JSON file path before using saved printer APIs

```ts
import {
  configurePrinterSettings,
  savePrinter,
  listSavedPrinters,
  getSavedPrinter,
  print,
  createReceipt
} from "@maxxuxx/node-printer";

configurePrinterSettings({
  filePath: "C:/Users/me/AppData/Roaming/my-app/printers.json"
});

const saved = await savePrinter({
  name: "Counter",
  type: "serial",
  path: "COM3",
  baudRate: 9600,
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});

const receipt = createReceipt(saved.receipt)
  .initialize()
  .text("Saved printer print")
  .cut()
  .encode();

await print(saved.target, receipt);

const printers = await listSavedPrinters();
const first = await getSavedPrinter(saved.id);
```

If the settings file does not exist, the API starts with an empty list and creates the required directory when saving

### savePrinter input

USB saves are mapped to the OS-specific target

On Windows they are saved as a `winspool` target, and on macOS or Linux they are saved as a `cups` target

```ts
await savePrinter({
  name: "Counter",
  type: "usb",
  printerName: "Receipt",
  documentName: "Receipt",
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});
```

Serial saves accept the `SerialPrinterTarget` fields except `type`

```ts
await savePrinter({
  name: "Counter serial",
  type: "serial",
  path: "COM3",
  baudRate: 9600,
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});
```

Network saves accept the `NetworkPrinterTarget` fields except `type`

```ts
await savePrinter({
  name: "Kitchen",
  type: "network",
  host: "192.168.0.50",
  port: 9100,
  receipt: {
    encoding: "cp949",
    columns: 42
  }
});
```

### Saved API methods

| Method                                   | Return                               | Behavior                           |
| ---------------------------------------- | ------------------------------------ | ---------------------------------- |
| `configurePrinterSettings({ filePath })` | `void`                               | Configures the saved JSON path     |
| `savePrinter(input)`                     | `Promise<SavedPrinter>`              | Saves printer and receipt profile  |
| `listSavedPrinters()`                    | `Promise<SavedPrinter[]>`            | Lists saved printers               |
| `getSavedPrinter(id)`                    | `Promise<SavedPrinter \| undefined>` | Reads one saved printer by id      |
| `removeSavedPrinter(id)`                 | `Promise<void>`                      | Removes one saved printer by id    |
| `clearSavedPrinters()`                   | `Promise<void>`                      | Removes all saved printers         |

## PrinterMethodOptions

Most app code does not need to pass `options`

Transport dependencies can be injected for tests or Electron environment control

```ts
await listPrinters("serial", {
  serial: {
    SerialPort: FakeSerialPort
  }
});

await print(
  {
    type: "network",
    host: "192.168.0.50"
  },
  receipt,
  {
    network: {
      createConnection: createFakeConnection
    }
  }
);
```

| option     | Purpose                                                |
| ---------- | ------------------------------------------------------ |
| `serial`   | Injects a serialport constructor and list function     |
| `network`  | Injects TCP connection, discovery, probe, and sleep    |
| `cups`     | Injects CUPS command runner, platform, print command   |
| `winspool` | Injects a Winspool native binding implementation       |

## Error handling

Errors thrown directly by the package are `PrinterError` and can be narrowed with `isPrinterError`

```ts
import { isPrinterError, print } from "@maxxuxx/node-printer";

try {
  await print(
    {
      type: "network",
      host: "192.168.0.50"
    },
    receipt
  );
} catch (error) {
  if (isPrinterError(error)) {
    console.error(error.code, error.retryable, error.message);
  } else {
    throw error;
  }
}
```

Main error codes are listed below

| code                                  | Meaning                                           |
| ------------------------------------- | ------------------------------------------------- |
| `ERR_INVALID_TARGET`                  | Target value is missing or invalid                |
| `ERR_UNSUPPORTED_PLATFORM`            | Transport is not supported on the current OS      |
| `ERR_PRINTER_NOT_FOUND`               | Saved printer id was not found                    |
| `ERR_CONNECTION_TIMEOUT`              | Network connection timed out                      |
| `ERR_WRITE_TIMEOUT`                   | Network write timed out                           |
| `ERR_CONNECTION_REFUSED`              | Network connection was refused                    |
| `ERR_HOST_NOT_FOUND`                  | Host lookup failed                                |
| `ERR_NETWORK_UNREACHABLE`             | Network is unreachable                            |
| `ERR_SERIAL_TIMEOUT`                  | Serial operation timed out                        |
| `ERR_SERIAL_OPEN_FAILED`              | Serial port open failed                           |
| `ERR_SERIAL_WRITE_FAILED`             | Serial write or drain failed                      |
| `ERR_SERIAL_CLOSE_FAILED`             | Serial port close failed                          |
| `ERR_WINSPOOL_FAILED`                 | Winspool operation failed                         |
| `ERR_CUPS_COMMAND_FAILED`             | CUPS command failed                               |
| `ERR_ENCODING_FAILED`                 | Receipt encoding or byte range validation failed  |
| `ERR_NATIVE_MODULE_UNAVAILABLE`       | Native prebuild could not be loaded               |
| `ERR_PRINTER_SETTINGS_NOT_CONFIGURED` | Saved settings file path is not configured        |
| `ERR_INVALID_PRINTER_SETTINGS`        | Saved printer input is invalid                    |

## Type import example

Use type imports from the root package when an app needs explicit target and result types

```ts
import {
  createReceipt,
  print,
  type NetworkPrinterTarget,
  type PrintResult,
  type ReceiptEncoding
} from "@maxxuxx/node-printer";

const encoding: ReceiptEncoding = "cp949";

const target: NetworkPrinterTarget = {
  type: "network",
  host: "192.168.0.50"
};

const receipt = createReceipt({ encoding }).text("Typed print").cut().encode();

const result: PrintResult = await print(target, receipt);
```
