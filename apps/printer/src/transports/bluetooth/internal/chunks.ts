export function* bluetoothChunks(
  data: Uint8Array,
  requestedSize: number | undefined,
  maximumSize: number | undefined
): Generator<Uint8Array> {
  const size = normalizeChunkSize(requestedSize, maximumSize);

  for (let offset = 0; offset < data.byteLength; offset += size) {
    yield data.subarray(offset, offset + size);
  }
}

function normalizeChunkSize(requestedSize?: number, maximumSize?: number): number {
  const candidates = [requestedSize, maximumSize]
    .filter((value): value is number => Number.isInteger(value) && (value ?? 0) > 0);

  return candidates.length > 0 ? Math.min(...candidates) : 180;
}
