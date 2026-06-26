#!/usr/bin/env node

const {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync
} = require("node:fs");
const { get }                                          = require("node:https");
const { dirname, join, resolve }                       = require("node:path");
const { spawnSync }                                    = require("node:child_process");

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

const VCVARS_ARCH = {
  x64:   "x64",
  ia32:  "x86",
  arm64: "x64_arm64"
};

const NODE_LIB_ARCH = {
  x64:   "x64",
  ia32:  "x86",
  arm64: "arm64"
};

const packageDir = resolve(__dirname, "..");
const arch       = process.argv[2];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  // Argument validation

  if (!SUPPORTED_ARCHES.has(arch)) {
    console.error("Usage: node scripts/prebuild-winspool.cjs <x64|ia32|arm64>");
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
    printVisualStudioHelp(arch, requiredComponents);
    process.exit(1);
  }

  const vcvarsPath = join(visualStudioPath, "VC", "Auxiliary", "Build", "vcvarsall.bat");

  if (!existsSync(vcvarsPath)) {
    throw new Error(`Visual Studio vcvarsall.bat was not found: ${vcvarsPath}`);
  }

  console.log(`Using Visual Studio: ${visualStudioPath}`);

  // Node build inputs

  const includeDir  = await ensureNodeHeaders();
  const nodeLibPath = await ensureNodeLib(arch);

  // Native build execution

  buildNativeAddon({
    arch,
    includeDir,
    nodeLibPath,
    vcvarsPath
  });
}

async function ensureNodeHeaders() {
  const cacheDir   = getNodeCacheDir();
  const extractDir = join(cacheDir, `node-v${TARGET_NODE_VERSION}`);
  const includeDir = join(extractDir, "include", "node");
  const headerPath = join(includeDir, "node_api.h");

  if (existsSync(headerPath)) {
    return includeDir;
  }

  mkdirSync(cacheDir, { recursive: true });

  const archivePath = join(cacheDir, `node-v${TARGET_NODE_VERSION}-headers.tar.gz`);
  const archiveUrl  = getNodeDownloadUrl(`node-v${TARGET_NODE_VERSION}-headers.tar.gz`);

  await downloadFile(archiveUrl, archivePath);

  const result = spawnSync("tar", ["-xzf", archivePath, "-C", cacheDir], {
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error("Node header extraction failed");
  }

  if (!existsSync(headerPath)) {
    throw new Error(`Node headers were not found after extraction: ${headerPath}`);
  }

  return includeDir;
}

async function ensureNodeLib(targetArch) {
  const cacheDir    = getNodeCacheDir();
  const nodeLibArch = NODE_LIB_ARCH[targetArch];
  const nodeLibDir  = join(cacheDir, `win-${nodeLibArch}`);
  const nodeLibPath = join(nodeLibDir, "node.lib");

  if (existsSync(nodeLibPath)) {
    return nodeLibPath;
  }

  mkdirSync(nodeLibDir, { recursive: true });

  const nodeLibUrl = getNodeDownloadUrl(`win-${nodeLibArch}/node.lib`);

  await downloadFile(nodeLibUrl, nodeLibPath);

  return nodeLibPath;
}

function getNodeCacheDir() {
  return join(packageDir, ".native-cache", `node-v${TARGET_NODE_VERSION}`);
}

function getNodeDownloadUrl(filePath) {
  return `https://nodejs.org/download/release/v${TARGET_NODE_VERSION}/${filePath}`;
}

function downloadFile(url, targetPath) {
  if (existsSync(targetPath)) {
    return Promise.resolve();
  }

  mkdirSync(dirname(targetPath), { recursive: true });

  return new Promise((resolvePromise, rejectPromise) => {
    const request = get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        downloadFile(response.headers.location, targetPath)
          .then(resolvePromise)
          .catch(rejectPromise);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        rejectPromise(new Error(`Download failed ${response.statusCode}: ${url}`));
        return;
      }

      const file = createWriteStream(targetPath);

      response.pipe(file);
      file.on("finish", () => {
        file.close(resolvePromise);
      });
      file.on("error", rejectPromise);
    });

    request.on("error", rejectPromise);
  });
}

function buildNativeAddon(options) {
  const buildDir       = join(packageDir, "build", `win32-${options.arch}`);
  const outputDir      = join(packageDir, "prebuilds", `win32-${options.arch}`);
  const sourcePath     = join(packageDir, "native", "src", "winspool.cc");
  const hookSourcePath = join(packageDir, "native", "src", "win_delay_load_hook.cc");
  const outputPath     = join(outputDir, "@node-printer+winspool.node");
  const objectPath     = join(buildDir, "winspool.obj");
  const hookObjectPath = join(buildDir, "win_delay_load_hook.obj");
  const importLibPath  = join(buildDir, "winspool.lib");
  const commandPath    = join(buildDir, `build-${options.arch}.cmd`);
  const vcvarsArgument = VCVARS_ARCH[options.arch];

  rmSync(buildDir, { force: true, recursive: true });
  mkdirSync(buildDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const compileCommand = [
    "cl",
    "/nologo",
    "/EHsc",
    "/std:c++17",
    "/utf-8",
    "/DNAPI_VERSION=3",
    quoteArg(`/I${options.includeDir}`),
    quoteArg(`/Fo${objectPath}`),
    "/c",
    quoteArg(sourcePath)
  ].join(" ");

  const compileHookCommand = [
    "cl",
    "/nologo",
    "/EHsc",
    "/std:c++17",
    "/utf-8",
    quoteArg(`/I${options.includeDir}`),
    quoteArg(`/Fo${hookObjectPath}`),
    "/c",
    quoteArg(hookSourcePath)
  ].join(" ");

  const linkCommand = [
    "link",
    "/NOLOGO",
    "/DLL",
    "/DELAYLOAD:node.exe",
    quoteArg(`/OUT:${outputPath}`),
    quoteArg(`/IMPLIB:${importLibPath}`),
    quoteArg(objectPath),
    quoteArg(hookObjectPath),
    quoteArg(options.nodeLibPath),
    "Winspool.lib",
    "Gdi32.lib",
    "delayimp.lib"
  ].join(" ");

  const commandLines = [
    "@echo off",
    `call ${quoteArg(options.vcvarsPath)} ${vcvarsArgument}`,
    "if errorlevel 1 exit /b %errorlevel%",
    compileCommand,
    "if errorlevel 1 exit /b %errorlevel%",
    compileHookCommand,
    "if errorlevel 1 exit /b %errorlevel%",
    linkCommand
  ];

  writeFileSync(commandPath, `${commandLines.join("\r\n")}\r\n`);

  const result = spawnSync("cmd.exe", ["/d", "/c", commandPath], {
    cwd  : packageDir,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function quoteArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

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

function printVisualStudioHelp(targetArch, requiredComponents) {
  const instances        = listVisualStudioInstances();
  const modifyTargetPath = chooseModifyTarget(instances);

  console.error(`Visual Studio with required C++ components was not found for ${targetArch}`);
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
