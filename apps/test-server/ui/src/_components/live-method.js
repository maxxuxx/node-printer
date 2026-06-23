// Public method text
export function buildLiveMethod({ receipt, target, copies }) {
  const normalizedCopies = Math.max(1, Number(copies) || 1);
  const lines            = [
    'import { createReceipt, print } from "@maxxuxx/node-printer";',
    "",
    ...buildReceiptLines(receipt),
    "",
    "const target = {",
    ...formatObjectFields(orderTargetFields(target), 2),
    "};",
    "",
    ...buildPrintLines(normalizedCopies)
  ];

  return lines.join("\n");
}

// Receipt chain
function buildReceiptLines(receipt) {
  const lines = [
    "const receipt = createReceipt({",
    ...formatObjectFields(
      {
        paper: receipt.paper,
        width: Number(receipt.receiptWidth)
      },
      2
    ),
    "})",
    "  .initialize()"
  ];

  if (receipt.codePageEnabled) lines.push(`  .codePage(${Number(receipt.codePage)})`);
  if (receipt.encoding) lines.push(`  .encoding(${formatValue(receipt.encoding)})`);

  for (const line of String(receipt.receiptLines ?? "").split(/\r?\n/).filter(Boolean)) {
    lines.push(`  .text(${formatValue(line)})`);
  }

  if (receipt.divider) lines.push("  .divider()");
  if (receipt.titleEnabled) lines.push(`  .title(${formatValue(receipt.titleText)})`);
  if (receipt.sectionEnabled) lines.push(`  .section(${formatValue(receipt.sectionText)})`);
  if (receipt.wrapEnabled) lines.push(`  .wrap(${formatValue(receipt.wrapTextValue)}, ${formatInlineObject({ indent: Number(receipt.wrapIndent) })})`);
  if (receipt.truncateEnabled) lines.push(`  .truncate(${formatValue(receipt.truncateTextValue)}, ${formatInlineObject({ width: Number(receipt.truncateWidth) })})`);
  if (receipt.blankEnabled) lines.push(`  .blank(${Number(receipt.blankLines)})`);
  if (String(receipt.dividerText ?? "").trim()) {
    lines.push(`  .divider(${formatInlineObject({ char: receipt.dividerChar || "-", text: receipt.dividerText })})`);
  }
  if (receipt.leftRightEnabled) lines.push(`  .leftRight(${formatValue(receipt.leftRightLeft)}, ${formatValue(receipt.leftRightRight)})`);
  if (receipt.keyValueEnabled) lines.push(`  .keyValue(${formatValue(receipt.keyValueLabel)}, ${formatValue(receipt.keyValueValue)})`);
  if (receipt.columnsEnabled) lines.push(`  .columns(${formatInlineColumns(receipt)}, { wrap: true })`);
  if (receipt.tableEnabled) lines.push(`  .table(${formatInlineTable(receipt)})`);
  if (receipt.itemsEnabled) lines.push(`  .items(${formatInlineItems()}, ${formatInlineObject({ unit: receipt.amountUnit })})`);
  if (receipt.totalsEnabled) lines.push(`  .totals(${formatInlineTotals()}, ${formatInlineObject({ unit: receipt.amountUnit })})`);
  if (receipt.amountEnabled) lines.push(`  .amount(${Number(receipt.amountValue)}, ${formatInlineObject({ label: receipt.amountLabel, unit: receipt.amountUnit })})`);
  if (receipt.styleEnabled) lines.push(`  .style({ bold: true }, (styled) => styled.text(${formatValue(receipt.styleText)}))`);
  if (receipt.fontValue !== "a") {
    lines.push(`  .font(${formatValue(receipt.fontValue)})`);
    lines.push('  .text("Font sample")');
    lines.push('  .font("a")');
  }
  if (receipt.invertEnabled) {
    lines.push("  .invert(true)");
    lines.push('  .text("Invert sample")');
    lines.push("  .invert(false)");
  }
  if (receipt.qrEnabled) lines.push(`  .qr(${formatValue(receipt.qrData)}, ${formatInlineObject({ size: Number(receipt.qrSize), errorCorrection: receipt.qrCorrection, fallbackText: "[QR ERROR]" })})`);
  if (receipt.barcodeEnabled) {
    lines.push(`  .barcode(${formatValue(receipt.barcodeData)}, ${formatInlineObject({ type: receipt.barcodeType, width: Number(receipt.barcodeWidth), height: Number(receipt.barcodeHeight), hri: "below", fallbackText: "[BARCODE ERROR]" })})`);
  }
  if (receipt.imageEnabled) lines.push('  .image(imageData, { fallbackText: "[IMAGE ERROR]" })');
  if (receipt.cashDrawerEnabled) lines.push("  .cashDrawer({ pin: 2, on: 50, off: 250 })");
  if (receipt.beepEnabled) lines.push("  .beep(1, 1)");
  if (Number.isInteger(Number(receipt.feed)) && Number(receipt.feed) > 0) lines.push(`  .feed(${Number(receipt.feed)})`);
  if (receipt.cut) lines.push("  .cut()");

  lines.push("  .encode();");

  return receipt.imageEnabled
    ? ["const imageData = { width: 384, height: 120, data: [0, 1, 0] };", "", ...lines]
    : lines;
}

function buildPrintLines(copies) {
  if (copies === 1) {
    return ["await print(target, receipt);"];
  }

  return [
    `for (let copy = 0; copy < ${copies}; copy += 1) {`,
    "  await print(target, receipt);",
    "}"
  ];
}

// Inline values
function orderTargetFields(target) {
  const orderedKeys = ["type", "path", "printerName", "host", "port", "baudRate", "dataBits", "stopBits", "parity", "flowControl"];
  const ordered     = {};

  for (const key of orderedKeys) {
    if (Object.hasOwn(target ?? {}, key)) {
      ordered[key] = target[key];
    }
  }

  for (const [key, value] of Object.entries(target ?? {})) {
    if (!Object.hasOwn(ordered, key)) {
      ordered[key] = value;
    }
  }

  return ordered;
}

function formatObjectFields(value, spaces) {
  const entries = Object.entries(value ?? {}).filter(([, item]) => item !== undefined && item !== "");
  const width   = Math.max(...entries.map(([key]) => key.length), 0);

  return entries.map(([key, item], index) => {
    const comma = index === entries.length - 1 ? "" : ",";

    return `${" ".repeat(spaces)}${key.padEnd(width)}: ${formatValue(item)}${comma}`;
  });
}

function formatInlineObject(value) {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== "");

  return `{ ${entries.map(([key, item]) => `${key}: ${formatValue(item)}`).join(", ")} }`;
}

function formatValue(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (value && typeof value === "object") return formatInlineObject(value);

  return String(value);
}

function formatInlineColumns(receipt) {
  const leftWidth = Math.max(1, Number(receipt.receiptWidth) - 12);

  return `[${formatInlineObject({ text: receipt.columnLeft, width: leftWidth })}, ${formatInlineObject({ text: receipt.columnRight, width: 12, align: "right" })}]`;
}

function formatInlineTable(receipt) {
  return formatInlineObject({
    columns: [
      { title: "Name", width: Math.max(1, Number(receipt.receiptWidth) - 12) },
      { title: "Amount", width: 12, align: "right" }
    ],
    divider: true,
    rows: [
      ["Latte", "5500"],
      ["Cookie", "2500"]
    ]
  });
}

function formatInlineItems() {
  return `[${formatInlineObject({ name: "Latte", quantity: 2, amount: 11000 })}, ${formatInlineObject({ name: "Cookie", quantity: 1, amount: 2500 })}]`;
}

function formatInlineTotals() {
  return `[${formatInlineObject({ label: "Subtotal", amount: 13500 })}, ${formatInlineObject({ label: "Total", amount: 16500, bold: true })}]`;
}
