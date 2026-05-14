# Printer test server

단일 localhost 서버로 현재 프린터 라이브러리 빌드 산출물을 테스트합니다

## 실행

먼저 패키지를 빌드합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

서버를 실행합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

빌드와 서버 실행을 이어서 하려면 다음 명령을 사용합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

기본 주소는 `http://localhost:3007` 입니다

포트 변경은 `PORT` 환경 변수를 사용합니다

```powershell
$env:PORT=3010
node examples/printer-test-server/server.mjs
```

## API

```text
GET /api/health
GET /api/capabilities
GET /api/serial/ports
GET /api/network/printers
GET /api/cups/printers
GET /api/winspool/printers
POST /api/receipt/encode
POST /api/print
```

Network preset 목록은 `PRINTER_NETWORK_TARGETS` 환경 변수로 줄 수 있습니다

```powershell
$env:PRINTER_NETWORK_TARGETS='192.168.0.50:9100,192.168.0.51:9100'
```

## 영수증 인코딩 예시

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3007/api/receipt/encode -ContentType 'application/json' -Body '{
  "encoding": "ascii",
  "width": 32,
  "lines": ["TEST PRINT", "SERIAL OK"],
  "divider": true,
  "feed": 3,
  "cut": true
}'
```

## 출력 예시

`COM3`와 `baudRate`는 실제 프린터 설정에 맞춥니다

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3007/api/print -ContentType 'application/json' -Body '{
  "target": {
    "type": "serial",
    "path": "COM3",
    "baudRate": 9600
  },
  "receipt": {
    "encoding": "ascii",
    "lines": ["TEST PRINT", "SERIAL OK"],
    "feed": 3,
    "cut": true
  }
}'
```

Network 출력은 다음처럼 테스트할 수 있습니다

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
  }
}'
```

macOS와 Linux에서는 CUPS target도 같은 `/api/print`에서 사용할 수 있습니다. Windows에서는 winspool prebuild가 포함된 상태에서 winspool target을 사용할 수 있습니다

## Windows 실행

Windows에서 실행 중인 Node 프로세스가 파일을 잡고 있으면 먼저 종료한 뒤 package script를 순서대로 실행합니다

```powershell
taskkill /F /IM node.exe
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

검증까지 같이 돌리려면 다음처럼 실행합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```
