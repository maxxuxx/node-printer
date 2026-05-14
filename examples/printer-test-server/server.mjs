import { createReadStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { release } from "node:os";
import { delimiter, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 경로 설정
const rootDir = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const packageEntry = join(rootDir, "packages/printer/dist/index.js");
const publicDir = join(rootDir, "examples/printer-test-server/public");
const winspoolPrebuildDir = join(
  rootDir,
  "packages/printer-winspool/prebuilds",
  `${process.platform}-${process.arch}`
);

// 서버 설정
const port = Number.parseInt(process.env.PORT ?? "3007", 10);

// 정적 파일 콘텐츠 타입
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

// 패키지 로딩
let printerPackagePromise;

// 빌드된 프린터 패키지를 한 번만 불러오고 실패하면 다음 요청에서 재시도
async function loadPrinterPackage() {
  if (!printerPackagePromise) {
    printerPackagePromise = access(packageEntry)
      .then(() => import(pathToFileURL(packageEntry).href))
      .catch((error) => {
        printerPackagePromise = undefined;
        throw createBuildRequiredError(error);
      });
  }

  return printerPackagePromise;
}

// 빌드 누락 상태를 API 오류 응답에 맞는 전용 오류로 변환
function createBuildRequiredError(cause) {
  const error = new Error("Build required before using the printer test server APIs");

  error.name = "BuildRequiredError";
  error.code = "ERR_BUILD_REQUIRED";
  error.retryable = false;
  error.cause = cause;
  error.causeMessage = `Missing ${packageEntry}`;

  return error;
}

// HTTP 서버
const server = createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 400, errorBody(new Error("Request URL is missing")));
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    // API 요청은 라우터로 넘기고 그 외 요청은 public 정적 파일로 처리
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, errorBody(error));
  }
});

server.listen(port, () => {
  console.log(`Printer test server listening on http://localhost:${port}`);

  access(packageEntry).catch(() => {
    console.log(`Build required: run npm exec --yes --package pnpm@11.1.1 -- pnpm build`);
  });
});

// API 라우트
// HTTP 메서드와 경로 조합으로 테스트 서버 API를 분기
async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    await handleHealth(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/capabilities") {
    sendJson(response, 200, {
      ok: true,
      capabilities: await getCapabilities(),
      runtime: getRuntimeInfo()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/serial/ports") {
    const { listSerialPorts } = await loadPrinterPackage();
    const ports = await listSerialPorts();

    sendJson(response, 200, {
      ok: true,
      ports: withSerialPortHints(ports),
      runtime: getRuntimeInfo()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/network/printers") {
    sendJson(response, 200, {
      ok: true,
      printers: getNetworkPrinterPresets(),
      runtime: getRuntimeInfo()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/cups/printers") {
    // CUPS 실행 조건이 맞지 않으면 빈 목록과 unsupported 상태를 반환
    if ((await getCupsCapability()) !== "ready") {
      sendJson(response, 200, {
        ok: true,
        unsupported: true,
        printers: [],
        runtime: getRuntimeInfo(),
        message: "CUPS printer listing requires macOS or Linux with lpstat available"
      });
      return;
    }

    const { listCupsPrinters } = await loadPrinterPackage();
    const printers = await listCupsPrinters();

    sendJson(response, 200, { ok: true, printers, runtime: getRuntimeInfo() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/winspool/printers") {
    // Windows Node가 아니면 winspool 목록 조회를 지원하지 않음으로 응답
    if (process.platform !== "win32") {
      sendJson(response, 200, {
        ok: true,
        unsupported: true,
        printers: [],
        runtime: getRuntimeInfo(),
        message: "Winspool printer listing requires the test server to run in Windows Node"
      });
      return;
    }

    const { listWinspoolPrinters } = await loadPrinterPackage();
    const printers = await listWinspoolPrinters();

    sendJson(response, 200, { ok: true, printers, runtime: getRuntimeInfo() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/receipt/encode") {
    const body = await readJsonBody(request);
    const { receipt } = await buildReceipt(body);
    const receiptBytes = Array.from(receipt);
    const receiptHex = Buffer.from(receipt).toString("hex");

    sendJson(response, 200, {
      ok: true,
      byteLength: receipt.byteLength,
      hex: receiptHex,
      bytes: receiptBytes
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/print") {
    const body = await readJsonBody(request);

    await handlePrint(response, body);
    return;
  }

  sendJson(response, 404, errorBody(new Error("API route not found")));
}

async function handleHealth(response) {
  const packageReady = await access(packageEntry)
    .then(() => true)
    .catch(() => false);

  sendJson(response, 200, {
    ok: packageReady,
    packageEntry,
    capabilities: await getCapabilities(packageReady),
    runtime: getRuntimeInfo()
  });
}

// 대상 프린터와 영수증 입력을 정규화한 뒤 매수만큼 순차 출력
async function handlePrint(response, body) {
  const target = body?.target;

  if (!target?.type) {
    throw createBadRequestError("Printer target is required");
  }

  if (target.type === "winspool" && process.platform !== "win32") {
    throw createBadRequestError(
      "Winspool printing requires the test server to run in Windows Node"
    );
  }

  const { createPrinter } = await loadPrinterPackage();
  const receipt = await readReceiptInput(body?.receipt);
  const copies = normalizeCopies(body?.copies);
  const printer = createPrinter(target);
  const results = [];

  try {
    for (let copy = 1; copy <= copies; copy += 1) {
      const result = await printer.print(receipt);

      results.push({
        copy,
        ...result
      });
    }

    await printer.close?.();

    sendJson(response, 200, {
      ok: true,
      copies,
      result: results.at(-1),
      results
    });
  } catch (error) {
    try {
      await printer.close?.();
    } catch {
      // 호출자에게 원래 출력 오류를 보여주기 위해 close 오류는 숨김
    }

    throw error;
  }
}

// 빌드와 플랫폼 조건을 합쳐 UI에 노출할 기능 상태를 계산
async function getCapabilities(packageReady) {
  const ready =
    packageReady ??
    (await access(packageEntry)
      .then(() => true)
      .catch(() => false));

  return {
    core: ready ? "ready" : "build_required",
    serial: ready ? "ready" : "build_required",
    network: ready ? "ready" : "build_required",
    cups: ready ? await getCupsCapability() : "build_required",
    winspool: ready ? await getWinspoolCapability() : "build_required"
  };
}

// lpstat 사용 가능 여부로 CUPS 목록 조회 가능성을 판단
async function getCupsCapability() {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    return "unsupported";
  }

  return (await isCommandAvailable("lpstat")) ? "ready" : "unsupported";
}

// Windows prebuild 존재 여부로 winspool 준비 상태를 판단
async function getWinspoolCapability() {
  if (process.platform === "win32") {
    const prebuildReady = await readdir(winspoolPrebuildDir)
      .then((fileNames) => fileNames.some((fileName) => fileName.endsWith(".node")))
      .catch(() => false);

    return prebuildReady ? "ready" : "prebuild_required";
  }

  return "unsupported";
}

function getRuntimeInfo() {
  return {
    platform: process.platform,
    isWsl: isWsl(),
    release: release()
  };
}

function isWsl() {
  return Boolean(process.env.WSL_DISTRO_NAME) || release().toLowerCase().includes("microsoft");
}

// PATH 후보를 순회해 외부 명령 실행 가능 여부를 확인
async function isCommandAvailable(command) {
  const paths = (process.env.PATH ?? "").split(delimiter).filter(Boolean);

  for (const path of paths) {
    const commandPath = join(path, command);
    const available = await access(commandPath)
      .then(() => true)
      .catch(() => false);

    if (available) {
      return true;
    }
  }

  return false;
}

// WSL 환경에서 Windows COM 포트 후보를 serial 목록에 보강
function withSerialPortHints(ports) {
  if (!isWsl()) {
    return ports;
  }

  const comNumbers = [1, 3, 9];
  const knownMappings = new Map(
    comNumbers.map((comNumber) => [`/dev/ttyS${comNumber - 1}`, `Windows COM${comNumber} via WSL`])
  );
  const mappedPorts = ports.map((port) => ({
    ...port,
    manufacturer: knownMappings.get(port.path) ?? port.manufacturer
  }));
  const existingPaths = new Set(mappedPorts.map((port) => port.path));
  const hints = comNumbers
    .map((comNumber) => ({
      path: `/dev/ttyS${comNumber - 1}`,
      manufacturer: `Windows COM${comNumber} via WSL candidate`
    }))
    .filter((port) => !existingPaths.has(port.path));

  return [...mappedPorts, ...hints];
}

// 환경 변수의 JSON 또는 콤마 문자열을 network preset 목록으로 변환
function getNetworkPrinterPresets() {
  const raw = process.env.PRINTER_NETWORK_TARGETS;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map(normalizeNetworkPrinterPreset).filter(Boolean);
    }
  } catch {
    return raw.split(",").map(parseNetworkPrinterPreset).filter(Boolean);
  }

  return [];
}

// network preset 입력을 UI와 API가 쓰는 공통 형태로 정규화
function normalizeNetworkPrinterPreset(value, index = 0) {
  if (!value || typeof value !== "object" || !value.host) {
    return undefined;
  }

  const port = Number(value.port ?? 9100);

  return {
    id: String(value.id ?? value.host),
    name: String(value.name ?? value.host),
    host: String(value.host),
    port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 9100,
    isDefault: Boolean(value.isDefault ?? index === 0)
  };
}

function parseNetworkPrinterPreset(value, index) {
  const [host, port] = String(value).trim().split(":");

  if (!host) {
    return undefined;
  }

  return normalizeNetworkPrinterPreset(
    {
      host,
      port,
      isDefault: index === 0
    },
    index
  );
}

// 영수증 보조 함수
// 영수증 본문과 예제 옵션을 printer-core receipt 명령으로 조립
async function buildReceipt(input) {
  const { createReceipt } = await loadPrinterPackage();
  const receipt = createReceipt({
    encoding: input?.encoding,
    width: input?.width
  });

  receipt.initialize();

  for (const line of normalizeLines(input?.lines)) {
    if (typeof line === "string") {
      receipt.text(line);
      continue;
    }

    if (Array.isArray(line?.columns)) {
      receipt.row(line.columns);
      continue;
    }

    receipt.text(String(line?.text ?? ""), {
      align: line?.align,
      bold: line?.bold,
      underline: line?.underline
    });
  }

  if (input?.divider) {
    receipt.divider(typeof input.divider === "string" ? input.divider : undefined);
  }

  applyReceiptExamples(receipt, input?.examples);

  if (Number.isInteger(input?.feed)) {
    receipt.feed(input.feed);
  }

  if (input?.cut) {
    receipt.cut(typeof input.cut === "string" ? input.cut : undefined);
  }

  return { receipt: receipt.encode() };
}

// QR barcode image 예제를 가운데 정렬로 추가하고 기본 정렬을 복원
function applyReceiptExamples(receipt, examples) {
  if (!examples || typeof examples !== "object") {
    return;
  }

  if (examples.qr) {
    receipt.align("center");
    receipt.qr(String(examples.qr.data ?? ""), {
      size: toOptionalNumber(examples.qr.size),
      errorCorrection: examples.qr.errorCorrection,
      encoding: examples.qr.encoding,
      fallbackText: examples.qr.fallbackText
    });
    receipt.feed(1);
  }

  if (examples.barcode) {
    receipt.align("center");
    receipt.barcode(String(examples.barcode.data ?? ""), {
      type: examples.barcode.type ?? examples.barcode.format,
      width: toOptionalNumber(examples.barcode.width),
      height: toOptionalNumber(examples.barcode.height),
      hri: examples.barcode.hri,
      fallbackText: examples.barcode.fallbackText
    });
    receipt.feed(1);
  }

  if (examples.image) {
    receipt.align("center");
    receipt.image(
      {
        width: toOptionalNumber(examples.image.width),
        height: toOptionalNumber(examples.image.height),
        data: examples.image.data
      },
      {
        mode: examples.image.mode,
        fallbackText: examples.image.fallbackText
      }
    );
    receipt.feed(1);
  }

  receipt.align("left");
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return Number(value);
}

// 출력 매수를 허용 범위의 정수로 제한
function normalizeCopies(value) {
  const copies = value === undefined ? 1 : Number(value);

  if (!Number.isInteger(copies) || copies < 1 || copies > 100) {
    throw createBadRequestError("Print copies must be an integer between 1 and 100");
  }

  return copies;
}

function normalizeLines(lines) {
  if (Array.isArray(lines)) {
    return lines;
  }

  if (typeof lines === "string") {
    return lines.split(/\r?\n/);
  }

  return [];
}

// 다양한 영수증 입력 형식을 실제 출력 바이트로 변환
async function readReceiptInput(receipt) {
  if (receipt instanceof Uint8Array) {
    return receipt;
  }

  if (Array.isArray(receipt)) {
    return Uint8Array.from(receipt);
  }

  if (Array.isArray(receipt?.bytes)) {
    return Uint8Array.from(receipt.bytes);
  }

  if (typeof receipt?.hex === "string") {
    return Uint8Array.from(Buffer.from(receipt.hex, "hex"));
  }

  if (receipt && typeof receipt === "object") {
    const built = await buildReceipt(receipt);

    return built.receipt;
  }

  throw createBadRequestError("Receipt bytes, hex, or receipt body is required");
}

// 정적 파일
// public 디렉터리 밖 접근을 막고 정적 파일을 스트리밍
async function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(publicDir, decodeURIComponent(requestedPath)));
  const safePath = relative(publicDir, filePath);

  if (safePath.startsWith("..") || safePath === "" || safePath.startsWith("/")) {
    sendJson(response, 403, errorBody(new Error("Static file path is not allowed")));
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      sendJson(response, 404, errorBody(new Error("Static file not found")));
      return;
    }

    response.writeHead(200, {
      "Content-Length": fileStat.size,
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream"
    });

    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, errorBody(new Error("Static file not found")));
  }
}

// 요청과 응답 보조 함수
// 요청 본문을 모아 JSON으로 파싱하고 형식 오류를 400으로 변환
async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw createBadRequestError("Request body must be valid JSON", error);
  }
}

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);

  response.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(payload);
}

function errorBody(error) {
  return {
    ok: false,
    error: serializeError(error)
  };
}

// 에러 객체를 클라이언트가 표시할 수 있는 JSON 형태로 축약
function serializeError(error) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const cause = normalized.cause;
  const body = {
    name: normalized.name,
    code: normalized.code ?? "ERR_TEST_SERVER_FAILED",
    message: normalized.message,
    retryable: normalized.retryable ?? false,
    causeMessage: normalized.causeMessage ?? getCauseMessage(cause)
  };

  if (process.env.NODE_ENV !== "production" && normalized.stack) {
    body.stack = normalized.stack;
  }

  return body;
}

function getCauseMessage(cause) {
  if (!cause) {
    return undefined;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}

function createBadRequestError(message, cause) {
  const error = new Error(message, { cause });

  error.name = "BadRequestError";
  error.code = "ERR_BAD_REQUEST";
  error.retryable = false;

  return error;
}
