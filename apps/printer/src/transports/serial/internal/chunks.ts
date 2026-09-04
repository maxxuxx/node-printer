export function* serialChunks(data: Uint8Array, chunkSize: number): Generator<Uint8Array> {
  const size = Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : 500;

  for (let offset = 0; offset < data.byteLength; offset += size) {
    yield data.subarray(offset, offset + size);
  }
}
