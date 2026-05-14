# Windows Setup Guide

이 문서는 Windows와 Cursor 환경에서 이 저장소를 독립 라이브러리로 테스트할 때 자주 만나는 `pnpm`, `corepack`, `node_modules` 권한 문제를 피하는 방법을 정리한다

## 우선 권장 경로

관리자 권한 없이 테스트하려면 `pnpm`을 전역 설치하지 말고 `npm exec`로 실행한다

```powershell
cd C:\Github\node-printer

npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

`pnpm` 명령이 인식되지 않아도 위 명령은 동작한다
Windows에서 native prebuild를 만들 때는 같은 Windows PowerShell에서 설치한 `node_modules`를 사용한다
WSL에서 설치한 `node_modules`를 Windows Node로 실행하면 pnpm symlink를 못 읽어 정상 dependency도 찾지 못할 수 있다

반복 검증은 package script로 실행한다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

lint, typecheck, test까지 같이 돌리려면 다음처럼 실행한다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

build 후 localhost 테스트 서버까지 바로 실행하려면 다음처럼 실행한다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

브라우저에서 `http://localhost:3007`을 열면 된다

## pnpm이 인식되지 않을 때

다음 오류는 `pnpm`이 PATH에 없다는 뜻이다

```text
'pnpm' is not recognized as an internal or external command
```

또는 PowerShell에서 다음처럼 보일 수 있다

```text
pnpm : 'pnpm' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다
```

이 경우 전역 설치 대신 `npm exec`를 사용한다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

반복 입력을 줄이고 싶다면 관리자 권한 PowerShell에서 `corepack`을 활성화할 수 있다

```powershell
corepack enable
corepack prepare pnpm@11.1.1 --activate
```

다만 이 방식은 회사 PC, 제한된 Windows 계정, 일반 권한 Cursor 터미널에서 실패할 수 있다

## corepack enable EPERM

다음 오류는 `corepack enable`이 `C:\Program Files\nodejs` 아래에 `pnpm` 실행 파일을 만들려고 했지만 Windows 권한 때문에 실패했다는 뜻이다

```text
Internal Error: EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'
Error: EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'
```

`C:\Program Files\nodejs`는 일반 사용자 권한으로 쓰기 어려운 위치다

관리자 권한 없이 해결하려면 `corepack enable`을 쓰지 말고 다음처럼 실행한다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

`pnpm`을 전역 명령으로 쓰고 싶다면 관리자 권한 PowerShell에서 실행한다

```powershell
corepack enable
corepack prepare pnpm@11.1.1 --activate
```

그 다음 새 PowerShell을 열고 확인한다

```powershell
pnpm -v
```

## node_modules EPERM

다음 오류는 설치 중 `node_modules` 안의 파일이나 폴더를 다른 프로세스가 잡고 있어서 `pnpm`이 rename 또는 remove를 못 했다는 뜻이다

```text
EPERM: operation not permitted, rename 'C:\Github\node-printer\node_modules\prettier' -> 'C:\Github\node-printer\node_modules\.ignored_prettier'
```

또는 다음처럼 remove 경고가 먼저 나올 수 있다

```text
[WARN] Failed to remove "C:\Github\node-printer\node_modules\.pnpm\..."
```

자주 발생하는 원인은 다음과 같다

- Cursor 또는 VS Code의 TypeScript server
- ESLint extension
- 실행 중인 Node 프로세스
- Windows Defender 또는 백신 실시간 검사
- Explorer가 `node_modules` 내부를 보고 있는 경우
- 이전 설치가 중간에 실패한 뒤 파일 핸들이 남은 경우

관리자 권한 없이 먼저 이 순서로 해결한다

```powershell
cd C:\Github\node-printer

taskkill /F /IM node.exe
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

`node_modules` 삭제가 실패하면 Cursor를 완전히 종료한 뒤 새 PowerShell에서 다시 실행한다

```powershell
cd C:\Github\node-printer

taskkill /F /IM node.exe
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

그래도 실패하면 Windows Defender 또는 백신이 파일을 검사 중일 수 있으므로 잠시 기다렸다가 다시 실행한다

마지막 선택지로 관리자 권한 PowerShell에서 같은 명령을 실행한다

## Cursor에서 serialport 모듈을 찾을 수 없을 때

다음 오류는 대부분 설치가 끝까지 성공하지 않았거나 Cursor의 TypeScript server가 오래된 상태를 보고 있을 때 발생한다

```text
'serialport' 모듈 또는 해당 형식 선언을 찾을 수 없습니다.ts(2307)
```

먼저 설치를 다시 확인한다

```powershell
cd C:\Github\node-printer

npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm -r list serialport
```

`serialport`가 목록에 나오면 Cursor에서 TypeScript server를 재시작한다

1. `Ctrl + Shift + P`
2. `TypeScript: Restart TS Server`
3. 그래도 남아 있으면 `Developer: Reload Window`

`serialport`가 목록에 나오지 않으면 `node_modules EPERM` 해결 순서대로 재설치한다

## Windows Node에서 정상 dependency를 찾지 못할 때

다음 오류는 package dependency가 빠진 것이 아니라 Windows Node가 현재 `node_modules` 구조를 제대로 읽지 못하는 상태일 수 있다

```text
Error: Cannot find module 'resolve-from'
```

이 경우 package 폴더에서 `npm i`를 실행하지 않는다
이 저장소는 `workspace:*` dependency를 쓰므로 root에서 Windows PowerShell로 다시 설치한다

```powershell
cd C:\Github\node-printer
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

그 다음 package 폴더에서 다시 빌드한다

```powershell
cd C:\Github\node-printer\packages\printer-winspool
npm run build
npm run prebuild:all
```

prebuild wrapper는 package manager script로 실행한다
`node scripts\prebuild.cjs`를 직접 호출하면 `node-gyp` 경로가 빠질 수 있다

## 현재 가능한 검증 명령

설치

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

Serial port list 확인

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
node --input-type=module -e "import { listSerialPorts } from './packages/printer-serial/dist/index.js'; console.log(await listSerialPorts());"
```

프린터가 Windows COM 포트로 잡혀 있으면 `COM3`, `COM4` 같은 path가 목록에 표시된다

## 빠른 점검 순서

문제가 생기면 아래 순서로 확인한다

1. `npm exec --yes --package pnpm@11.1.1 -- pnpm install`
2. EPERM이 나면 Cursor 종료 후 `taskkill /F /IM node.exe`
3. `Remove-Item -Recurse -Force .\node_modules`
4. 다시 `npm exec --yes --package pnpm@11.1.1 -- pnpm install`
5. Cursor 재실행
6. `TypeScript: Restart TS Server`
7. `npm exec --yes --package pnpm@11.1.1 -- pnpm test`
8. `npm exec --yes --package pnpm@11.1.1 -- pnpm build`
