#!/usr/bin/env node

const { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");

const packageDir         = resolve(__dirname, "..");
const serialportRoot     = dirname(require.resolve("@serialport/bindings-cpp/package.json"));
const serialportPrebuild = join(serialportRoot, "prebuilds");

removeExistingSerialPrebuilds();

for (const architecture of readdirSync(serialportPrebuild, { withFileTypes: true })) {
  if (!architecture.isDirectory()) {
    continue;
  }

  const sourceDirectory = join(serialportPrebuild, architecture.name);

  for (const file of readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith(".node")) {
      continue;
    }

    const targetName = getTargetName(architecture.name, file.name);
    const sourcePath = join(sourceDirectory, file.name);
    const targetPath = join(packageDir, "prebuilds", architecture.name, targetName);

    if (!existsSync(sourcePath)) {
      console.error(`Serialport prebuild was not found: ${sourcePath}`);
      process.exit(1);
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function removeExistingSerialPrebuilds() {
  const prebuildDir = join(packageDir, "prebuilds");

  if (!existsSync(prebuildDir)) {
    return;
  }

  for (const architecture of readdirSync(prebuildDir, { withFileTypes: true })) {
    if (!architecture.isDirectory()) {
      continue;
    }

    const architectureDir = join(prebuildDir, architecture.name);

    for (const file of readdirSync(architectureDir, { withFileTypes: true })) {
      if (file.isFile() && file.name.startsWith("@node-printer+serialport") && file.name.endsWith(".node")) {
        unlinkSync(join(architectureDir, file.name));
      }
    }
  }
}

function getTargetName(architecture, sourceName) {
  if (architecture.startsWith("win32-")) {
    return "@node-printer+serialport.node";
  }

  return sourceName.replace("@serialport+bindings-cpp", "@node-printer+serialport");
}
