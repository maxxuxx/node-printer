#!/usr/bin/env node

const { existsSync } = require("node:fs");
const { join }       = require("node:path");
const { spawnSync }  = require("node:child_process");

const TARGET_NODE_VERSION = "20.0.0";
const SUPPORTED_ARCHES    = new Set(["x64", "ia32", "arm64"]);

const ARCH_COMPONENTS = {
  x64:   ["Microsoft.VisualStudio.Component.VC.Tools.x86.x64"],
  ia32:  ["Microsoft.VisualStudio.Component.VC.Tools.x86.x64"],
  arm64: [
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
    "Microsoft.VisualStudio.Component.VC.Tools.ARM64"
  ]
};

const arch = process.argv[2];

// Argument validation

if (!SUPPORTED_ARCHES.has(arch)) {
  console.error("Usage: node scripts/prebuild.cjs <x64|ia32|arm64>");
  process.exit(1);
}

if (process.platform !== "win32") {
  console.error("Winspool prebuilds must be created on Windows");
  process.exit(1);
}

// Visual Studio discovery

const requiredComponents = ARCH_COMPONENTS[arch];
const visualStudioPath   = findVisualStudio(requiredComponents);

if (!visualStudioPath) {
  const instances        = listVisualStudioInstances();
  const modifyTargetPath = chooseModifyTarget(instances);

  console.error(`Visual Studio with required C++ components was not found for ${arch}`);
  console.error("");
  console.error("Install or modify Visual Studio with these components");
  for (const component of requiredComponents) {
    console.error(`- ${component}`);
  }
  console.error("");
  if (modifyTargetPath) {
    console.error("Modify an existing Visual Studio install");
    console.error(createModifyCommand(modifyTargetPath, requiredComponents));
    console.error("");
    console.error("Verify after modify");
    console.error(createVerifyCommand(requiredComponents));
    console.error("");
  }
  console.error("Fresh Build Tools install");
  console.error('winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended"');
  process.exit(1);
}

console.log(`Using Visual Studio: ${visualStudioPath}`);

// Prebuild execution

const result = spawnSync(process.execPath, [
  require.resolve("prebuildify/bin.js"),
  "--napi",
  "--target",
  TARGET_NODE_VERSION,
  "--platform",
  "win32",
  "--arch",
  arch
], {
  env: {
    ...process.env,
    GYP_MSVS_VERSION:          visualStudioPath,
    npm_config_msvs_version:   visualStudioPath,
    npm_config_target_arch:    arch,
    npm_config_target_platform: "win32"
  },
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function findVisualStudio(components) {
  const instances = listVisualStudioInstances(components);
  const instance  = chooseBuildTarget(instances);

  return instance?.installationPath || null;
}

function listVisualStudioInstances(components = []) {
  const args = ["-all", "-products", "*"];

  for (const component of components) {
    args.push("-requires", component);
  }

  args.push("-format", "json");

  const result = spawnSync(getVswherePath(), args, {
    encoding: "utf8"
  });

  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  try {
    const instances = JSON.parse(result.stdout);

    return Array.isArray(instances) ? instances : [];
  } catch {
    return [];
  }
}

function chooseBuildTarget(instances) {
  return instances
    .filter((instance) => instance.installationPath)
    .sort(compareVisualStudioInstances)[0] || null;
}

function chooseModifyTarget(instances) {
  const target = chooseBuildTarget(instances);

  return target?.installationPath || null;
}

function compareVisualStudioInstances(left, right) {
  const buildToolsPriority = Number(isBuildTools(right)) - Number(isBuildTools(left));

  return buildToolsPriority || compareVersions(right.installationVersion, left.installationVersion);
}

function isBuildTools(instance) {
  return String(instance.productId || "").includes("BuildTools");
}

function compareVersions(leftVersion = "", rightVersion = "") {
  const leftParts  = String(leftVersion).split(".").map(Number);
  const rightParts = String(rightVersion).split(".").map(Number);
  const length     = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function createModifyCommand(installPath, components) {
  const setupPath = getSetupPath();
  const addArgs   = components.map((component) => `--add ${component}`).join(" ");

  return `& "${setupPath}" modify --installPath "${installPath}" ${addArgs} --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended --passive --norestart`;
}

function createVerifyCommand(components) {
  const requireArgs = components.map((component) => `-requires ${component}`).join(" ");

  return `& "${getVswherePath()}" -all -products * ${requireArgs} -property installationPath`;
}

function getSetupPath() {
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  return join(programFilesX86, "Microsoft Visual Studio", "Installer", "setup.exe");
}

function getVswherePath() {
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const vswherePath     = join(programFilesX86, "Microsoft Visual Studio", "Installer", "vswhere.exe");

  return existsSync(vswherePath) ? vswherePath : "vswhere";
}
