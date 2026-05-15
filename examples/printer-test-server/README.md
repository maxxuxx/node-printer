# Printer test server

[한국어](README.ko.md)

Local HTTP server and browser UI for testing the current `@maxxuxx/node-printer` build against real printers

The server imports `packages/printer/dist/index.js` directly, so build the repository before using the API

## Tech Stack

| Area         | Stack                                  |
| ------------ | -------------------------------------- |
| Runtime      | Node.js 20+                            |
| Server       | Node HTTP server                       |
| UI           | Svelte, Vite                           |
| Printer API  | Local `@maxxuxx/node-printer` build    |
| Test targets | Serial, Network, CUPS, Windows Spooler |

## Quick Run

Prepare dependencies and build output

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

Run the test server

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

Open `http://localhost:3007` in a browser

## What Works

| Feature                 | Status       | Notes                                  |
| ----------------------- | ------------ | -------------------------------------- |
| Health check            | ✅ Available | Checks build output and capabilities   |
| Serial printer list     | ✅ Available | Uses local serial transport            |
| Network printer presets | ✅ Available | Reads environment variable presets     |
| CUPS printer list       | ✅ Available | Works on macOS and Linux with `lpstat` |
| Winspool printer list   | ✅ Available | Works on Windows Node                  |
| Winspool from WSL       | ❌ Not used  | Windows Spooler is not available there |

## Run Options

Change the port with the `PORT` environment variable

```powershell
$env:PORT=3010
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

Set network printer presets with `PRINTER_NETWORK_TARGETS`

```powershell
$env:PRINTER_NETWORK_TARGETS='192.168.0.50:9100,192.168.0.51:9100'
```

Use a JSON array when names and defaults are needed

```powershell
$env:PRINTER_NETWORK_TARGETS='[{"id":"store","name":"Store receipt","host":"192.168.0.50","port":9100,"isDefault":true}]'
```

## UI Features

- Server health and transport capability checks
- Serial, Network, CUPS, and Winspool target discovery
- Receipt lines, encoding, width, divider, feed, cut, and copies controls
- QR, barcode, and image example data
- Encoded hex and bytes preview
- Print result and detailed error logs

## API

| Method | Path                     | Purpose                                  |
| ------ | ------------------------ | ---------------------------------------- |
| `GET`  | `/api/health`            | Check build output and capability status |
| `GET`  | `/api/capabilities`      | Check transport availability             |
| `GET`  | `/api/serial/ports`      | List serial ports                        |
| `GET`  | `/api/network/printers`  | List network presets from environment    |
| `GET`  | `/api/cups/printers`     | List CUPS printers                       |
| `GET`  | `/api/winspool/printers` | List Windows Spooler printers            |
| `POST` | `/api/receipt/encode`    | Encode receipt input into ESC/POS bytes  |
| `POST` | `/api/print`             | Print a receipt to the selected target   |

If `/api/health` returns `ok: false`, build the repository first

## Encode a Receipt

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3007/api/receipt/encode -ContentType 'application/json' -Body '{
  "encoding": "cp949",
  "width": 48,
  "lines": [
    "테스트 출력",
    {
      "text": "CENTER",
      "align": "center",
      "bold": true
    },
    {
      "columns": [
        { "text": "Americano", "width": 32 },
        { "text": "4,500", "width": 16, "align": "right" }
      ]
    }
  ],
  "divider": true,
  "examples": {
    "qr": {
      "data": "https://example.com/receipt/1001",
      "size": 6,
      "errorCorrection": "m"
    },
    "barcode": {
      "data": "880123456789",
      "type": "ean13",
      "width": 3,
      "height": 80,
      "hri": "below"
    }
  },
  "feed": 3,
  "cut": true
}'
```

The response includes `byteLength`, `hex`, and `bytes`

## Print

Match `COM3` and `baudRate` to the real printer settings

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3007/api/print -ContentType 'application/json' -Body '{
  "target": {
    "type": "serial",
    "path": "COM3",
    "baudRate": 9600,
    "dataBits": 8,
    "stopBits": 1,
    "parity": "none"
  },
  "receipt": {
    "encoding": "cp949",
    "lines": ["테스트 출력", "SERIAL OK"],
    "feed": 3,
    "cut": true
  },
  "copies": 1
}'
```

Network printing uses direct `host` and `port` values

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3007/api/print -ContentType 'application/json' -Body '{
  "target": {
    "type": "network",
    "host": "192.168.0.50",
    "port": 9100
  },
  "receipt": {
    "encoding": "ascii",
    "lines": ["TEST PRINT", "NETWORK OK"],
    "feed": 3,
    "cut": true
  },
  "copies": 1
}'
```

CUPS and Winspool use the same `/api/print` endpoint

```text
{ "type": "cups", "printerName": "Receipt" }
{ "type": "winspool", "printerName": "Receipt" }
```

`receipt` accepts builder input, `{ "bytes": [...] }`, or `{ "hex": "..." }`

`copies` accepts values from 1 to 100

## Platform Notes

- CUPS printer discovery works on macOS or Linux when `lpstat` is available
- Winspool discovery and printing work only from Windows Node
- WSL cannot use Winspool and only receives enhanced Windows COM port candidates for serial
- Missing Windows winspool prebuilds are shown as `prebuild_required`

## Troubleshooting

If a running Node process is holding files on Windows, stop it before running package scripts

```powershell
taskkill /F /IM node.exe
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

If the server shows `unhealthy` or an API returns `ERR_BUILD_REQUIRED`, rebuild the repository

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

## Contributors Welcome

Contributions are welcome for printer test cases, hardware notes, UI fixes, and platform capability checks

## License

MIT
