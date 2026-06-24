#!/usr/bin/env node

const { existsSync, readFileSync } = require("node:fs");
const { join, relative, resolve } = require("node:path");

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

// Windows Node-API compatibility

const badWindowsImports = REQUIRED_PREBUILDS
  .filter(([architecture]) => architecture.startsWith("win32-"))
  .map(([architecture, fileName]) => join(packageDir, "prebuilds", architecture, fileName))
  .filter((filePath) => readWindowsImports(filePath).imports.includes("node.exe"));

if (badWindowsImports.length > 0) {
  console.error([
    "Windows prebuilds must delay-load node.exe for Electron compatibility",
    ...badWindowsImports.map((filePath) => relative(packageDir, filePath))
  ].join("\n"));
  process.exit(1);
}

function readWindowsImports(filePath) {
  const file           = readFileSync(filePath);
  const peOffset       = file.readUInt32LE(0x3c);
  const optionalOffset = peOffset + 24;
  const magic          = file.readUInt16LE(optionalOffset);
  const sectionCount   = file.readUInt16LE(peOffset + 6);
  const optionalSize   = file.readUInt16LE(peOffset + 20);
  const dataDirectory  = optionalOffset + (magic === 0x20b ? 112 : 96);
  const sectionOffset  = optionalOffset + optionalSize;
  const sections       = [];

  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionOffset + index * 40;

    sections.push({
      virtualSize   : file.readUInt32LE(offset + 8),
      virtualAddress: file.readUInt32LE(offset + 12),
      rawSize       : file.readUInt32LE(offset + 16),
      rawPointer    : file.readUInt32LE(offset + 20)
    });
  }

  const readDirectory = (index) => {
    const rva    = file.readUInt32LE(dataDirectory + index * 8);
    const offset = rvaToOffset(sections, rva);

    if (!rva || offset === null) {
      return [];
    }

    return readImportNames(file, sections, offset);
  };

  return {
    imports: readDirectory(1)
  };
}

function readImportNames(file, sections, offset) {
  const names = [];

  for (let cursor = offset; cursor + 20 <= file.length; cursor += 20) {
    const nameRva = file.readUInt32LE(cursor + 12);

    if (!nameRva) {
      break;
    }

    const nameOffset = rvaToOffset(sections, nameRva);
    if (nameOffset !== null) {
      names.push(readCString(file, nameOffset));
    }
  }

  return names;
}

function rvaToOffset(sections, rva) {
  const section = sections.find((item) => {
    const size = Math.max(item.virtualSize, item.rawSize);

    return rva >= item.virtualAddress && rva < item.virtualAddress + size;
  });

  return section ? section.rawPointer + (rva - section.virtualAddress) : null;
}

function readCString(file, offset) {
  let end = offset;

  while (end < file.length && file[end] !== 0) {
    end += 1;
  }

  return file.toString("ascii", offset, end);
}
