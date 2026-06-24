# Windows Setup Guide

[Korean](windows-setup.md)

This guide covers common `pnpm`, `corepack`, and `node_modules` permission issues when you test this repository as a standalone library on Windows and in Cursor

## Tech stack


| Area            | Stack                     |
| --------------- | ------------------------- |
| OS              | Windows                   |
| Shell           | Windows PowerShell        |
| Runtime         | Node.js 20+               |
| Package manager | pnpm 11.1.1, Corepack     |
| Fallback        | `npm exec --package pnpm` |


## Support matrix


| Item                         | Support        | Notes                                   |
| ---------------------------- | -------------- | --------------------------------------- |
| Run pnpm through `npm exec`  | ✅ Recommended | Works without administrator permissions |
| Administrator Corepack setup | ✅ Available   | Use when you need a global `pnpm`       |
| Reuse WSL `node_modules`     | ❌ Avoid       | Windows Node may not read pnpm symlinks |
| Run `npm i` in a package     | ❌ Avoid       | `workspace:*` dependencies can break      |


## Recommended path

When you test without administrator permissions, avoid global `pnpm` installs and use `npm exec`

```powershell
cd C:\Github\node-printer

npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

These commands work even when `pnpm` is not on `PATH`

When you build native prebuilds on Windows, use `node_modules` produced from the same Windows PowerShell environment

If `node_modules` was installed from WSL and you run Windows Node against it, pnpm symlinks may not resolve

For repeated checks, keep using the script-style commands

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

Run lint, typecheck, and test together when you need the full loop

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

After a build, start the local test server

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

Open `http://localhost:3007` in a browser

## When `pnpm` is not recognized

This message means `pnpm` is not on `PATH`

```text
'pnpm' is not recognized as an internal or external command
```

PowerShell may show a localized variant

```text
pnpm : 'pnpm' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다
```

Prefer `npm exec` over a global install

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

To reduce typing, you can enable Corepack from an administrator PowerShell

```powershell
corepack enable
corepack prepare pnpm@11.1.1 --activate
```

That path can fail on locked-down PCs, restricted accounts, or normal-permission Cursor terminals

## `corepack enable` EPERM

This error means `corepack enable` tried to create a `pnpm` shim under `C:\Program Files\nodejs`, but Windows blocked the write

```text
Internal Error: EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'
Error: EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'
```

`C:\Program Files\nodejs` is usually not writable for a normal user

Without administrator permissions, use this instead

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

If you want `pnpm` as a global command, run this in administrator PowerShell

```powershell
corepack enable
corepack prepare pnpm@11.1.1 --activate
```

Open a new PowerShell and verify

```powershell
pnpm -v
```

## `node_modules` EPERM

This error means another process is holding files inside `node_modules`, so `pnpm` cannot rename or remove them

```text
EPERM: operation not permitted, rename 'C:\Github\node-printer\node_modules\prettier' -> 'C:\Github\node-printer\node_modules\.ignored_prettier'
```

You may see remove warnings first

```text
[WARN] Failed to remove "C:\Github\node-printer\node_modules\.pnpm\..."
```

Common causes

- Cursor or VS Code TypeScript server
- ESLint extension
- Running Node processes
- Windows Defender or antivirus real-time scanning
- Explorer browsing inside `node_modules`
- Leftover handles after a failed install

Try this order first without administrator permissions

```powershell
cd C:\Github\node-printer

taskkill /F /IM node.exe
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

If deleting `node_modules` fails, fully close Cursor and retry from a new PowerShell

```powershell
cd C:\Github\node-printer

taskkill /F /IM node.exe
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

If it still fails, wait briefly and retry because Defender or antivirus may be scanning files

As a last resort, run the same commands from administrator PowerShell

## Windows Node cannot resolve a dependency

This error may mean Windows Node cannot read the current `node_modules` layout

It does not always mean a dependency is missing

```text
Error: Cannot find module 'resolve-from'
```

Do not run `npm i` inside an individual package folder

This repository uses `workspace:*` dependencies, so reinstall from the repository root in Windows PowerShell

```powershell
cd C:\Github\node-printer
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

When you need native artifacts, rebuild from the package directory

```powershell
cd C:\Github\node-printer\apps\printer
npm run build
npm run prebuild:all
npm run pack:check
```

Run the prebuild wrapper through package scripts

The script prepares the Visual Studio environment, then calls `cl` and `link` directly

## Common commands

Install

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

Lint

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
```

Typecheck

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
```

Test

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm test
```

Build

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

Serial port list

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
node --input-type=module -e "import { listSerialPorts } from './apps/printer/dist/index.js'; console.log(await listSerialPorts());"
```

If the printer is exposed as a Windows COM device, you should see paths such as `COM3` or `COM4`

## Quick checklist

When something breaks, walk through this order

1. `npm exec --yes --package pnpm@11.1.1 -- pnpm install`
2. If you see EPERM, close Cursor and run `taskkill /F /IM node.exe`
3. `Remove-Item -Recurse -Force .\node_modules`
4. Run `npm exec --yes --package pnpm@11.1.1 -- pnpm install` again
5. Reopen Cursor
6. `TypeScript: Restart TS Server`
7. `npm exec --yes --package pnpm@11.1.1 -- pnpm test`
8. `npm exec --yes --package pnpm@11.1.1 -- pnpm build`

## Contributing

Notes about Windows permissions, Cursor quirks, and native build failures are very welcome

## License

MIT
