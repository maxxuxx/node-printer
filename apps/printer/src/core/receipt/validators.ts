import { PrinterError } from "../errors.js";
import { throwEncodingError } from "./errors.js";

// Encoding validation

export function assertPattern(value: string, pattern: RegExp, message: string): void {
  if (!pattern.test(value)) {
    throwEncodingError(message);
  }
}

export function assertAscii(value: string, name: string): void {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    if (code < 0x20 || code > 0x7e) {
      throwEncodingError(`${name} must contain printable ASCII only`);
    }
  }
}

export function assertScale(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw new PrinterError({
      code   : "ERR_ENCODING_FAILED",
      message: `Text size ${name} must be an integer between 1 and 8`
    });
  }
}

export function assertIntegerRange(
  value: number,
  min: number,
  max: number,
  name: string
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throwEncodingError(`${name} must be an integer between ${min} and ${max}`);
  }
}
