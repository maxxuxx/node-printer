import net from "node:net";

import { describe, expect, it } from "vitest";

import {
  columnsFromDots,
  decodeEscPosStatus,
  dotsFromMm,
  ESC_POS_STATUS_QUERY,
  paperPresetToCapabilities,
  resolvePrintableDots
} from "#core";

import { getPaperInfo } from "../src/api/paper.js";
import { getNetworkStatus } from "../src/transports/network/index.js";
import { decodeWinspoolStatus } from "../src/transports/winspool/index.js";
import { parsePageWidthMm } from "../src/transports/cups/index.js";

describe("ESC/POS 상태 디코딩", () => {
  it("online/용지없음/에러 비트를 정규화한다", () => {
    // s1=0x12 정상, s2=0x32 용지 없음, s3/s4 정상
    const status = decodeEscPosStatus(Uint8Array.from([0x12, 0x32, 0x12, 0x12]));

    expect(status.online).toBe(true);
    expect(status.paperOut).toBe(true);
    expect(status.coverOpen).toBe(false);
    expect(status.error).toBe(false);
  });

  it("오프라인/커버 열림을 인식한다", () => {
    // s1=0x1a → offline 비트(0x08), s2=0x16 → cover open 비트(0x04)
    const status = decodeEscPosStatus(Uint8Array.from([0x1a, 0x16, 0x12, 0x12]));

    expect(status.online).toBe(false);
    expect(status.coverOpen).toBe(true);
  });
});

describe("Winspool 상태 비트 디코딩", () => {
  it("PRINTER_STATUS 비트를 정규화한다", () => {
    // PAPER_OUT(0x10) | OFFLINE(0x80) | DOOR_OPEN(0x00400000)
    const status = decodeWinspoolStatus(0x10 | 0x80 | 0x00400000);

    expect(status.online).toBe(false);
    expect(status.paperOut).toBe(true);
    expect(status.coverOpen).toBe(true);
    expect(status.paperJam).toBe(false);
  });

  it("정상 상태(0)는 online으로 본다", () => {
    const status = decodeWinspoolStatus(0);

    expect(status.online).toBe(true);
    expect(status.error).toBe(false);
  });
});

describe("용지 너비 → columns 계산", () => {
  it("도트 폭과 폰트로 columns를 계산한다", () => {
    expect(columnsFromDots(576, "a")).toBe(48);
    expect(columnsFromDots(384, "a")).toBe(32);
    expect(columnsFromDots(576, "b")).toBe(64);
  });

  it("mm와 dpi로 도트 폭을 환산한다", () => {
    expect(dotsFromMm(72, 203)).toBe(Math.round((72 / 25.4) * 203));
  });

  it("프리셋을 용지 정보로 변환한다", () => {
    const capabilities = paperPresetToCapabilities("80mm");

    expect(resolvePrintableDots(capabilities)).toBe(576);
  });
});

describe("getPaperInfo 우선순위", () => {
  const target = { type: "network", host: "127.0.0.1" } as const;
  const cupsTarget = { type: "cups", printerName: "Receipt" } as const;

  it("명시 columns가 최우선이다", async () => {
    const info = await getPaperInfo(target, { columns: 30 });

    expect(info.source).toBe("manual");
    expect(info.columns).toBe(30);
  });

  it("수동 용지 프리셋을 사용한다", async () => {
    const info = await getPaperInfo(target, { paper: "80mm", font: "a" });

    expect(info.source).toBe("manual");
    expect(info.columns).toBe(48);
    expect(info.printableWidthDots).toBe(576);
  });

  it("아무 근거가 없으면 기본값으로 폴백한다", async () => {
    const info = await getPaperInfo(target, {});

    expect(info.source).toBe("default");
    expect(info.columns).toBe(42);
  });

  it("시스템 조회 실패를 기본값으로 숨기지 않는다", async () => {
    await expect(getPaperInfo(cupsTarget, {
      cups: {
        platform: "linux",
        runner  : {
          run: async () => ({
            stdout  : "",
            stderr  : "lpoptions: Unknown printer",
            exitCode: 1,
            signal  : null
          })
        }
      }
    })).rejects.toMatchObject({
      code: "ERR_CUPS_COMMAND_FAILED"
    });
  });

  it("시스템 조회 성공 후 너비만 없으면 기본값으로 폴백한다", async () => {
    const info = await getPaperInfo(cupsTarget, {
      cups: {
        platform: "linux",
        runner  : {
          run: async () => ({
            stdout  : "Resolution/Output Resolution: 203dpi",
            stderr  : "",
            exitCode: 0,
            signal  : null
          })
        }
      }
    });

    expect(info.source).toBe("default");
    expect(info.columns).toBe(42);
  });
});

describe("CUPS PageSize 너비 파싱", () => {
  it("선택된 mm 너비를 추출한다", () => {
    const output = [
      "PageSize/Media Size: 72x200mm *80x297mm Custom.WIDTHxHEIGHT"
    ].join("\n");

    expect(parsePageWidthMm(output)).toBe(80);
  });

  it("매칭 토큰이 없으면 undefined를 반환한다", () => {
    expect(parsePageWidthMm("Resolution/Output Resolution: 203dpi")).toBeUndefined();
  });
});

describe("network getStatus (실제 TCP 응답)", () => {
  it("프린터 응답 바이트를 상태로 디코딩한다", async () => {
    const server = await startStatusServer(Uint8Array.from([0x12, 0x32, 0x12, 0x12]));

    try {
      const status = await getNetworkStatus({
        type     : "network",
        host     : "127.0.0.1",
        port     : server.port,
        timeoutMs: 1000
      });

      expect(status.source).toBe("escpos");
      expect(status.online).toBe(true);
      expect(status.paperOut).toBe(true);
    } finally {
      await server.close();
    }
  });
});

// 상태 질의를 받으면 지정한 응답 바이트를 돌려주는 임시 TCP 서버
async function startStatusServer(response: Uint8Array): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const server = net.createServer((socket) => {
    socket.once("data", () => {
      socket.write(Buffer.from(response));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate TCP server port");
  }

  // 질의 바이트 상수가 비어 있지 않은지 함께 확인
  expect(ESC_POS_STATUS_QUERY.byteLength).toBe(12);

  return {
    port : address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}
