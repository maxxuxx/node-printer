import { assertAscii, assertIntegerRange } from "./validators.js";
import { throwEncodingError } from "./errors.js";

// Byte helpers

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let   offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

export function bytePair(value: number, name: string): [number, number] {
  assertIntegerRange(value, 0, 65535, `${name} length`);

  return [value & 0xff, value >> 8];
}

export function normalizeByteArray(value: Uint8Array | number[], name: string): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (!Array.isArray(value)) {
    throwEncodingError(`${name} must be a byte array`);
  }

  for (const item of value) {
    assertIntegerRange(item, 0, 255, name);
  }

  return Uint8Array.from(value);
}

export function encodeAsciiBytes(value: string, name: string): Uint8Array {
  assertAscii(value, name);

  return Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0)));
}

export function encodeAscii(value: string): Uint8Array {
  return Uint8Array.from(Array.from(value, (char) => {
    const code = char.codePointAt(0) ?? 0x3f;

    return code <= 0x7f ? code : 0x3f;
  }));
}
