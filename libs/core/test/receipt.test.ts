import { describe, expect, it } from "vitest";

import { PrinterError, createReceipt } from "../src/index.js";

// 영수증 빌더가 생성하는 핵심 ESC/POS 바이트 계약을 검증합니다
describe("createReceipt", () => {
  it("encodes basic ESC/POS commands", () => {
    const bytes = createReceipt({ encoding: "ascii" })
      .initialize()
      .text("Hi")
      .cut()
      .encode();

    expect(Array.from(bytes)).toEqual([0x1b, 0x40, 0x48, 0x69, 0x0a, 0x1d, 0x56, 0x00]);
  });

  it("creates dividers with the configured width", () => {
    const bytes = createReceipt({ width: 4, encoding: "ascii" }).divider("=").encode();

    expect(new TextDecoder().decode(bytes)).toBe("====\n");
  });

  it("formats simple receipt rows", () => {
    const bytes = createReceipt({ width: 10, encoding: "ascii" })
      .row([
        { text: "Tea", width: 6 },
        { text: "3000", width: 4, align: "right" }
      ])
      .encode();

    expect(new TextDecoder().decode(bytes)).toBe("Tea   3000\n");
  });

  it("replaces non-ascii text when ascii encoding is selected", () => {
    const bytes = createReceipt({ encoding: "ascii" }).text("매장").encode();

    expect(new TextDecoder().decode(bytes)).toBe("??\n");
  });

  it("encodes Korean text as CP949", () => {
    const bytes = createReceipt({ encoding: "cp949" }).text("매장").encode();

    expect(Array.from(bytes)).toEqual([0xb8, 0xc5, 0xc0, 0xe5, 0x0a]);
  });

  it("throws PrinterError for invalid text size", () => {
    expect(() => createReceipt().size(9, 1)).toThrow(PrinterError);
  });

  it("keeps raw bytes unchanged", () => {
    const bytes = createReceipt().raw([0x00, 0x1b, 0x1d, 0xff]).encode();

    expect(Array.from(bytes)).toEqual([0x00, 0x1b, 0x1d, 0xff]);
  });

  it("encodes QR code commands", () => {
    const bytes = createReceipt({ encoding: "ascii" }).qr("HELLO").encode();

    expect(Array.from(bytes)).toEqual([
      0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
      0x1d, 0x28, 0x6b, 0x08, 0x00, 0x31, 0x50, 0x30,
      0x48, 0x45, 0x4c, 0x4c, 0x4f,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30
    ]);
  });

  it("encodes QR data with configured text encoding", () => {
    const bytes = createReceipt({ encoding: "cp949" })
      .qr("매장", { size: 3, errorCorrection: "q" })
      .encode();

    expect(Array.from(bytes)).toEqual([
      0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x03,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x32,
      0x1d, 0x28, 0x6b, 0x07, 0x00, 0x31, 0x50, 0x30,
      0xb8, 0xc5, 0xc0, 0xe5,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30
    ]);
  });

  it("encodes barcode commands", () => {
    const bytes = createReceipt({ encoding: "ascii" })
      .barcode("880123456789", {
        type  : "ean13",
        width : 3,
        height: 80,
        hri   : "below"
      })
      .encode();

    expect(Array.from(bytes)).toEqual([
      0x1d, 0x77, 0x03,
      0x1d, 0x68, 0x50,
      0x1d, 0x48, 0x02,
      0x1d, 0x6b, 0x43, 0x0c,
      0x38, 0x38, 0x30, 0x31, 0x32, 0x33,
      0x34, 0x35, 0x36, 0x37, 0x38, 0x39
    ]);
  });

  it("encodes raster image commands from pixels", () => {
    const bytes = createReceipt()
      .image({
        width : 8,
        height: 1,
        data  : [1, 0, 1, 0, 1, 0, 1, 0]
      })
      .encode();

    expect(Array.from(bytes)).toEqual([
      0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x01, 0x00, 0xaa
    ]);
  });

  // QR 바코드 이미지 실패가 사용자 출력 흐름을 끊지 않는지 확인합니다
  it("writes fallback text when QR, barcode, or image encoding fails", () => {
    const bytes = createReceipt({ encoding: "ascii" })
      .qr("", { fallbackText: "[QR unavailable]" })
      .barcode("abc", { type: "code39" })
      .image({ width: 8, height: 1, data: [1, 0] })
      .encode();

    expect(new TextDecoder().decode(bytes)).toBe(
      "[QR unavailable]\n[BARCODE ERROR]\n[IMAGE ERROR]\n"
    );
  });

  // fallback을 끄면 인코딩 오류가 호출자에게 전달되는지 확인합니다
  it("throws when QR, barcode, or image fallback is disabled", () => {
    expect(() => createReceipt().qr("", { fallbackText: false })).toThrow(PrinterError);
    expect(() => createReceipt().barcode("abc", { type: "code39", fallbackText: false })).toThrow(PrinterError);
    expect(() => createReceipt().image({ width: 8, height: 1, data: [1] }, { fallbackText: false })).toThrow(PrinterError);
  });
});
