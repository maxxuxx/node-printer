import { PrinterError } from "../errors.js";
import type {
  ReceiptAmountFormatOptions,
  ReceiptColumn,
  ReceiptDividerOptions,
  TextAlign
} from "./types.js";

// Text layout

export interface TextMetrics {
  measure(value: string): number;
  units(value: string): string[];
}

const DEFAULT_TEXT_METRICS: TextMetrics = {
  measure: measureTextWidth,
  units  : (value) => Array.from(value)
};

export function formatColumn(column: ReceiptColumn, metrics: TextMetrics = DEFAULT_TEXT_METRICS): string {
  const text = truncateText(column.text, column.width, "", metrics);

  if (column.align === "right") {
    return `${" ".repeat(Math.max(0, column.width - metrics.measure(text)))}${text}`;
  }

  if (column.align === "center") {
    const remaining = column.width - metrics.measure(text);
    const left      = Math.floor(remaining / 2);
    const right     = remaining - left;

    return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
  }

  return `${text}${" ".repeat(Math.max(0, column.width - metrics.measure(text)))}`;
}

export function formatText(
  value: string,
  width: number,
  align: TextAlign = "left",
  metrics: TextMetrics = DEFAULT_TEXT_METRICS
): string {
  const text = truncateText(value, width, "", metrics);

  if (align === "right") {
    return `${" ".repeat(Math.max(0, width - metrics.measure(text)))}${text}`;
  }

  if (align === "center") {
    const remaining = width - metrics.measure(text);
    const left      = Math.floor(remaining / 2);
    const right     = remaining - left;

    return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
  }

  return `${text}${" ".repeat(Math.max(0, width - metrics.measure(text)))}`;
}

export function formatDivider(
  width: number,
  options: string | ReceiptDividerOptions = "-",
  metrics: TextMetrics = DEFAULT_TEXT_METRICS
): string {
  const normalized = typeof options === "string" ? { char: options } : options;
  const size       = normalized.width ?? width;
  const mark       = Array.from(normalized.char ?? "-")[0] ?? "-";

  assertPositiveWidth(size, "Divider width");

  if (!normalized.text) {
    return mark.repeat(size);
  }

  return formatTextWithFill(normalized.text, size, mark, normalized.align ?? "center", metrics);
}

export function truncateText(
  value: string,
  width: number,
  ellipsis = "...",
  metrics: TextMetrics = DEFAULT_TEXT_METRICS
): string {
  assertPositiveWidth(width, "Text width");

  if (metrics.measure(value) <= width) {
    return value;
  }

  const suffix = takeColumns(ellipsis, width, metrics);
  const keep   = Math.max(0, width - metrics.measure(suffix));

  return `${takeColumns(value, keep, metrics)}${suffix}`;
}

export function wrapText(
  value: string,
  width: number,
  options: { indent?: number; breakWords?: boolean } = {},
  metrics: TextMetrics = DEFAULT_TEXT_METRICS
): string[] {
  assertPositiveWidth(width, "Wrap width");

  const indent     = Math.max(0, options.indent ?? 0);
  const breakWords = options.breakWords ?? true;
  const lines      = String(value)
    .split(/\r?\n/)
    .flatMap((paragraph, index) =>
      wrapParagraph(paragraph, width, index === 0 ? 0 : indent, indent, breakWords, metrics)
    );

  return lines.length > 0 ? lines : [""];
}

export function formatAmount(value: number, options: ReceiptAmountFormatOptions = {}): string {
  const formatted = new Intl.NumberFormat(options.locale ?? "ko-KR", {
    currency             : options.currency,
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
    style                : options.currency ? "currency" : "decimal"
  }).format(value);

  return `${formatted}${options.unit ?? ""}`;
}

export function measureTextWidth(value: string): number {
  return Array.from(value).reduce((width, char) => width + charColumnWidth(char), 0);
}

function wrapParagraph(
  paragraph: string,
  width: number,
  firstIndent: number,
  nextIndent: number,
  breakWords: boolean,
  metrics: TextMetrics
): string[] {
  const words  = paragraph.split(/\s+/).filter((word) => word.length > 0);
  const lines  = [];
  let current  = "";
  let indent   = firstIndent;

  if (words.length === 0) {
    return [" ".repeat(firstIndent)];
  }

  for (const word of words) {
    const prefix = " ".repeat(indent);
    const limit  = Math.max(1, width - indent);

    if (!current) {
      if (metrics.measure(word) > limit && breakWords) {
        const pieces = splitWord(word, limit, metrics);

        lines.push(`${prefix}${pieces[0]}`);
        lines.push(...pieces.slice(1, -1).map((piece) => `${" ".repeat(nextIndent)}${piece}`));
        current = pieces.at(-1) ?? "";
        indent  = nextIndent;
        continue;
      }

      current = word;
      continue;
    }

    if (metrics.measure(`${current} ${word}`) <= limit) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(`${prefix}${current}`);
    indent  = nextIndent;

    if (metrics.measure(word) > Math.max(1, width - indent) && breakWords) {
      const pieces = splitWord(word, Math.max(1, width - indent), metrics);

      lines.push(...pieces.slice(0, -1).map((piece) => `${" ".repeat(indent)}${piece}`));
      current = pieces.at(-1) ?? "";
    } else {
      current = word;
    }
  }

  if (current) {
    lines.push(`${" ".repeat(indent)}${current}`);
  }

  return lines;
}

function splitWord(value: string, width: number, metrics: TextMetrics): string[] {
  const pieces = [];
  let current  = "";
  let size     = 0;

  for (const char of metrics.units(value)) {
    const charWidth = metrics.measure(char);

    if (current && size + charWidth > width) {
      pieces.push(current);
      current = "";
      size    = 0;
    }

    current += char;
    size    += charWidth;
  }

  if (current) {
    pieces.push(current);
  }

  return pieces;
}

function formatTextWithFill(
  value: string,
  width: number,
  fill: string,
  align: TextAlign,
  metrics: TextMetrics
): string {
  const text      = truncateText(value, width, "", metrics);
  const remaining = Math.max(0, width - metrics.measure(text));

  if (align === "left") {
    return `${text}${fill.repeat(remaining)}`;
  }

  if (align === "right") {
    return `${fill.repeat(remaining)}${text}`;
  }

  const left  = Math.floor(remaining / 2);
  const right = remaining - left;

  return `${fill.repeat(left)}${text}${fill.repeat(right)}`;
}

function assertPositiveWidth(width: number, name: string): void {
  if (!Number.isInteger(width) || width < 1) {
    throw new PrinterError({
      code   : "ERR_ENCODING_FAILED",
      message: `${name} must be a positive integer`
    });
  }
}

function takeColumns(value: string, width: number, metrics: TextMetrics): string {
  let result = "";
  let size   = 0;

  for (const char of metrics.units(value)) {
    const charWidth = metrics.measure(char);

    if (size + charWidth > width) {
      break;
    }

    result += char;
    size   += charWidth;
  }

  return result;
}

function charColumnWidth(char: string): number {
  const codePoint = char.codePointAt(0) ?? 0;

  if (isCombiningMark(codePoint)) {
    return 0;
  }

  return isFullWidth(codePoint) ? 2 : 1;
}

function isCombiningMark(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  );
}

function isFullWidth(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff01 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}
