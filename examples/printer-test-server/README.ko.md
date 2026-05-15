# Printer test server

[English](README.md)

로컬 HTTP 서버와 브라우저 UI로 현재 빌드된 `@maxxuxx/node-printer` 산출물을 실제 프린터에 테스트합니다

서버는 `packages/printer/dist/index.js`를 직접 불러오므로 API를 사용하기 전에 저장소 루트에서 빌드가 필요합니다

## 사용 스택

| 영역        | 스택                                   |
| ----------- | -------------------------------------- |
| Runtime     | Node.js 20+                            |
| Server      | Node HTTP server                       |
| UI          | Svelte, Vite                           |
| Printer API | 로컬 `@maxxuxx/node-printer` build     |
| Test target | Serial, Network, CUPS, Windows Spooler |

## 빠른 실행

의존성과 빌드 산출물을 준비합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

테스트 서버를 실행합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

브라우저에서 `http://localhost:3007`을 엽니다

## 가능 여부

| 기능                   | 상태      | 설명                                     |
| ---------------------- | --------- | ---------------------------------------- |
| Health check           | ✅ 가능   | 빌드 산출물과 capability 상태 확인       |
| Serial printer list    | ✅ 가능   | 로컬 serial transport 사용               |
| Network printer preset | ✅ 가능   | 환경 변수 preset 조회                    |
| CUPS printer list      | ✅ 가능   | macOS와 Linux에서 `lpstat`이 있으면 동작 |
| Winspool printer list  | ✅ 가능   | Windows Node에서 동작                    |
| WSL Winspool           | ❌ 불가능 | Windows Spooler를 사용할 수 없음         |

## 실행 옵션

포트는 `PORT` 환경 변수로 바꿀 수 있습니다

```powershell
$env:PORT=3010
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

네트워크 프린터 preset은 `PRINTER_NETWORK_TARGETS` 환경 변수로 지정합니다

```powershell
$env:PRINTER_NETWORK_TARGETS='192.168.0.50:9100,192.168.0.51:9100'
```

이름과 기본 선택값이 필요하면 JSON 배열을 사용합니다

```powershell
$env:PRINTER_NETWORK_TARGETS='[{"id":"store","name":"Store receipt","host":"192.168.0.50","port":9100,"isDefault":true}]'
```

## UI 기능

- 서버 health와 transport capability 확인
- Serial, Network, CUPS, Winspool 대상 목록 조회
- 영수증 본문, 인코딩, 폭, 구분선, feed, cut, 출력 매수 설정
- QR, barcode, image 예제 데이터 포함
- 인코딩 결과 hex와 bytes 확인
- 출력 결과와 오류 상세 로그 확인

## API

| Method | Path                     | 용도                                   |
| ------ | ------------------------ | -------------------------------------- |
| `GET`  | `/api/health`            | 빌드 산출물과 capability 상태 확인     |
| `GET`  | `/api/capabilities`      | transport별 사용 가능 상태 확인        |
| `GET`  | `/api/serial/ports`      | serial 포트 목록 조회                  |
| `GET`  | `/api/network/printers`  | 환경 변수로 지정한 network preset 조회 |
| `GET`  | `/api/cups/printers`     | CUPS 프린터 목록 조회                  |
| `GET`  | `/api/winspool/printers` | Windows Spooler 프린터 목록 조회       |
| `POST` | `/api/receipt/encode`    | 영수증 입력을 ESC/POS bytes로 인코딩   |
| `POST` | `/api/print`             | 선택한 target으로 영수증 출력          |

`/api/health`의 `ok`가 `false`이면 먼저 빌드를 실행합니다

## 영수증 인코딩

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

응답은 `byteLength`, `hex`, `bytes`를 포함합니다

## 출력

`COM3`와 `baudRate`는 실제 프린터 설정에 맞춥니다

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

Network 출력은 host와 port를 직접 지정합니다

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

CUPS와 Winspool도 같은 `/api/print`를 사용합니다

```text
{ "type": "cups", "printerName": "Receipt" }
{ "type": "winspool", "printerName": "Receipt" }
```

`receipt`는 builder 입력, `{ "bytes": [...] }`, `{ "hex": "..." }` 형식을 받을 수 있습니다

`copies`는 1부터 100까지 사용할 수 있습니다

## 플랫폼 주의사항

- CUPS 목록 조회는 macOS 또는 Linux에서 `lpstat` 명령이 있을 때 동작
- Winspool 목록 조회와 출력은 Windows Node에서만 동작
- WSL에서 실행하면 Winspool은 사용할 수 없고 serial 목록에 Windows COM 포트 후보가 보강됨
- Windows에서 winspool prebuild가 없으면 capability가 `prebuild_required`로 표시됨

## 문제 해결

Windows에서 실행 중인 Node 프로세스가 파일을 잡고 있으면 먼저 종료한 뒤 package script를 순서대로 실행합니다

```powershell
taskkill /F /IM node.exe
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

서버가 `unhealthy`로 표시되거나 API에서 `ERR_BUILD_REQUIRED`가 나오면 빌드를 다시 실행합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

## Contributors 환영

프린터 테스트 케이스, 하드웨어 기록, UI 수정, 플랫폼 capability 검증 기여를 환영합니다

## License

MIT
