import { describe, expect, it } from "vitest";

import * as iconv from "iconv-lite";

import { PrinterError, createReceipt, type ReceiptEncoding } from "../../src/index.js";

const SUPPORTED_RECEIPT_ENCODINGS: ReceiptEncoding[] = [
  "utf8",
  "ascii",
  "cp437",
  "cp850",
  "cp852",
  "cp858",
  "cp860",
  "cp863",
  "cp865",
  "cp866",
  "cp949",
  "cp932",
  "cp950",
  "big5",
  "gb18030",
  "windows-874",
  "windows-1250",
  "windows-1251",
  "windows-1252",
  "windows-1253",
  "windows-1254",
  "windows-1255",
  "windows-1256",
  "windows-1257",
  "windows-1258"
];

const CANONICAL_RECEIPT_ENCODING_SAMPLES: Partial<Record<ReceiptEncoding, string>> = {
  cp437         : "Caf\u00e9 \u00d1",
  cp850         : "Caf\u00e9 \u00d1",
  cp852         : "Za\u017c\u00f3\u0142\u0107 g\u0119\u015bl\u0105 ja\u017a\u0144",
  cp858         : "Caf\u00e9 No\u00ebl",
  cp860         : "a\u00e7\u00e3o \u00e0\u00e9\u00ed\u00f3\u00fa",
  cp863         : "fran\u00e7ais \u00e0\u00e2\u00e7\u00e9\u00e8",
  cp865         : "bl\u00e5b\u00e6r \u00d8resund",
  cp866         : "\u0401\u0436\u0438\u043a \u0419\u043e\u0433\u0430",
  cp932         : "\u30ac\u30ae\u30b0\u30b2\u30b4",
  cp949         : "\ub9e4\uc7a5 \uc8fc\ubb38 \uc644\ub8cc",
  gb18030       : "\ub9e4\uc7a5 \u30ac\u7b80",
  "windows-1250": "Za\u017c\u00f3\u0142\u0107 g\u0119\u015bl\u0105 ja\u017a\u0144 \u0158\u00edzen\u00ed",
  "windows-1251": "\u0401\u0436\u0438\u043a \u0419\u043e\u0433\u0430",
  "windows-1252": "Caf\u00e9 No\u00ebl",
  "windows-1253": "\u039a\u03b1\u03bb\u03b7\u03bc\u03ad\u03c1\u03b1 \u0391\u03b8\u03ae\u03bd\u03b1",
  "windows-1254": "\u0130stanbul \u015f\u00fc\u011f\u00e7\u0131\u00f6",
  "windows-1256": "\u0623\u0647\u0644\u0627 \u0628\u0643",
  "windows-1257": "\u0100\u017euolas \u0105\u010d\u0119\u0117\u012f\u0161\u0173\u016b\u017e",
  "windows-1258": "C\u1ea3m \u01a1n qu\u00fd kh\u00e1ch"
};

// 영수증 빌더가 생성하는 핵심 ESC/POS 바이트 계약을 검증합니다
describe("createReceipt", () => {
  it("encodes printable text for every supported receipt encoding", () => {
    for (const encoding of SUPPORTED_RECEIPT_ENCODINGS) {
      expect(() => createReceipt({ encoding }).text("ABC 123").encode()).not.toThrow();
    }
  });

  it("normalizes canonically equivalent text for supported legacy encodings", () => {
    const entries = Object.entries(CANONICAL_RECEIPT_ENCODING_SAMPLES) as [ReceiptEncoding, string][];

    for (const [encoding, sample] of entries) {
      const bytes     = createReceipt({ encoding }).text(sample.normalize("NFD")).encode();
      const textBytes = bytes.subarray(0, -1);
      const decoded   = iconv.decode(Buffer.from(textBytes), encoding);

      expect(Array.from(textBytes)).not.toContain(0x3f);
      expect(decoded.normalize("NFC")).toBe(sample.normalize("NFC"));
    }
  });

  it("encodes basic ESC/POS commands", () => {
    const bytes = createReceipt({ encoding: "ascii" })
      .initialize()
      .text("Hi")
      .cut()
      .encode();

    expect(Array.from(bytes)).toEqual([0x1b, 0x40, 0x48, 0x69, 0x0a, 0x1d, 0x56, 0x00]);
  });

  it("creates dividers with the configured width", () => {
    const bytes = createReceipt({ columns: 4, encoding: "ascii" }).divider("=").encode();

    expect(new TextDecoder().decode(bytes)).toBe("====\n");
  });

  it("supports paper presets and explicit character width", () => {
    const bytes = createReceipt({ columns: 4, encoding: "ascii" })
      .divider()
      .encode();

    expect(new TextDecoder().decode(bytes)).toBe("----\n");
  });

  it("formats simple receipt rows", () => {
    const bytes = createReceipt({ columns: 10, encoding: "ascii" })
      .row([
        { text: "Tea", width: 6 },
        { text: "3000", width: 4, align: "right" }
      ])
      .encode();

    expect(new TextDecoder().decode(bytes)).toBe("Tea   3000\n");
  });

  it("wraps text to the configured width", () => {
    const bytes = createReceipt({ columns: 8, encoding: "ascii" })
      .wrap("one two three", { indent: 2 })
      .encode();

    expect(new TextDecoder().decode(bytes)).toBe("one two\n  three\n");
  });

  it("supports divider labels and line layout helpers", () => {
    const bytes = createReceipt({ columns: 12, encoding: "ascii" })
      .title("Cafe")
      .divider({ char: "=", text: "MENU" })
      .leftRight("Subtotal", "1200")
      .keyValue("Order", "A12")
      .blank()
      .truncate("ABCDEFGHIJ", { width: 5 })
      .encode();

    expect(new TextDecoder().decode(bytes)).toBe(
      "    Cafe    \n====MENU====\nSubtotal1200\nOrder:   A12\n\nAB...\n"
    );
  });

  it("wraps multi-line columns", () => {
    const bytes = createReceipt({ columns: 12, encoding: "ascii" })
      .columns(
        [
          { text: "Apple Pie", width: 8 },
          { text: "1000", width: 4, align: "right" }
        ],
        { wrap: true }
      )
      .encode();

    expect(new TextDecoder().decode(bytes)).toBe("Apple   1000\nPie         \n");
  });

  it("builds tables, item rows, totals, and formatted amounts", () => {
    const bytes = createReceipt({ columns: 20, encoding: "ascii" })
      .table({
        columns: [
          { title: "Name", width: 12 },
          { title: "Amt", width: 8, align: "right" }
        ],
        rows: [["Tea", "1000"]],
        divider: true
      })
      .items([{ name: "Tea", quantity: 2, amount: 3000 }], { unit: "won" })
      .totals([{ label: "Total", amount: 4000 }], { unit: "won" })
      .amount(4000, { label: "Paid", unit: "won" })
      .encode();

    expect(new TextDecoder().decode(bytes)).toBe(
      `Name             Amt\n${"-".repeat(20)}\nTea             1000\nTea x2      3,000won\nTotal       4,000won\nPaid        4,000won\n`
    );
  });

  it("measures full-width receipt text as two columns", () => {
    const bytes = createReceipt({ columns: 10, encoding: "cp949" })
      .leftRight("합계", "4,500")
      .encode();

    expect(Array.from(bytes)).toEqual([
      0xc7, 0xd5, 0xb0, 0xe8,
      0x20,
      0x34, 0x2c, 0x35, 0x30, 0x30,
      0x0a
    ]);
  });

  it("restores simple styles after a scoped style block", () => {
    const bytes = createReceipt({ encoding: "ascii" })
      .style({ bold: true }, (receipt) => {
        receipt.text("BOLD");
      })
      .text("PLAIN")
      .encode();

    expect(Array.from(bytes)).toEqual([
      0x1b, 0x45, 0x01,
      0x42, 0x4f, 0x4c, 0x44, 0x0a,
      0x1b, 0x45, 0x00,
      0x50, 0x4c, 0x41, 0x49, 0x4e, 0x0a
    ]);
  });

  it("adds utility commands and exposes preview helpers", () => {
    const receipt = createReceipt({ encoding: "ascii" })
      .line("A")
      .codePage(21)
      .font("b")
      .invert(true)
      .cashDrawer({ pin: 5, on: 10, off: 20 })
      .beep(2, 3);

    expect(receipt.preview()).toBe("A\n");
    expect(receipt.toHex()).toBe("410a1b74151b4d011d42011b70010a141014070203");
  });

  it("replaces non-ascii text when ascii encoding is selected", () => {
    const bytes = createReceipt({ encoding: "ascii" }).text("매장").encode();

    expect(new TextDecoder().decode(bytes)).toBe("??\n");
  });

  it("encodes Korean text as CP949", () => {
    const bytes = createReceipt({ encoding: "cp949" }).text("매장").encode();

    expect(Array.from(bytes)).toEqual([0xb8, 0xc5, 0xc0, 0xe5, 0x0a]);
  });

  it("encodes Vietnamese text as Windows-1258", () => {
    const bytes = createReceipt({ encoding: "windows-1258" })
      .text("C\u1ea3m \u01a1n qu\u00fd kh\u00e1ch")
      .encode();

    expect(Array.from(bytes)).toEqual([
      0x43, 0x61, 0xd2, 0x6d, 0x20, 0xf5, 0x6e, 0x20, 0x71, 0x75, 0x79, 0xec, 0x20, 0x6b, 0x68, 0x61,
      0xec, 0x63, 0x68, 0x0a
    ]);
  });

  it("changes text encoding separately from printer code page command", () => {
    const bytes = createReceipt({ encoding: "ascii" })
      .codePage(21)
      .encoding("cp949")
      .text("매장")
      .encode();

    expect(Array.from(bytes)).toEqual([
      0x1b, 0x74, 0x15,
      0xb8, 0xc5, 0xc0, 0xe5, 0x0a
    ]);
  });

  it("keeps code page and Windows-1258 text encoding separate", () => {
    const bytes = createReceipt({ encoding: "ascii" })
      .codePage(30)
      .encoding("windows-1258")
      .text("\u0110\u00e3 ph\u00ea duy\u1ec7t")
      .encode();

    expect(Array.from(bytes)).toEqual([
      0x1b, 0x74, 0x1e,
      0xd0, 0x61, 0xde, 0x20, 0x70, 0x68, 0xea, 0x20, 0x64, 0x75, 0x79, 0xea, 0xf2, 0x74, 0x0a
    ]);
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
