#!/usr/bin/env node

const { cpSync, existsSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");

const packageDir = resolve(__dirname, "..");
const sourceDir  = resolve(packageDir, "..", "winspool", "prebuilds");
const targetDir  = join(packageDir, "prebuilds");

if (!existsSync(sourceDir)) {
  throw new Error(`Missing winspool prebuilds: ${sourceDir}`);
}

rmSync(targetDir, { force: true, recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });
