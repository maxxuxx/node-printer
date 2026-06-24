#!/usr/bin/env node

const { existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const packageDir = resolve(__dirname, "..");

const REQUIRED_PREBUILDS = [
  ["android-arm", "@node-printer+serialport.armv7.node"],
  ["android-arm64", "@node-printer+serialport.armv8.node"],
  ["darwin-x64+arm64", "@node-printer+serialport.node"],
  ["linux-arm", "@node-printer+serialport.armv6.glibc.node"],
  ["linux-arm", "@node-printer+serialport.armv7.glibc.node"],
  ["linux-arm", "@node-printer+serialport.armv7.musl.node"],
  ["linux-arm64", "@node-printer+serialport.armv8.glibc.node"],
  ["linux-arm64", "@node-printer+serialport.armv8.musl.node"],
  ["linux-x64", "@node-printer+serialport.glibc.node"],
  ["linux-x64", "@node-printer+serialport.musl.node"],
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
