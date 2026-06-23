import { PrinterError } from "../errors.js";

export function throwEncodingError(message: string): never {
  throw new PrinterError({
    code: "ERR_ENCODING_FAILED",
    message
  });
}
