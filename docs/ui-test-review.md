# Local UI Test Review

현재 단계에서는 `@maxxuxx/node-printer`, `@maxxuxx/node-printer-core`, `@maxxuxx/node-printer-serial` 패키지 구현을 더 건드리지 않고 별도 테스트 앱을 두는 방식이 가장 안전하다

## 결론

권장 구조는 **localhost Node 서버 + 브라우저 UI**다

```text
examples/
  serial-tester/
    server.mjs
    public/
      index.html
      app.js
      styles.css
```

이 예제 앱은 빌드된 top-level 패키지만 import한다

```js
import { createPrinter, createReceipt, listSerialPorts } from "../../packages/printer/dist/index.js"
```

이렇게 하면 실제 외부 프로젝트가 `@maxxuxx/node-printer`를 가져다 쓰는 방식과 거의 같고, printer 패키지 내부 코드는 수정하지 않아도 된다

## 왜 Web Serial API만 쓰면 안 되는가

브라우저의 Web Serial API로도 시리얼 포트를 열 수는 있다. 하지만 그 방식은 이 프로젝트의 Node 라이브러리 코드가 아니라 브라우저 API를 직접 테스트하는 것이다

우리가 확인해야 하는 것은 다음이다

- `@maxxuxx/node-printer`의 public API
- `createReceipt`로 생성한 ESC/POS bytes
- `createPrinter({ type: "serial" })`
- `serialport` 기반 open/write/drain/close 흐름
- Windows COM 포트 에러 처리

따라서 브라우저 단독 Web Serial API보다 Node localhost 서버가 더 적합하다

## 권장 API

localhost 서버는 최소 API만 제공한다

```text
GET  /api/ports
POST /api/print
```

`GET /api/ports`는 `listSerialPorts()` 결과를 반환한다

`POST /api/print`는 다음 JSON을 받는다

```json
{
  "path": "COM3",
  "baudRate": 9600,
  "lines": ["TEST PRINT", "SERIAL OK"],
  "cut": true
}
```

서버는 이 요청을 받아 `createReceipt`와 `createPrinter`를 호출한다

## UI에서 필요한 기능

첫 화면은 테스트 도구처럼 단순해야 한다

- serial port 새로고침
- port 선택
- baudRate 선택 또는 입력
- 테스트 문구 입력
- print 버튼
- 성공/실패 로그 표시
- raw error code와 `PrinterError.code` 표시

현재 겪은 `Unknown error code 21` 같은 원인 분석을 위해 error detail은 접지 말고 바로 보여주는 편이 좋다

## printer 패키지 변경 여부

이 UI 테스트 앱을 위해 printer 패키지를 수정할 필요는 없다

필요한 조건은 이미 갖춰져 있다

- `@maxxuxx/node-printer` top-level entry
- `createReceipt`
- `createPrinter`
- `listSerialPorts`
- serial target 지원

추가로 필요한 것은 예제 앱뿐이다

## 구현 순서

1. `examples/serial-tester/server.mjs` 추가
2. 정적 HTML/CSS/JS 추가
3. `GET /api/ports` 구현
4. `POST /api/print` 구현
5. `npm exec --yes --package pnpm@11.1.1 -- pnpm build` 후 서버 실행
6. 브라우저에서 `http://localhost:3007` 접속

## 실행 명령 초안

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
node .\examples\serial-tester\server.mjs
```

브라우저에서는 다음 주소를 연다

```text
http://localhost:3007
```

## 보류할 것

지금 단계에서는 아래 작업을 미룬다

- Electron wrapper
- React/Vite 앱 구성
- shadcn/ui 같은 UI 프레임워크 도입
- printer package API 변경
- Web Serial API 전환

먼저 zero-dependency에 가까운 localhost 테스트 UI를 만든 뒤, 실제 테스트 흐름이 안정되면 더 좋은 UI로 옮기는 것이 낫다
