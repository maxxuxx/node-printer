import { PrinterError } from "../errors.js";
import type {
  ReceiptAmountFormatOptions,
  ReceiptColumn,
  ReceiptDividerOptions,
  TextAlign
} from "./types.js";

// Text layout

export function formatColumn(column: ReceiptColumn): string {
  const text = truncateText(column.text, column.width, "");

  if (column.align === "right") {
    return text.padStart(column.width);
  }

  if (column.align === "center") {
    const remaining = column.width - text.length;
    const left      = Math.floor(remaining / 2);
    const right     = remaining - left;

    return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
  }

  return text.padEnd(column.width);
}

export function formatText(value: string, width: number, align: TextAlign = "left"): string {
  const text = truncateText(value, width, "");

  if (align === "right") {
    return text.padStart(width);
  }

  if (align === "center") {
    const remaining = width - charCount(text);
    const left      = Math.floor(remaining / 2);
    const right     = remaining - left;

    return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
  }

  return text.padEnd(width);
}

export function formatDivider(width: number, options: string | ReceiptDividerOptions = "-"): string {
  const normalized = typeof options === "string" ? { char: options } : options;
  const size       = normalized.width ?? width;
  const mark       = Array.from(normalized.char ?? "-")[0] ?? "-";

  assertPositiveWidth(size, "Divider width");

  if (!normalized.text) {
    return mark.repeat(size);
  }

  return formatTextWithFill(normalized.text, size, mark, normalized.align ?? "center");
}

export function truncateText(value: string, width: number, ellipsis = "..."): string {
  assertPositiveWidth(width, "Text width");

  const chars = Array.from(value);

  if (chars.length <= width) {
    return value;
  }

  const suffix = Array.from(ellipsis).slice(0, width).join("");
  const keep   = Math.max(0, width - charCount(suffix));

  return `${chars.slice(0, keep).join("")}${suffix}`;
}

export function wrapText(
  value: string,
  width: number,
  options: { indent?: number; breakWords?: boolean } = {}
): string[] {
  assertPositiveWidth(width, "Wrap width");

  const indent     = Math.max(0, options.indent ?? 0);
  const breakWords = options.breakWords ?? true;
  const lines      = String(value)
    .split(/\r?\n/)
    .flatMap((paragraph, index) => wrapParagraph(paragraph, width, index === 0 ? 0 : indent, indent, breakWords));

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

export function charCount(value: string): number {
  return Array.from(value).length;
}

function wrapParagraph(
  paragraph: string,
  width: number,
  firstIndent: number,
  nextIndent: number,
  breakWords: boolean
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
      if (charCount(word) > limit && breakWords) {
        const pieces = splitWord(word, limit);

        lines.push(`${prefix}${pieces[0]}`);
        lines.push(...pieces.slice(1, -1).map((piece) => `${" ".repeat(nextIndent)}${piece}`));
        current = pieces.at(-1) ?? "";
        indent  = nextIndent;
        continue;
      }

      current = word;
      continue;
    }

    if (charCount(`${current} ${word}`) <= limit) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(`${prefix}${current}`);
    indent  = nextIndent;

    if (charCount(word) > Math.max(1, width - indent) && breakWords) {
      const pieces = splitWord(word, Math.max(1, width - indent));

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

function splitWord(value: string, width: number): string[] {
  const chars  = Array.from(value);
  const pieces = [];

  for (let index = 0; index < chars.length; index += width) {
    pieces.push(chars.slice(index, index + width).join(""));
  }

  return pieces;
}

function formatTextWithFill(value: string, width: number, fill: string, align: TextAlign): string {
  const text      = truncateText(value, width, "");
  const remaining = Math.max(0, width - charCount(text));

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
