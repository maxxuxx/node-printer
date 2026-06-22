# Windows Setup Guide

[English](windows-setup.en.md)

Windows와 Cursor에서 이 저장소를 단독 라이브러리로 테스트할 때 자주 나오는 `pnpm`, `corepack`, `node_modules` 권한 이슈를 피하는 방법을 정리합니다

## 사용 스택


| 영역            | 스택                      |
| --------------- | ------------------------- |
| OS              | Windows                   |
| Shell           | Windows PowerShell        |
| Runtime         | Node.js 20+               |
| 패키지 매니저       | pnpm 11.1.1, Corepack     |
| 대안              | `npm exec --package pnpm` |


## 지원 여부


| 항목                       | 지원        | 설명                                          |
| -------------------------- | ----------- | --------------------------------------------- |
| `npm exec`로 pnpm 실행     | ✅ 권장      | 관리자 권한 없이 사용할 때 권장                      |
| 관리자 PowerShell Corepack | ✅ 가능      | 전역 `pnpm`이 필요할 때 선택                     |
| WSL `node_modules` 재사용  | ❌ 비권장    | Windows Node가 pnpm 심볼릭 링크를 읽지 못할 수 있음   |
| 패키지 폴더에서 `npm i`      | ❌ 비권장    | `workspace:*` 의존성이 깨질 수 있음                |


## 권장 절차

관리자 권한 없이 검증할 때는 `pnpm`을 전역 설치하지 말고 `npm exec`로 실행합니다

```powershell
cd C:\Github\node-printer

npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

`pnpm`이 PATH에 없어도 위 명령은 동작합니다

Windows에서 native prebuild를 만들 때는 같은 Windows PowerShell에서 설치한 `node_modules`를 사용합니다

WSL에서 설치한 `node_modules`를 Windows Node로 실행하면 pnpm 심볼릭 링크를 따라가지 못해 정상 의존성도 찾지 못할 수 있습니다

반복 검증은 스크립트로 묶어 실행합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

lint, typecheck, test까지 한 번에 돌릴 때는 다음을 사용합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

빌드 후 로컬 테스트 서버까지 바로 띄울 때는 다음을 사용합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

브라우저에서 `http://localhost:3007`을 엽니다

## `pnpm`이 인식되지 않을 때

다음 메시지는 `pnpm`이 PATH에 없다는 뜻입니다

```text
'pnpm' is not recognized as an internal or external command
```

PowerShell에서는 한국어 로캘로 비슷한 문구가 나올 수 있습니다

```text
pnpm : 'pnpm' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다
```

이 경우 전역 설치 대신 `npm exec`를 사용합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

입력을 줄이려면 관리자 권한 PowerShell에서 Corepack을 켤 수 있습니다

```powershell
corepack enable
corepack prepare pnpm@11.1.1 --activate
```

회사 PC, 제한된 Windows 계정, 일반 권한 Cursor 터미널에서는 실패할 수 있습니다

## `corepack enable` EPERM

다음 오류는 `corepack enable`이 `C:\Program Files\nodejs` 아래에 `pnpm` 실행 파일을 만들려다 권한 때문에 막혔다는 뜻입니다

```text
Internal Error: EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'
Error: EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'
```

`C:\Program Files\nodejs`는 일반 사용자 계정으로는 쓰기가 어렵습니다

관리자 권한 없이 해결하려면 `corepack enable` 대신 다음을 사용합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

`pnpm`을 전역 명령으로 쓰려면 관리자 권한 PowerShell에서 실행합니다

```powershell
corepack enable
corepack prepare pnpm@11.1.1 --activate
```

이후 새 PowerShell을 열고 버전을 확인합니다

```powershell
pnpm -v
```

## `node_modules` EPERM

다음 오류는 설치 중 `node_modules` 안 파일이나 폴더를 다른 프로세스가 잡고 있어 `pnpm`이 rename 또는 remove를 못 했다는 뜻입니다

```text
EPERM: operation not permitted, rename 'C:\Github\node-printer\node_modules\prettier' -> 'C:\Github\node-printer\node_modules\.ignored_prettier'
```

먼저 remove 경고가 나올 수도 있습니다

```text
[WARN] Failed to remove "C:\Github\node-printer\node_modules\.pnpm\..."
```

자주 보는 원인은 다음과 같습니다

- Cursor 또는 VS Code의 TypeScript 서버
- ESLint 확장
- 실행 중인 Node 프로세스
- Windows Defender 또는 백신 실시간 검사
- 탐색기가 `node_modules` 내부를 열어 둔 경우
- 이전 설치가 중간에 실패한 뒤 남은 파일 핸들

관리자 권한 없이 먼저 아래 순서를 시도합니다

```powershell
cd C:\Github\node-printer

taskkill /F /IM node.exe
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

`node_modules` 삭제가 실패하면 Cursor를 완전히 종료한 뒤 새 PowerShell에서 다시 시도합니다

```powershell
cd C:\Github\node-printer

taskkill /F /IM node.exe
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

그래도 실패하면 Defender나 백신이 파일을 잠깐 잡고 있을 수 있으니 잠시 뒤에 다시 실행합니다

최후의 수단으로 관리자 권한 PowerShell에서 같은 명령을 실행합니다

## Windows Node가 의존성을 찾지 못할 때

다음 오류는 패키지가 빠진 것이 아니라, Windows Node가 현재 `node_modules` 레이아웃을 제대로 읽지 못하는 경우일 수 있습니다

```text
Error: Cannot find module 'resolve-from'
```

개별 패키지 폴더에서 `npm i`를 실행하지 않습니다

이 저장소는 `workspace:*`를 쓰므로 저장소 루트에서 Windows PowerShell로 다시 설치합니다

```powershell
cd C:\Github\node-printer
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

필요하면 패키지 디렉터리에서 다시 빌드합니다

```powershell
cd C:\Github\node-printer\apps\winspool
npm run build
npm run prebuild:all
```

prebuild 래퍼는 패키지 스크립트로 실행합니다

스크립트는 Visual Studio 환경을 잡은 뒤 `cl`과 `link`를 직접 호출합니다

## 자주 쓰는 명령

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

시리얼 포트 목록

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
node --input-type=module -e "import { listSerialPorts } from './apps/printer/dist/index.js'; console.log(await listSerialPorts());"
```

프린터가 Windows COM으로 잡혀 있으면 `COM3`, `COM4` 같은 경로가 목록에 나타납니다

## 빠른 점검 순서

문제가 생기면 아래 순서로 확인합니다

1. `npm exec --yes --package pnpm@11.1.1 -- pnpm install`
2. EPERM이 나오면 Cursor를 종료하고 `taskkill /F /IM node.exe`
3. `Remove-Item -Recurse -Force .\node_modules`
4. 다시 `npm exec --yes --package pnpm@11.1.1 -- pnpm install`
5. Cursor 재실행
6. `TypeScript: Restart TS Server`
7. `npm exec --yes --package pnpm@11.1.1 -- pnpm test`
8. `npm exec --yes --package pnpm@11.1.1 -- pnpm build`

## 기여

Windows 권한 이슈, Cursor 환경 차이, native 빌드 실패 사례를 문서로 정리해 주시면 큰 도움이 됩니다

## License

MIT
