# node-printer

크로스 플랫폼 ESC/POS 영수증 프린터 라이브러리 모노레포

Node.js와 Electron에서 시리얼, 네트워크(TCP 9100), CUPS, Windows Spooler를 동일한 `Printer` 인터페이스로 다루는 것이 목표입니다

## 패키지

| 패키지                           | 용도                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| `@node-printer/printer`          | 통합 entry point. `createPrinter`로 transport를 동적 로딩   |
| `@node-printer/printer-core`     | 공통 타입, 에러 모델, ESC/POS receipt builder, CP949 인코딩 |
| `@node-printer/printer-serial`   | `serialport` 기반 COM/tty 출력 (native는 lazy load)         |
| `@node-printer/printer-network`  | TCP 9100, timeout, retry, chunked write, backpressure       |
| `@node-printer/printer-cups`     | macOS와 Linux의 `lp`/`lpr`/`lpstat` 기반 RAW 출력           |
| `@node-printer/printer-winspool` | Windows Spooler RAW 출력 N-API 바인딩 (prebuild only)       |

> 패키지 scope `@node-printer/`는 임시값입니다. 실제 npm publish 전에 사용자가 소유한 npm scope로 일괄 치환하세요

## 플랫폼 지원

| Platform | Arch      | Core | Serial | Network | CUPS   | Winspool |
| -------- | --------- | ---- | ------ | ------- | ------ | -------- |
| Windows  | ia32      | 지원 | 지원   | 지원    | 미지원 | 지원     |
| Windows  | x64       | 지원 | 지원   | 지원    | 미지원 | 지원     |
| Windows  | arm64     | 지원 | 지원   | 지원    | 미지원 | 지원     |
| macOS    | x64       | 지원 | 지원   | 지원    | 지원   | 미지원   |
| macOS    | arm64     | 지원 | 지원   | 지원    | 지원   | 미지원   |
| Linux    | x64/arm64 | 지원 | 지원   | 지원    | 지원   | 미지원   |

`core`, `network`, `cups`는 native addon 없이 동작합니다. `serial`은 `serialport` prebuild를 lazy load하므로 일반적으로 MSBuild가 필요 없습니다. `winspool`은 Windows 전용 N-API 바인딩으로 격리하고 `ia32`, `x64`, `arm64` prebuild만 사용합니다

`@node-printer/printer` 통합 패키지는 transport 모듈을 **동적 import**로 로딩합니다. 즉 macOS에서 `import { createPrinter } from "@node-printer/printer"`만 해도 winspool native나 serialport native를 미리 끌어오지 않습니다

## 외부 프로젝트에서 설치

```bash
npm install @node-printer/printer
# 또는
pnpm add @node-printer/printer
```

비-Windows 환경에서는 winspool native 빌드를 시도하지 않으므로 설치가 실패하지 않습니다. Windows에서는 패키지에 포함된 prebuild만 로드하며, prebuild가 없으면 `ERR_NATIVE_MODULE_UNAVAILABLE` 오류로 중단합니다

## 기본 사용 예

```ts
import { createPrinter, createReceipt } from "@node-printer/printer";

const receipt = createReceipt({ encoding: "cp949" })
  .initialize()
  .text("테스트 출력")
  .divider()
  .text("SERIAL OK")
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

`type`을 `serial`, `network`, `cups`, `winspool`로 바꿔 같은 `print(receipt)` 흐름을 그대로 씁니다. `winspool`은 Windows에서만 동작하고, 다른 OS에서 호출하면 `ERR_UNSUPPORTED_PLATFORM`을 던집니다

## 개발 환경 (모노레포 빌드)

Windows에서 pnpm 전역 설치나 corepack이 막히는 경우를 대비해 `npm exec` 경로를 함께 안내합니다
Windows에서 prebuild를 만들 때는 Windows PowerShell에서 설치한 `node_modules`를 사용합니다
WSL에서 만든 `node_modules`는 Windows Node가 pnpm symlink를 제대로 읽지 못할 수 있습니다

```powershell
cd C:\Github\node-printer

npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm lint
npm exec --yes --package pnpm@11.1.1 -- pnpm typecheck
npm exec --yes --package pnpm@11.1.1 -- pnpm test
npm exec --yes --package pnpm@11.1.1 -- pnpm build
```

PowerShell에서 `Cannot find module 'resolve-from'`처럼 정상 의존성을 찾지 못하면 root에서 `node_modules`를 지우고 Windows PowerShell로 다시 설치합니다

```powershell
cd C:\Github\node-printer
Remove-Item -Recurse -Force .\node_modules
npm exec --yes --package pnpm@11.1.1 -- pnpm install
```

자세한 Windows 문제 해결은 [docs/windows-setup.md](docs/windows-setup.md)를 참고합니다

## Winspool prebuild 생성

저장소를 내려받아 winspool prebuild를 직접 만들려면 Windows에서 Visual Studio Build Tools C++ workload와 Python 3을 준비한 뒤 실행합니다
prebuild 스크립트는 `vswhere`로 필요한 C++ 컴포넌트가 설치된 Visual Studio 경로를 찾아 `node-gyp`에 직접 전달합니다

### 사전 설치

GUI로 설치하려면 다음 링크에서 먼저 내려받습니다

- Python 3는 [Python Windows downloads](https://www.python.org/downloads/windows/)에서 설치
- Visual Studio Build Tools는 [Visual Studio downloads](https://visualstudio.microsoft.com/downloads/)의 `Tools for Visual Studio` 섹션에서 `Build Tools for Visual Studio` 설치
- 설치 구성 요소 이름은 [Visual Studio Build Tools component IDs](https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools?view=visualstudio)에서 확인

관리자 PowerShell에서 winget으로 새 Build Tools를 설치하려면 다음을 실행합니다

```powershell
winget install --id Python.Python.3.13 --exact
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended"
```

`Microsoft.VisualStudio.BuildTools`는 winget에서 최신 Visual Studio BuildTools 2026 패키지를 가리킬 수 있고, Visual Studio Community 2026이 설치된 환경에서는 이미 설치된 패키지로 오인될 수 있습니다
Windows prebuild 용도는 `Microsoft.VisualStudio.2022.BuildTools`를 명시합니다

이미 Build Tools가 설치된 상태에서 위 `winget install`을 다시 실행하면 컴포넌트가 추가되지 않을 수 있습니다
이 경우 `npm run prebuild:arm64`가 출력하는 `setup.exe modify --installPath ...` 명령으로 기존 설치를 수정합니다

이미 Visual Studio가 설치되어 있어도 별도 Build Tools를 추가 설치할 수 있습니다. prebuild 스크립트는 필요한 컴포넌트가 있는 설치 경로를 자동 선택합니다
기존 Visual Studio 설치에 ARM64 도구를 직접 추가하려면 다음을 실행합니다

```powershell
$setup = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\setup.exe"

& $setup modify `
  --installPath "C:\Program Files\Microsoft Visual Studio\18\Community" `
  --add Microsoft.VisualStudio.Workload.VCTools `
  --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 `
  --add Microsoft.VisualStudio.Component.Windows11SDK.26100 `
  --includeRecommended `
  --passive `
  --norestart
```

설치가 끝나면 새 PowerShell을 열고 Python과 MSBuild가 보이는지 확인합니다

```powershell
python --version
where python
where msbuild
```

ARM64 도구가 설치된 Visual Studio 경로는 다음으로 확인합니다

```powershell
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
& $vswhere -all -products * -requires Microsoft.VisualStudio.Component.VC.Tools.ARM64 -property installationPath
```

### prebuild 실행

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm install
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool build
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool prebuild:x64
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool prebuild:ia32
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool prebuild:arm64
```

root에서 `pnpm install`을 먼저 실행한 뒤에는 `packages/printer-winspool` 폴더에서 `npm run build`와 `npm run prebuild:x64`도 사용할 수 있습니다
package 폴더에서 `npm i`는 실행하지 않습니다. 이 저장소는 `workspace:*` dependency를 쓰므로 root에서 `pnpm install`로 설치합니다
prebuild wrapper는 `npm run prebuild:*` 또는 `pnpm --filter ... prebuild:*`로 실행합니다. `node scripts/prebuild.cjs`를 직접 호출하면 package manager가 설정하는 `node-gyp` 경로가 빠질 수 있습니다
`prebuild:x64`, `prebuild:ia32`, `prebuild:arm64`는 각각 필요한 Visual Studio 컴포넌트를 가진 설치 경로를 찾아 사용합니다
Build Tools와 Community가 모두 조건을 만족하면 Build Tools를 먼저 사용합니다
실행 로그에는 `Using Visual Studio: ...` 형태로 node-gyp에 넘긴 설치 경로가 출력됩니다

한 번에 생성하려면 다음 명령을 사용합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool prebuild:all
```

이 저장소는 npm 설치 중 source build fallback을 실행하지 않습니다. prebuild를 만들려면 저장소를 받은 뒤 위 명령을 직접 실행합니다

### Prebuild 구조

`@node-printer/printer-winspool`은 npm 패키지 안에 Windows prebuild를 포함합니다

```text
packages/printer-winspool/prebuilds/
  win32-x64/
    *.node
  win32-ia32/
    *.node
  win32-arm64/
    *.node
```

CI에서 자동으로 세 아키텍처 모두 생성되어 artifact로 업로드됩니다. publish 전에 다음으로 직접 만들 수도 있습니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool prebuild:x64
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool prebuild:ia32
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool prebuild:arm64
```

prebuild target은 패키지 최소 지원 버전인 Node 20.0.0으로 고정합니다. `prebuildify --napi` 기본값은 최신 Node target을 선택할 수 있고, 최신 Node가 Windows ia32 `node.lib`를 제공하지 않으면 prebuild 생성이 실패할 수 있습니다

`MSB8020` 오류로 `v145` 또는 ARM64 build tools를 찾지 못한다고 나오면, 현재 node-gyp가 필요한 컴포넌트가 없는 Visual Studio를 고른 상태입니다
최신 prebuild 스크립트는 `vswhere` 결과를 `npm_config_msvs_version`으로 넘겨 이 문제를 피합니다
그래도 실패하면 위 `vswhere` 확인 명령이 빈 값을 반환하는지 먼저 확인합니다
오류 경로가 여전히 원하지 않는 Visual Studio 설치를 가리키면 `prebuildify`를 직접 실행하지 말고 `npm run prebuild:arm64`로 실행했는지 확인합니다

배포 전 package 포함 파일은 다음 명령으로 확인합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool prebuild:check
npm exec --yes --package pnpm@11.1.1 -- pnpm --filter @node-printer/printer-winspool pack:check
```

`prebuilds/**/*.node`는 포함하고 `build/`, `*.pdb`, `*.iobj`, `*.ipdb`는 포함하지 않습니다

## npm 배포 전 확인

배포 전에는 최소한 다음을 확인합니다

1. `@node-printer/` scope를 실제 소유 scope로 교체
2. `homepage`, `repository`, `bugs`, `license`, `version` 확인
3. Windows에서 `prebuild:all` 실행 후 `prebuild:check` 통과 확인
4. `npm exec --yes --package pnpm@11.1.1 -- pnpm release:check` 통과 확인
5. `pack:check` 출력에서 `dist/**`와 `prebuilds/win32-{x64,ia32,arm64}/*.node` 포함 확인
6. `pack:check` 출력에서 `native/`, `binding.gyp`, `scripts/`, `build/`, `*.pdb`, `*.iobj`, `*.ipdb` 제외 확인
7. workspace dependency가 publish 전에 실제 버전으로 치환되는지 `pnpm publish -r --dry-run`으로 확인
8. 수동 publish를 한다면 `printer-core`, transport 패키지들, `printer` 순서로 배포

### Electron 앱

Electron 앱에서는 winspool을 main process에서만 import하고, packaged app에서는 native 파일을 unpack 대상에 포함합니다

```json
{
  "asarUnpack": ["**/node_modules/@node-printer/printer-winspool/prebuilds/**/*.node"]
}
```

N-API 기반이라 Electron major version마다 rebuild가 필요하지 않습니다

## 테스트 서버 실행

빌드 후 localhost 테스트 UI를 실행합니다

```powershell
npm exec --yes --package pnpm@11.1.1 -- pnpm build
npm exec --yes --package pnpm@11.1.1 -- pnpm test-server
```

기본 주소는 `http://localhost:3007` 입니다

테스트 서버는 빌드된 `packages/printer/dist/index.js`를 사용합니다. 외부에서 패키지를 import해 쓰는 흐름과 최대한 가깝게 검증하기 위한 개발용 도구입니다

## 출력 옵션 상세

### 네트워크 retry

```ts
const printer = createPrinter({
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
});
```

`ENOTFOUND`/`EHOSTUNREACH`는 retryable=false로 분류되어 무의미한 재시도가 발생하지 않습니다

### 직렬 timeout

```ts
const printer = createPrinter({
  type: "serial",
  path: "COM3",
  baudRate: 19200,
  timeoutMs: 5000,
  flowControl: "rtscts"
});
```

### CUPS 명령 선택

```ts
const printer = createCupsPrinter(
  { type: "cups", printerName: "Receipt" },
  { printCommand: "lpr" }
);
```

## 에러 코드

`PrinterError`는 다음 `code`를 반환합니다

```text
ERR_INVALID_TARGET
ERR_UNSUPPORTED_PLATFORM
ERR_PRINTER_NOT_FOUND
ERR_CONNECTION_TIMEOUT
ERR_WRITE_TIMEOUT
ERR_CONNECTION_REFUSED
ERR_HOST_NOT_FOUND
ERR_NETWORK_UNREACHABLE
ERR_SERIAL_TIMEOUT
ERR_SERIAL_OPEN_FAILED
ERR_SERIAL_WRITE_FAILED
ERR_SERIAL_CLOSE_FAILED
ERR_WINSPOOL_FAILED
ERR_CUPS_COMMAND_FAILED
ERR_ENCODING_FAILED
ERR_NATIVE_MODULE_UNAVAILABLE
```

## 문서

- [docs/printer-library-design.md](docs/printer-library-design.md)
- [docs/windows-setup.md](docs/windows-setup.md)
- [docs/ui-test-review.md](docs/ui-test-review.md)
- [docs/winspool-napi-design.md](docs/winspool-napi-design.md)
