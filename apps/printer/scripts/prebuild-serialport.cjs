#!/usr/bin/env node

const { copyFileSync, existsSync, mkdirSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");

const packageDir         = resolve(__dirname, "..");
const serialportRoot     = dirname(require.resolve("@serialport/bindings-cpp/package.json"));
const serialportPrebuild = join(serialportRoot, "prebuilds");

const PREBUILD_COPIES = [
  {
    source: join("win32-x64", "@serialport+bindings-cpp.node"),
    target: join("win32-x64", "@node-printer+serialport.node")
  },
  {
    source: join("win32-ia32", "@serialport+bindings-cpp.node"),
    target: join("win32-ia32", "@node-printer+serialport.node")
  },
  {
    source: join("win32-arm64", "@serialport+bindings-cpp.armv8.node"),
    target: join("win32-arm64", "@node-printer+serialport.node")
  }
];

for (const copy of PREBUILD_COPIES) {
  const sourcePath = join(serialportPrebuild, copy.source);
  const targetPath = join(packageDir, "prebuilds", copy.target);

  if (!existsSync(sourcePath)) {
    console.error(`Serialport prebuild was not found: ${sourcePath}`);
    process.exit(1);
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}
