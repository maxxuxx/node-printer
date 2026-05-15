완료됨

- 루트 TypeScript 설정 정리
  - tsconfig.typecheck.json 제거
  - 전체 타입체크 설정을 tsconfig.json으로 통합
  - 패키지별 중복 typecheck 스크립트 제거
  - typecheck / build / test / lint 통과
- 루트 package scripts 정리
  - build:test-server-ui / build:clean / test-server:build alias 제거
  - winspool 세부 alias 제거 후 패키지 필터 명령으로 문서화
  - format:check 제거
  - typecheck / 문법 검사 / 관련 문서 참조 확인
- 테스트 서버 보강
  - Winspool printer 상세 UI 추가
- QR/barcode/image 도입 전 분석
  - serial / network / winspool raw byte 전달 가능 확인
  - fallback은 printer-core 생성 단계에서만 안전하다고 정리
- QR/barcode/image 출력 구현
  - printer-core receipt builder에 QR 출력 추가
  - printer-core receipt builder에 barcode 출력 추가
  - printer-core receipt builder에 image raster 출력 추가
  - QR/barcode/image 생성 실패 시 오류 텍스트 fallback 추가
  - QR/barcode/image exact byte 테스트 추가
  - serial / network raw byte 전달 테스트 보강
- 테스트 서버 QR/barcode/image와 연속 출력 보강
  - QR/barcode/image 예제 출력 UI 추가
  - QR/barcode/image 예제 영역을 세로 배치로 정리
  - 이미지 파일을 흑백 raster 데이터로 변환하는 UI 경로 추가
  - 이미지 출력 폭 기본값과 자동 threshold 계산 추가
  - 이미지 선택 시 max width와 threshold 분석값 자동 반영
  - `copies` 매수 지정 순차 출력 추가
- 테스트 서버 Svelte UI 전환
  - Vite/Svelte 빌드 경로 추가
  - Toss 스타일 기반 테스트 화면 재구성
  - Pretendard 웹폰트를 CDN에서 불러오도록 UI 폰트 설정 변경
  - serial / network / cups / winspool 탭별 목록 조회와 첫 항목 자동 선택 추가
  - 모든 출력 탭 상세정보 확인 추가
  - serial baudrate를 일반 선택값 드롭다운으로 변경
  - CUPS 목록 API와 network preset API 추가
- WSL 테스트 서버 환경 대응
  - winspool 목록 조회가 비 Windows Node에서 500 대신 unsupported 응답을 반환하도록 수정
  - winspool unsupported 상태에서 UI 출력 버튼과 목록 조회 컨트롤 비활성화
  - WSL serial 목록에서 Windows COM1 / COM3 / COM9 대응 경로 힌트 표시
  - Windows Chrome headless로 테스트 사이트 최종 화면 확인
- winspool prebuild 준비
  - prebuildify devDependency 추가
  - win32 x64 / ia32 / arm64 prebuild 스크립트 추가
  - N-API 버전 `NAPI_VERSION=3`으로 고정
  - install script가 prebuild 우선으로 동작하도록 정리
  - GitHub Actions Windows x64 prebuild job 추가
  - README와 winspool 설계 문서에 prebuild 구조와 asarUnpack 기준 추가
- winspool prebuild-only 배포 정리
  - 런타임에서 `build/Release` fallback 제거
  - install 단계의 source build fallback 제거
  - `binding.gyp` 기본 node-gyp rebuild를 no-op install로 차단
  - npm package 포함 파일을 `dist`와 `prebuilds`로 제한
  - `node-gyp-build`와 `node-gyp` 배포 의존성 제거
  - package 폴더에서 `npm run build`를 실행할 수 있도록 build tool devDependency 보강
  - Windows ia32 prebuild가 Node 26 `node.lib` 404로 실패하지 않도록 prebuild target을 Node 20.0.0으로 고정
  - ARM64 prebuild에서 node-gyp가 잘못된 Visual Studio 인스턴스를 고르지 않도록 `vswhere` 기반 prebuild wrapper 추가
  - Visual Studio Build Tools와 Community가 모두 있으면 Build Tools를 우선 선택하도록 prebuild wrapper 수정
  - Build Tools가 이미 설치된 경우 winget 재실행 대신 `setup.exe modify --installPath` 안내가 나오도록 prebuild wrapper 보강
  - winget generic `Microsoft.VisualStudio.BuildTools`가 VS 2026 Community와 충돌할 수 있어 `Microsoft.VisualStudio.2022.BuildTools`로 설치 안내 고정
  - Visual Studio modify 명령에서 지원되지 않는 `--wait` 제거 후 설치 확인 명령 출력 유지
  - Windows에서 `prebuildify.cmd` 직접 spawn이 `EINVAL`을 내지 않도록 Node로 prebuildify bin을 직접 실행
  - Windows prebuild는 WSL이 아닌 Windows PowerShell에서 설치한 `node_modules`를 사용하도록 문서화
  - prebuild wrapper는 package manager script로 실행해야 `node-gyp` 경로가 잡힌다고 문서화
  - `prebuild:check`, `pack:check`, `release:check` 추가
  - GitHub Actions package contents job을 세 아키텍처 prebuild artifact 기반으로 분리
  - GitHub Actions에서 `setup-node cache: pnpm`이 Node 20 Corepack으로 pnpm 11을 실행하지 않도록 캐시 설정 제거
  - GitHub Actions pnpm 호출을 `corepack pnpm`으로 고정
  - 테스트 서버 winspool 준비 상태를 build output 기준에서 prebuild 기준으로 변경
- scripts 파일 정리
  - 루트 `scripts/*.cjs`와 `scripts/windows/rebuild.ps1` 제거
  - winspool package install helper 파일 제거
  - root build를 `build:packages`와 `build:test-server` package script로 분리
  - README, Windows setup, 테스트 서버 문서의 script 파일 안내 제거
- npm 배포 전 확인 문서화
  - README에 scope, metadata, prebuild, pack, dry-run 체크리스트 추가
  - 사용자가 저장소를 내려받아 `prebuild:all`을 실행하는 흐름 안내
  - Python과 Visual Studio Build Tools 사전 설치 링크와 winget/setup.exe 설치 명령 추가
  - prebuild 누락 상태에서 `pack:check`가 실패하는 것 확인
- winspool native build 검증
  - prebuilds 디렉터리 제거 후 source build 성공 확인
  - `build/Release/winspool.node` 생성 확인
  - Python 미감지 조건에서 자동 설치 없이 node-gyp 오류 종료 확인
  - VS Build Tools 미감지 조건에서 자동 설치 없이 node-gyp 오류 종료 확인
  - 테스트 서버 실행 중 native binary 잠금으로 rebuild clean이 실패하는 점 확인
  - Build Tools 2022 제거/재설치를 시도했으나 현재 Codex 실행 프로세스가 elevated로 시작되지 않아 Visual Studio Installer가 exit code 5007로 차단하는 점 확인

해야 할 작업

Windows 실제 검증

- listWinspoolPrinters()로 목록 조회
- 실제 프린터로 ascii / cp949 / cut 출력 확인
- 지금 제일 중요합니다. 라이브러리 핵심 출력 경로 검증이라서요

winspool 빌드/배포 정리

- 관리자 PowerShell에서 Build Tools 2022 제거/재설치 또는 ARM64 컴포넌트 추가 후 `prebuild:arm64` 확인
- GitHub Actions prebuild와 package contents job 재실행 후 `setup-node` 단계 통과 확인
- `setup-node` 통과 후 다음 실패가 있으면 prebuild 단계 로그 기준으로 추가 확인
- Windows에서 `prebuild:all` 실제 실행 확인
- 실제 prebuild artifact 확보 후 `pnpm --filter @node-printer/printer-winspool pack:check` 통과 확인
- npm publish 전 `prebuilds/win32-{arch}/*.node` 포함 확인

Electron wrapper 패키지

- @node-printer/printer-electron
- main process API
- preload/IPC 샘플
- packaged app에서 asarUnpack native load 검증
- Electron 앱에 붙일 거면 다음으로 중요합니다

ESC/POS 고급 기능

- 코드페이지 선택 명령
- winspool raw byte 전달 성공 테스트 보강
- 실제 ESC/POS 프린터로 QR / barcode / 작은 image / 큰 image 출력 확인

테스트 서버 보강

- preset 저장
- raw hex 직접 출력
- print history
- 이건 개발 편의 기능이라 우선순위는 낮습니다

문서/릴리즈 준비

- 각 transport별 예제 추가
- known issues 정리
- npm publish 전 package metadata 정리
