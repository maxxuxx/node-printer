import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrinterError } from "#core";

import type { WinspoolBinding } from "./types.js";

const require = createRequire(import.meta.url);
const SUPPORTED_PREBUILD_NAMES = [
  "@node-printer+winspool.node",
  "node.napi.node"
];

// Platform guards

// Winspool API가 Windows에서만 동작하도록 진입점을 막음
export function assertWindows(platform: NodeJS.Platform = process.platform): void {
  // Windows가 아닌 환경은 native binding을 시도하지 않고 명시 오류로 중단함
  if (platform !== "win32") {
    throw new PrinterError({
      code: "ERR_UNSUPPORTED_PLATFORM",
      message: "Winspool printing is only supported on Windows"
    });
  }
}

// Binding loading

export function loadWinspoolBinding(): WinspoolBinding {
  assertWindows();

  const prebuildPath = findWinspoolPrebuild();

  if (!prebuildPath) {
    throw new PrinterError({
      code: "ERR_NATIVE_MODULE_UNAVAILABLE",
      message: `Winspool prebuild is not available for ${process.platform}-${process.arch}`
    });
  }

  return require(prebuildPath) as WinspoolBinding;
}

// Prebuild resolution

// 현재 platform/arch 디렉터리의 prebuild만 로드하고 source build 산출물은 보지 않음
function findWinspoolPrebuild(): string | null {
  const prebuildDirectory = resolve(
    getPackageRoot(),
    "prebuilds",
    `${process.platform}-${process.arch}`
  );

  let fileNames: string[];

  try {
    fileNames = readdirSync(prebuildDirectory);
  } catch {
    return null;
  }

  const binaryName = fileNames
    .filter((fileName) => fileName.endsWith(".node"))
    .sort(comparePrebuildNames)[0];

  return binaryName ? resolve(prebuildDirectory, binaryName) : null;
}

// 현재 빌드 이름을 먼저 고르고, 다른 .node 이름은 안정적인 순서로 선택함
function comparePrebuildNames(left: string, right: string): number {
  return getPrebuildPriority(left) - getPrebuildPriority(right) || left.localeCompare(right);
}

function getPrebuildPriority(fileName: string): number {
  const index = SUPPORTED_PREBUILD_NAMES.indexOf(fileName);

  return index === -1 ? SUPPORTED_PREBUILD_NAMES.length : index;
}

// ESM 파일 위치를 기준으로 패키지 루트를 계산함
function getPackageRoot(): string {
  return resolveWinspoolPackageRoot(dirname(fileURLToPath(import.meta.url)));
}

export function resolveWinspoolPackageRoot(currentDir: string): string {
  const bundledPackageRoot = resolve(currentDir, "..");
  const sourcePackageRoot  = resolve(currentDir, "..", "..", "..");

  return isSourceWinspoolDirectory(currentDir) ? sourcePackageRoot : bundledPackageRoot;
}

function isSourceWinspoolDirectory(currentDir: string): boolean {
  return currentDir.replace(/\\/g, "/").endsWith("/src/transports/winspool");
}
