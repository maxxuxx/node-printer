import type { PrinterTarget } from "./types.js";

// Printer status

// 상태 조회 결과가 어떤 경로(ESC/POS 실시간 명령 / OS 스풀러)에서 왔는지 구분합니다
export type PrinterStatusSource = "escpos" | "winspool" | "cups";

// 각 필드는 출처가 보고하지 못하면 undefined로 남겨, "알 수 없음"과 "정상"을 구분합니다
export interface PrinterStatus {
  target        : PrinterTarget;
  source        : PrinterStatusSource;
  online        ?: boolean;
  paperOut      ?: boolean;
  paperNearEnd  ?: boolean;
  coverOpen     ?: boolean;
  paperJam      ?: boolean;
  drawerOpen    ?: boolean;
  error         ?: boolean;
  paused        ?: boolean;
  busy          ?: boolean;
  raw           ?: Record<string, number | string | boolean>;
}

// ESC/POS real-time status

const DLE = 0x10;
const EOT = 0x04;

// DLE EOT 1~4를 한 번에 보내 응답 4바이트를 순서대로 회신받습니다
export const ESC_POS_STATUS_QUERY: Uint8Array = Uint8Array.from([
  DLE, EOT, 1,
  DLE, EOT, 2,
  DLE, EOT, 3,
  DLE, EOT, 4
]);

// 위 질의에 대해 기대하는 응답 바이트 수입니다
export const ESC_POS_STATUS_RESPONSE_BYTES = 4;

// DLE EOT 응답 비트필드를 정규화된 상태 필드로 해석합니다
export function decodeEscPosStatus(bytes: Uint8Array): Omit<PrinterStatus, "target" | "source"> {
  const printerStatus = bytes[0];
  const offlineStatus = bytes[1];
  const errorStatus   = bytes[2];
  const paperStatus   = bytes[3];

  const status: Omit<PrinterStatus, "target" | "source"> = {};

  // DLE EOT 1: online 여부와 드로어 핀 상태
  if (printerStatus !== undefined) {
    status.online     = (printerStatus & 0x08) === 0;
    status.drawerOpen = (printerStatus & 0x04) !== 0;
  }

  // DLE EOT 2: 커버 열림 / 용지 없음 / 에러
  if (offlineStatus !== undefined) {
    status.coverOpen = (offlineStatus & 0x04) !== 0;
    status.paperOut  = (offlineStatus & 0x20) !== 0;
    status.error     = (offlineStatus & 0x40) !== 0;
  }

  // DLE EOT 3: 절단기/복구 가능·불가능 에러
  if (errorStatus !== undefined) {
    const hasError = (errorStatus & (0x08 | 0x20 | 0x40)) !== 0;

    status.error = Boolean(status.error) || hasError;
  }

  // DLE EOT 4: 용지 거의 없음 / 용지 끝 센서
  if (paperStatus !== undefined) {
    status.paperNearEnd = (paperStatus & 0x0c) === 0x0c;

    // 용지 끝 센서가 확정되면 paperOut을 보강합니다
    if ((paperStatus & 0x60) === 0x60) {
      status.paperOut = true;
    }
  }

  status.raw = buildRawStatus(bytes);

  return status;
}

// 응답 원본 바이트를 디버깅용 16진수 문자열로 보관합니다
function buildRawStatus(bytes: Uint8Array): Record<string, number> {
  const raw: Record<string, number> = {};

  bytes.forEach((value, index) => {
    raw[`dleEot${index + 1}`] = value;
  });

  return raw;
}
