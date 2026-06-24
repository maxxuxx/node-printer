#!/usr/bin/env node

const { existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const packageDir = resolve(__dirname, "..");

const REQUIRED_PREBUILDS = [
  ["win32-x64", "@node-printer+serialport.node"],
  ["win32-x64", "@node-printer+winspool.node"],
  ["win32-ia32", "@node-printer+serialport.node"],
  ["win32-ia32", "@node-printer+winspool.node"],
  ["win32-arm64", "@node-printer+serialport.node"],
  ["win32-arm64", "@node-printer+winspool.node"]
];

const missing = REQUIRED_PREBUILDS
  .map(([architecture, fileName]) => join("prebuilds", architecture, fileName))
  .filter((filePath) => !existsSync(join(packageDir, filePath)));

if (missing.length > 0) {
  console.error(["Missing native prebuilds", ...missing].join("\n"));
  process.exit(1);
}
