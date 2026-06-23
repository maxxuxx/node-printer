import { spawn } from "node:child_process";

import type { CupsCommandRequest, CupsCommandResult, CupsCommandRunner } from "../types.js";
import { STDIN_CHUNK_SIZE } from "./defaults.js";
import { assertCommandSucceeded, normalizeCupsError } from "./errors.js";

// Command runner

export class NodeCupsCommandRunner implements CupsCommandRunner {
  run(request: CupsCommandRequest): Promise<CupsCommandResult> {
    return new Promise((resolve, reject) => {
      const child        = spawn(request.command, request.args, { stdio: ["pipe", "pipe", "pipe"] });
      const stdoutChunks : Buffer[] = [];
      const stderrChunks : Buffer[] = [];
      let timedOut       = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, request.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      child.stdin.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.once("close", (exitCode, signal) => {
        clearTimeout(timeout);

        resolve({
          stdout  : Buffer.concat(stdoutChunks).toString("utf8"),
          stderr  : Buffer.concat(stderrChunks).toString("utf8"),
          exitCode,
          signal,
          timedOut
        });
      });

      if (request.input) {
        writeStdinChunks(child.stdin, request.input).catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
        return;
      }

      child.stdin.end();
    });
  }
}

export async function runCupsCommand(
  runner: CupsCommandRunner,
  request: CupsCommandRequest,
  label: string
): Promise<CupsCommandResult> {
  try {
    const result = await runner.run(request);

    assertCommandSucceeded(label, result, request.timeoutMs);

    return result;
  } catch (error) {
    throw normalizeCupsError(error, label);
  }
}

function writeStdinChunks(stdin: NodeJS.WritableStream, input: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    let offset   = 0;

    const writeMore = (): void => {
      while (offset < buffer.byteLength) {
        const end   = Math.min(offset + STDIN_CHUNK_SIZE, buffer.byteLength);
        const chunk = buffer.subarray(offset, end);

        offset = end;

        if (!stdin.write(chunk)) {
          stdin.once("drain", writeMore);
          return;
        }
      }

      stdin.end(resolve);
    };

    stdin.once("error", reject);

    writeMore();
  });
}
