<script>
  // 앱 공통 상태와 탭 구성을 모아 관리
  const capabilityNames = ["core", "serial", "network", "cups", "winspool"];
  const tabs            = ["serial", "network", "cups", "winspool"];
  const baudRates       = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

  let activeTab               = "serial";
  let capabilities            = {};
  let runtime                 = {};
  let healthOk                = false;
  let healthDetail            = null;
  let runtimeMessages         = [];
  let encodedReceipt          = null;
  let logs                    = [];
  let selectedLog             = null;
  let copyStatus              = "";
  let logDialog;
  let lastFocusedElement      = null;
  let targetLoaded            = {
    serial  : false,
    network : false,
    cups    : false,
    winspool: false
  };
  let pending                 = {
    status  : false,
    encode  : false,
    print   : false,
    serial  : false,
    network : false,
    cups    : false,
    winspool: false
  };

  // 영수증 본문과 출력 옵션 상태
  let receiptLines     = "테스트 출력\nSERIAL OK";
  let encoding         = "cp949";
  let receiptWidth     = 48;
  let divider          = true;
  let feed             = 3;
  let cut              = true;
  let copies           = 1;

  // QR barcode image 예제 입력 상태
  let qrEnabled        = true;
  let qrData           = "https://example.com/receipt/1001";
  let qrSize           = 6;
  let qrCorrection     = "m";

  let barcodeEnabled   = true;
  let barcodeData      = "880123456789";
  let barcodeType      = "ean13";
  let barcodeHeight    = 80;
  let barcodeWidth     = 3;

  let imageEnabled     = true;
  let imageFile        = null;
  let imageAutoThreshold = true;
  let imageMaxWidth    = 384;
  let imageThreshold   = 220;

  // 출력 대상별 목록과 선택값 상태
  let serialPorts      = [];
  let serialPath       = "";
  let serialInputPath  = "";
  let baudRate         = 9600;
  let dataBits         = 8;
  let stopBits         = 1;
  let parity           = "none";
  let flowControl      = "";

  let networkPrinters  = [];
  let networkPreset    = "";
  let networkHost      = "";
  let networkPort      = 9100;

  let cupsPrinters     = [];
  let cupsName         = "";

  let winspoolPrinters = [];
  let winspoolName     = "";

  // API helper는 HTTP 오류에도 응답 본문을 함께 전달
  async function requestJson(path, options = {}) {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);

      error.status = response.status;
      error.body   = body;
      throw error;
    }

    return body;
  }

  // POST 요청 본문을 JSON 문자열로 보내는 공통 진입점
  function postJson(path, body) {
    return requestJson(path, {
      method: "POST",
      body  : JSON.stringify(body)
    });
  }

  // 표시용 helper는 기능 상태 값을 짧은 배지 표현으로 변환
  function capabilityClass(value) {
    if (value === "ready") return "ok";
    if (value === "unsupported") return "muted";

    return "fail";
  }

  function capabilityLabel(value) {
    if (value === "ready") return "ready";
    if (value === "unsupported") return "off";
    if (value === "prebuild_required") return "prebuild";
    if (value === "build_required") return "build";

    return "unknown";
  }

  // 런타임과 기능 상태를 사람이 읽는 안내 메시지로 축약
  function updateRuntimeMessages(nextRuntime, nextCapabilities) {
    const messages = [];

    if (nextRuntime?.isWsl) {
      messages.push("WSL 실행 중");
    }

    if (nextCapabilities?.winspool === "unsupported") {
      messages.push("Winspool은 Windows Node에서 사용");
    }

    runtimeMessages = messages;
  }

  // 탭 제목 옆에 표시할 대상 목록 개수를 계산
  function getTargetStatus(type) {
    if (type === "serial") return `${serialPorts.length} ports`;
    if (type === "network") return `${networkPrinters.length} presets`;
    if (type === "cups") return `${cupsPrinters.length} printers`;
    if (type === "winspool") return `${winspoolPrinters.length} printers`;

    return "";
  }

  // 로그와 상세 모달 흐름을 한 곳에서 관리
  // 로그 항목은 최신 순으로 80개만 유지
  function addLog(status, title, detail) {
    const log = createLogEntry(status, title, detail);

    logs = [log, ...logs].slice(0, 80);
  }

  // 성공 여부와 오류 요약을 상세 모달에서 바로 볼 수 있게 정규화
  function createLogEntry(status, title, detail) {
    const ok = getResultOk(status, detail);

    return {
      id       : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status,
      title,
      time     : new Date().toLocaleTimeString(),
      ok,
      code     : ok ? undefined : getErrorCode(detail),
      reason   : ok ? undefined : getErrorReason(detail),
      detail
    };
  }

  function getResultOk(status, detail) {
    if (typeof detail?.ok === "boolean") return detail.ok;
    if (typeof detail?.body?.ok === "boolean") return detail.body.ok;

    return status === "success";
  }

  // 여러 오류 응답 형태에서 표시할 코드 값을 우선순위대로 선택
  function getErrorCode(detail) {
    return detail?.body?.error?.code
      || detail?.error?.code
      || detail?.code
      || (detail?.status ? `HTTP ${detail.status}` : "ERR_UNKNOWN");
  }

  // 여러 오류 응답 형태에서 표시할 원인 메시지를 우선순위대로 선택
  function getErrorReason(detail) {
    return detail?.body?.error?.message
      || detail?.body?.error?.causeMessage
      || detail?.error?.message
      || detail?.message
      || "Unknown error";
  }

  // 로그 모달을 열 때 닫은 뒤 되돌아갈 포커스를 저장
  function openLog(log, event) {
    selectedLog        = log;
    lastFocusedElement = event?.currentTarget ?? document.activeElement;
    copyStatus         = "";
    logDialog?.showModal();
  }

  // 로그 모달을 닫고 이전 포커스를 복원
  function closeLogDialog() {
    logDialog?.close();
    lastFocusedElement?.focus?.();
  }

  // 현재 선택된 로그 상세 JSON을 클립보드에 복사
  async function copyLogDialogJson() {
    if (!selectedLog) return;

    await navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
    copyStatus = "copied";
  }

  function clearLogs() {
    logs = [];
  }

  // 대상 목록 helper는 자동 선택과 표시 라벨을 맞춘다
  function firstValue(items, getValue) {
    const preferred = items.find((item) => item?.isDefault) ?? items[0];

    return preferred ? getValue(preferred) : "";
  }

  function serialLabel(port) {
    return [port.path, port.manufacturer, port.vendorId, port.productId].filter(Boolean).join("  ") || port.path;
  }

  function networkLabel(printer) {
    return [printer.name, printer.host, printer.port].filter(Boolean).join("  ");
  }

  function cupsLabel(printer) {
    return [printer.name, printer.state, printer.isDefault ? "default" : ""].filter(Boolean).join("  ");
  }

  function winspoolLabel(printer) {
    return [printer.name, printer.portName, printer.isDefault ? "default" : ""].filter(Boolean).join("  ");
  }

  function selectedSerialPort() {
    return serialPorts.find((port) => port.path === serialPath);
  }

  function selectedNetworkPrinter() {
    return networkPrinters.find((printer) => printer.id === networkPreset || printer.host === networkHost);
  }

  function selectedCupsPrinter() {
    return cupsPrinters.find((printer) => printer.name === cupsName);
  }

  function selectedWinspoolPrinter() {
    return winspoolPrinters.find((printer) => printer.name === winspoolName);
  }

  // 서버 요청 payload를 UI 상태에서 조립
  // 영수증 본문과 옵션 상태를 인코딩 API payload로 변환
  async function buildReceiptPayload() {
    return {
      lines   : receiptLines.split(/\r?\n/).filter((line) => line.length > 0),
      divider,
      examples: await buildReceiptExamples(),
      feed    : Number(feed),
      cut,
      encoding,
      width   : Number(receiptWidth)
    };
  }

  // 활성화된 QR barcode image 옵션만 예제 payload에 포함
  async function buildReceiptExamples() {
    const examples = {};

    if (qrEnabled) {
      examples.qr = {
        data           : qrData,
        size           : Number(qrSize),
        errorCorrection: qrCorrection,
        fallbackText   : "[QR ERROR]"
      };
    }

    if (barcodeEnabled) {
      examples.barcode = {
        data        : barcodeData,
        type        : barcodeType,
        width       : Number(barcodeWidth),
        height      : Number(barcodeHeight),
        hri         : "below",
        fallbackText: "[BARCODE ERROR]"
      };
    }

    if (imageEnabled) {
      examples.image = {
        ...(await buildImageExample()),
        fallbackText: "[IMAGE ERROR]"
      };
    }

    return examples;
  }

  function buildSerialTarget() {
    const path = serialInputPath.trim() || serialPath;

    return {
      type       : "serial",
      path,
      baudRate   : Number(baudRate),
      dataBits   : Number(dataBits),
      stopBits   : Number(stopBits),
      parity,
      flowControl: flowControl || undefined
    };
  }

  // 선택한 출력 탭 종류에 맞춰 프린터 target 구조를 생성
  function buildTarget(type) {
    if (type === "serial") return buildSerialTarget();

    if (type === "network") {
      return {
        type,
        host: networkHost.trim(),
        port: Number(networkPort)
      };
    }

    if (type === "cups") {
      return {
        type,
        printerName: cupsName.trim()
      };
    }

    return {
      type,
      printerName: winspoolName.trim()
    };
  }

  // 출력 API가 요구하는 target receipt copies 구조를 조립
  async function buildPrintPayload(target) {
    return {
      target,
      receipt: await buildReceiptPayload(),
      copies : Number(copies)
    };
  }

  // 이미지 변환 helper는 파일 이미지를 프린터용 흑백 raster로 만든다
  // 파일 이미지가 있으면 픽셀 변환을 사용하고 없으면 샘플 이미지를 생성
  async function buildImageExample() {
    const threshold = imageAutoThreshold ? undefined : Number(imageThreshold);

    if (imageFile) {
      return readImagePixels(imageFile, Number(imageMaxWidth), threshold, true);
    }

    return buildSampleImage(Math.min(Number(imageMaxWidth), 96));
  }

  // 이미지 파일 선택 직후 변환 기준값을 분석해 UI 상태에 반영
  async function handleImageFileChange(event) {
    imageFile = event.currentTarget.files?.[0] ?? null;

    if (imageFile) {
      await analyzeImageSettings(false);
    }
  }

  // 사용자가 지정한 임계값 모드로 전환한 뒤 현재 이미지를 다시 분석
  async function applyManualThreshold() {
    if (!imageFile) return;

    imageAutoThreshold = false;
    await analyzeImageSettings(true);
  }

  // 이미지 크기와 자동 임계값을 계산해 입력값에 반영
  async function analyzeImageSettings(forceManual) {
    if (!imageFile) return;

    const settings = await getImageSettings(imageFile);

    imageMaxWidth  = settings.width;
    imageThreshold = settings.threshold;

    if (forceManual) {
      imageAutoThreshold = false;
    }
  }

  // 원본 이미지를 로드해 출력 폭과 Otsu 임계값 후보를 계산
  async function getImageSettings(file) {
    const image = await loadImageFile(file);
    const width = Math.min(384, Math.max(8, image.naturalWidth || 384));
    const data  = getImageLuminances(image, width);

    URL.revokeObjectURL(image.src);

    return {
      width,
      threshold: calculateImageThreshold(data.luminances)
    };
  }

  // 프린터에 보낼 흑백 raster 데이터를 밝기 기준으로 생성
  async function readImagePixels(file, maxWidth, threshold, updateThreshold) {
    const image    = await loadImageFile(file);
    const scale    = Math.min(1, maxWidth / image.naturalWidth, 240 / image.naturalHeight);
    const width    = Math.max(1, Math.round(image.naturalWidth * scale));
    const imageData = getImageLuminances(image, width);

    URL.revokeObjectURL(image.src);

    const effectiveThreshold = threshold ?? calculateImageThreshold(imageData.luminances);

    if (updateThreshold) {
      imageThreshold = effectiveThreshold;
    }

    return {
      width : imageData.width,
      height: imageData.height,
      data  : imageData.luminances.map((luminance) => luminance < effectiveThreshold ? 1 : 0)
    };
  }

  // 브라우저 Image 객체로 파일을 읽어 캔버스 처리에 넘김
  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload  = () => resolve(image);
      image.onerror = () => reject(new Error("Image load failed"));
      image.src     = URL.createObjectURL(file);
    });
  }

  // 캔버스에 이미지를 축소 렌더링한 뒤 픽셀 밝기 배열을 추출
  function getImageLuminances(image, maxWidth) {
    const scale  = Math.min(1, maxWidth / image.naturalWidth, 240 / image.naturalHeight);
    const width  = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width  = width;
    canvas.height = height;

    if (!ctx) {
      throw new Error("Canvas context is unavailable");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const pixels     = ctx.getImageData(0, 0, width, height).data;
    const luminances = [];

    for (let index = 0; index < pixels.length; index += 4) {
      const red       = pixels[index] ?? 255;
      const green     = pixels[index + 1] ?? 255;
      const blue      = pixels[index + 2] ?? 255;
      const alpha     = (pixels[index + 3] ?? 255) / 255;
      const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) * alpha + 255 * (1 - alpha);

      luminances.push(luminance);
    }

    return { width, height, luminances };
  }

  // Otsu 방식으로 전경과 배경을 가장 잘 나누는 임계값을 선택
  function calculateImageThreshold(luminances) {
    const histogram = Array.from({ length: 256 }, () => 0);
    let total       = 0;
    let sum         = 0;

    for (const luminance of luminances) {
      const value = Math.round(clampNumber(luminance, 0, 255));

      histogram[value] += 1;
      total            += 1;
      sum              += value;
    }

    let backgroundWeight = 0;
    let backgroundSum    = 0;
    let bestThreshold    = clampNumber(Number(imageThreshold), 0, 255);
    let bestVariance     = -1;

    for (let value = 0; value < histogram.length; value += 1) {
      const count = histogram[value] ?? 0;

      backgroundWeight += count;
      backgroundSum    += value * count;

      const foregroundWeight = total - backgroundWeight;

      if (backgroundWeight === 0 || foregroundWeight === 0) {
        continue;
      }

      const backgroundMean = backgroundSum / backgroundWeight;
      const foregroundMean = (sum - backgroundSum) / foregroundWeight;
      const difference     = backgroundMean - foregroundMean;
      const variance       = backgroundWeight * foregroundWeight * difference * difference;

      if (variance > bestVariance) {
        bestVariance  = variance;
        bestThreshold = value;
      }
    }

    return bestThreshold;
  }

  // 파일이 없을 때 출력 경로를 확인할 샘플 bitmap 데이터를 생성
  function buildSampleImage(width) {
    const height = Math.max(24, Math.round(width / 2));
    const data   = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const border   = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
        const diagonal = Math.abs(x / width - y / height) < 0.05;
        const stripe   = Math.floor(x / 6) % 2 === Math.floor(y / 6) % 2;

        data.push(border || diagonal || stripe ? 1 : 0);
      }
    }

    return { width, height, data };
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;

    return Math.min(max, Math.max(min, value));
  }

  // 화면 action은 서버 상태 조회와 출력 실행을 담당
  // 서버 상태와 기능 정보를 동시에 갱신하고 런타임 안내를 업데이트
  async function refreshStatus() {
    pending.status = true;

    try {
      const health       = await requestJson("/api/health");
      const capability   = await requestJson("/api/capabilities");

      healthOk      = Boolean(health.ok);
      healthDetail  = health;
      capabilities  = capability.capabilities ?? {};
      runtime       = capability.runtime ?? {};

      updateRuntimeMessages(runtime, capabilities);
      addLog("success", "status refreshed", { health, capabilities });
    } catch (error) {
      healthOk     = false;
      healthDetail = error.body || error.message;
      addLog("fail", "status refresh failed", getErrorDetail(error));
    } finally {
      pending.status = false;
    }
  }

  // 탭 종류에 맞는 목록 조회 함수를 실행하고 로드 완료 상태를 기록
  async function refreshTarget(type, silent = false) {
    pending[type] = true;

    try {
      if (type === "serial") await refreshSerialPorts(silent);
      if (type === "network") await refreshNetworkPrinters(silent);
      if (type === "cups") await refreshCupsPrinters(silent);
      if (type === "winspool") await refreshWinspoolPrinters(silent);

      targetLoaded = { ...targetLoaded, [type]: true };
    } finally {
      pending[type] = false;
    }
  }

  // serial 포트 목록을 불러오고 첫 후보를 선택값으로 채움
  async function refreshSerialPorts(silent = false) {
    try {
      const result = await requestJson("/api/serial/ports");
      const ports  = Array.isArray(result) ? result : result?.ports || [];

      serialPorts = ports;

      if (!serialPath && ports.length > 0) {
        serialPath      = firstValue(ports, (port) => port.path);
        serialInputPath = serialPath;
      }

      if (!silent) addLog("success", "serial ports refreshed", { ports });
    } catch (error) {
      addLog("fail", "serial ports failed", getErrorDetail(error));
    }
  }

  // network preset 목록을 불러오고 기본 preset을 host와 port에 반영
  async function refreshNetworkPrinters(silent = false) {
    try {
      const result   = await requestJson("/api/network/printers");
      const printers = Array.isArray(result) ? result : result?.printers || [];

      networkPrinters = printers;

      if (!networkHost && printers.length > 0) {
        const selected = printers.find((printer) => printer.isDefault) ?? printers[0];

        networkPreset = selected.id;
        networkHost   = selected.host;
        networkPort   = selected.port ?? 9100;
      }

      if (!silent) addLog("success", "network presets refreshed", { printers });
    } catch (error) {
      addLog("fail", "network presets failed", getErrorDetail(error));
    }
  }

  // CUPS 목록이 unsupported이면 실패 대신 안내 로그로 처리
  async function refreshCupsPrinters(silent = false) {
    try {
      const result   = await requestJson("/api/cups/printers");
      const printers = Array.isArray(result) ? result : result?.printers || [];

      cupsPrinters = printers;

      if (!cupsName && printers.length > 0) {
        cupsName = firstValue(printers, (printer) => printer.name);
      }

      if (result?.unsupported) {
        if (!silent) addLog("success", "cups unsupported", result);
        return;
      }

      if (!silent) addLog("success", "cups printers refreshed", { printers });
    } catch (error) {
      addLog("fail", "cups printers failed", getErrorDetail(error));
    }
  }

  // winspool 미지원 환경에서는 조회를 건너뛰고 안내 로그만 남김
  async function refreshWinspoolPrinters(silent = false) {
    if (capabilities.winspool === "unsupported") {
      winspoolPrinters = [];
      if (!silent) {
        addLog("success", "winspool unsupported", {
          ok     : true,
          runtime,
          message: "Winspool printer listing requires Windows Node"
        });
      }
      return;
    }

    try {
      const result   = await requestJson("/api/winspool/printers");
      const printers = Array.isArray(result) ? result : result?.printers || [];

      if (result?.unsupported) {
        winspoolPrinters = [];
        if (!silent) addLog("success", "winspool unsupported", result);
        return;
      }

      winspoolPrinters = printers;

      if (!winspoolName && printers.length > 0) {
        winspoolName = firstValue(printers, (printer) => printer.name);
      }

      if (!silent) addLog("success", "winspool printers refreshed", { printers });
    } catch (error) {
      addLog("fail", "winspool printers failed", getErrorDetail(error));
    }
  }

  // 처음 여는 탭은 목록을 자동 조회해 빈 선택 상태를 줄임
  async function selectTab(type) {
    activeTab = type;

    if (!targetLoaded[type]) {
      await refreshTarget(type, true);
    }
  }

  // 탭 목록의 방향키 이동을 activeTab 변경으로 연결
  function handleTabKey(event) {
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex      = currentIndex;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex === currentIndex) return;

    event.preventDefault();
    selectTab(tabs[nextIndex]);
  }

  // 대상 상세 정보를 로그로 만든 뒤 같은 상세 모달 흐름으로 표시
  function showTargetDetail(type, event) {
    const detail = getTargetDetail(type);

    if (!detail) {
      addLog("fail", `${type} detail failed`, {
        ok   : false,
        error: {
          code   : "ERR_TARGET_NOT_SELECTED",
          message: `${type} target is not selected`
        }
      });
      return;
    }

    const log = createLogEntry("success", `${type} detail`, { ok: true, target: detail });

    logs = [log, ...logs].slice(0, 80);
    openLog(log, event);
  }

  // 선택값이 없으면 현재 입력값으로 구성한 target 정보를 상세에 사용
  function getTargetDetail(type) {
    if (type === "serial") return selectedSerialPort() ?? buildSerialTarget();
    if (type === "network") return selectedNetworkPrinter() ?? buildTarget("network");
    if (type === "cups") return selectedCupsPrinter() ?? buildTarget("cups");
    if (type === "winspool") return selectedWinspoolPrinter() ?? buildTarget("winspool");

    return null;
  }

  // 현재 영수증 설정을 서버에서 실제 바이트로 인코딩
  async function encodeReceipt() {
    pending.encode = true;

    try {
      const payload = await buildReceiptPayload();
      const result  = await postJson("/api/receipt/encode", payload);

      encodedReceipt = result;
      addLog("success", "receipt encoded", result);
    } catch (error) {
      addLog("fail", "receipt encode failed", getErrorDetail(error));
    } finally {
      pending.encode = false;
    }
  }

  // 선택한 출력 대상에 영수증 payload를 보내고 결과를 로그로 기록
  async function printTarget(type) {
    pending.print = true;

    try {
      const payload = await buildPrintPayload(buildTarget(type));
      const result  = await postJson("/api/print", payload);

      addLog("success", `${type} print completed ${payload.copies} copies`, result);
    } catch (error) {
      addLog("fail", `${type} print failed`, getErrorDetail(error));
    } finally {
      pending.print = false;
    }
  }

  // fetch 오류 객체에서 로그 상세에 필요한 값만 추림
  function getErrorDetail(error) {
    return {
      message: error.message,
      status : error.status,
      body   : error.body
    };
  }

  // 초기 진입 시 서버 상태와 serial 목록만 자동 조회
  refreshStatus().then(() => refreshTarget("serial", true));
</script>

<svelte:head>
  <title>Printer Test Server</title>
</svelte:head>

<header class="topbar">
  <div>
    <h1>Printer test</h1>
    <div class="caption">localhost:3007</div>
  </div>

  <div class="topbar-actions">
    <strong class:ok={healthOk} class:fail={!healthOk} class="status-badge" title={JSON.stringify(healthDetail)}>
      {healthOk ? "healthy" : "unhealthy"}
    </strong>
    <button type="button" class="secondary-button" disabled={pending.status} on:click={refreshStatus}>
      {pending.status ? "Refreshing" : "Refresh"}
    </button>
  </div>
</header>

{#if runtimeMessages.length > 0}
  <section class="runtime-notice" aria-live="polite">
    {#each runtimeMessages as message}
      <span>{message}</span>
    {/each}
  </section>
{/if}

<main class="page-shell">
  <section class="panel receipt-panel" aria-labelledby="receiptTitle">
    <div class="panel-head">
      <div>
        <h2 id="receiptTitle">Receipt</h2>
      </div>
      <button type="button" disabled={pending.encode} on:click={encodeReceipt}>
        {pending.encode ? "Encoding" : "Encode"}
      </button>
    </div>

    <div class="form-stack">
      <label class="field">
        <span>Lines</span>
        <textarea bind:value={receiptLines} rows="5" spellcheck="false"></textarea>
      </label>

      <div class="inline-grid three">
        <label class="field">
          <span>Encoding</span>
          <select bind:value={encoding}>
            <option value="cp949">cp949</option>
            <option value="utf8">utf8</option>
            <option value="ascii">ascii</option>
          </select>
        </label>

        <label class="field">
          <span>Width</span>
          <input bind:value={receiptWidth} type="number" min="1" max="80">
        </label>

        <label class="field">
          <span>Feed</span>
          <input bind:value={feed} type="number" min="0" max="10">
        </label>
      </div>

      <div class="switch-row">
        <label class="check-field">
          <input bind:checked={divider} type="checkbox">
          <span>Divider</span>
        </label>
        <label class="check-field">
          <input bind:checked={cut} type="checkbox">
          <span>Cut</span>
        </label>
      </div>
    </div>

    <div class="example-stack">
      <fieldset class="example-group">
        <legend>
          <label class="check-field inline-check">
            <input bind:checked={qrEnabled} type="checkbox">
            <span>QR</span>
          </label>
        </legend>

        <label class="field">
          <span>Data</span>
          <input bind:value={qrData} type="text">
        </label>

        <div class="inline-grid two">
          <label class="field">
            <span>Size</span>
            <input bind:value={qrSize} type="number" min="1" max="16">
          </label>

          <label class="field">
            <span>Error</span>
            <select bind:value={qrCorrection}>
              <option value="m">m</option>
              <option value="l">l</option>
              <option value="q">q</option>
              <option value="h">h</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset class="example-group">
        <legend>
          <label class="check-field inline-check">
            <input bind:checked={barcodeEnabled} type="checkbox">
            <span>Barcode</span>
          </label>
        </legend>

        <label class="field">
          <span>Data</span>
          <input bind:value={barcodeData} type="text">
        </label>

        <div class="inline-grid three">
          <label class="field">
            <span>Type</span>
            <select bind:value={barcodeType}>
              <option value="ean13">ean13</option>
              <option value="ean8">ean8</option>
              <option value="code39">code39</option>
              <option value="code128">code128</option>
              <option value="itf">itf</option>
              <option value="codabar">codabar</option>
              <option value="code93">code93</option>
              <option value="upc-a">upc-a</option>
              <option value="upc-e">upc-e</option>
            </select>
          </label>

          <label class="field">
            <span>Height</span>
            <input bind:value={barcodeHeight} type="number" min="1" max="255">
          </label>

          <label class="field">
            <span>Width</span>
            <input bind:value={barcodeWidth} type="number" min="2" max="6">
          </label>
        </div>
      </fieldset>

      <fieldset class="example-group">
        <legend>
          <label class="check-field inline-check">
            <input bind:checked={imageEnabled} type="checkbox">
            <span>Image</span>
          </label>
        </legend>

        <label class="field">
          <span>File</span>
          <input type="file" accept="image/*" on:change={handleImageFileChange}>
        </label>

        <div class="inline-grid two">
          <label class="check-field framed-check">
            <input bind:checked={imageAutoThreshold} type="checkbox">
            <span>Auto threshold</span>
          </label>

          <button type="button" class="secondary-button" disabled={!imageFile} on:click={applyManualThreshold}>
            Manual threshold
          </button>
        </div>

        <div class="inline-grid two">
          <label class="field">
            <span>Max width</span>
            <input bind:value={imageMaxWidth} type="number" min="8" max="384">
          </label>

          <label class="field">
            <span>Threshold</span>
            <input bind:value={imageThreshold} type="number" min="0" max="255" disabled={imageAutoThreshold}>
          </label>
        </div>
      </fieldset>
    </div>

    <div class="output-grid">
      <label class="field">
        <span>Hex</span>
        <textarea value={encodedReceipt?.hex ?? ""} rows="6" readonly spellcheck="false"></textarea>
      </label>

      <label class="field">
        <span>Bytes</span>
        <textarea value={Array.isArray(encodedReceipt?.bytes) ? encodedReceipt.bytes.join(", ") : ""} rows="6" readonly spellcheck="false"></textarea>
      </label>
    </div>
  </section>

  <section class="panel target-panel" aria-labelledby="targetTitle">
    <div class="panel-head stacked">
      <div>
        <h2 id="targetTitle">출력 테스트</h2>
      </div>

      <div class="tab-list" role="tablist" aria-label="Printer targets" tabindex="0" on:keydown={handleTabKey}>
        {#each tabs as tab}
          <button
            type="button"
            id={`tab-${tab}`}
            class:active={activeTab === tab}
            role="tab"
            aria-controls={`panel-${tab}`}
            aria-selected={activeTab === tab}
            tabindex={activeTab === tab ? 0 : -1}
            on:click={() => selectTab(tab)}
          >
            {tab}
          </button>
        {/each}
      </div>
    </div>

    <div class="target-summary" aria-live="polite">
      {#each capabilityNames as name}
        <strong class={`mini-badge ${capabilityClass(capabilities[name])}`}>
          {name} {capabilityLabel(capabilities[name])}
        </strong>
      {/each}
    </div>

    <div class="form-stack">
      <label class="field short-field">
        <span>Copies</span>
        <input bind:value={copies} type="number" min="1" max="100">
      </label>
    </div>

    <div id="panel-serial" class:hidden-panel={activeTab !== "serial"} class="target-tab" role="tabpanel" aria-labelledby="tab-serial" tabindex="0">
      <div class="target-head">
        <div>
          <h3>Serial</h3>
          <span>{getTargetStatus("serial")}</span>
        </div>
        <div class="target-actions">
          <button type="button" class="secondary-button" disabled={pending.serial} on:click={(event) => showTargetDetail("serial", event)}>Detail</button>
          <button type="button" class="secondary-button" disabled={pending.serial} on:click={() => refreshTarget("serial")}>{pending.serial ? "Loading" : "Refresh"}</button>
        </div>
      </div>

      <div class="inline-grid two">
        <label class="field">
          <span>Port select</span>
          <select bind:value={serialPath} on:change={() => serialInputPath = serialPath}>
            <option value="">포트 선택</option>
            {#each serialPorts as port}
              <option value={port.path}>{serialLabel(port)}</option>
            {/each}
          </select>
        </label>

        <label class="field">
          <span>Port input</span>
          <input bind:value={serialInputPath} type="text" placeholder="COM3 또는 /dev/ttyS2">
        </label>
      </div>

      <div class="inline-grid three">
        <label class="field">
          <span>Baud rate</span>
          <select bind:value={baudRate}>
            {#each baudRates as rate}
              <option value={rate}>{rate}</option>
            {/each}
          </select>
        </label>

        <label class="field">
          <span>Data bits</span>
          <select bind:value={dataBits}>
            <option value={8}>8</option>
            <option value={7}>7</option>
            <option value={6}>6</option>
            <option value={5}>5</option>
          </select>
        </label>

        <label class="field">
          <span>Stop bits</span>
          <select bind:value={stopBits}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
      </div>

      <div class="inline-grid two">
        <label class="field">
          <span>Parity</span>
          <select bind:value={parity}>
            <option value="none">none</option>
            <option value="even">even</option>
            <option value="odd">odd</option>
            <option value="mark">mark</option>
            <option value="space">space</option>
          </select>
        </label>

        <label class="field">
          <span>Flow control</span>
          <select bind:value={flowControl}>
            <option value="">none</option>
            <option value="rtscts">rtscts</option>
            <option value="xon">xon</option>
            <option value="xoff">xoff</option>
          </select>
        </label>
      </div>

      <button type="button" disabled={pending.print} on:click={() => printTarget("serial")}>
        {pending.print ? "Printing" : "Serial print"}
      </button>
    </div>

    <div id="panel-network" class:hidden-panel={activeTab !== "network"} class="target-tab" role="tabpanel" aria-labelledby="tab-network" tabindex="0">
      <div class="target-head">
        <div>
          <h3>Network</h3>
          <span>{getTargetStatus("network")}</span>
        </div>
        <div class="target-actions">
          <button type="button" class="secondary-button" disabled={pending.network} on:click={(event) => showTargetDetail("network", event)}>Detail</button>
          <button type="button" class="secondary-button" disabled={pending.network} on:click={() => refreshTarget("network")}>{pending.network ? "Loading" : "Refresh"}</button>
        </div>
      </div>

      <label class="field">
        <span>Preset</span>
        <select bind:value={networkPreset} on:change={() => {
          const selected = selectedNetworkPrinter();
          if (selected) {
            networkHost = selected.host;
            networkPort = selected.port ?? 9100;
          }
        }}>
          <option value="">직접 입력</option>
          {#each networkPrinters as printer}
            <option value={printer.id}>{networkLabel(printer)}</option>
          {/each}
        </select>
      </label>

      <div class="inline-grid two">
        <label class="field">
          <span>Host</span>
          <input bind:value={networkHost} type="text" placeholder="192.168.0.50">
        </label>

        <label class="field">
          <span>Port</span>
          <input bind:value={networkPort} type="number" min="1" max="65535">
        </label>
      </div>

      <button type="button" disabled={pending.print} on:click={() => printTarget("network")}>
        {pending.print ? "Printing" : "Network print"}
      </button>
    </div>

    <div id="panel-cups" class:hidden-panel={activeTab !== "cups"} class="target-tab" role="tabpanel" aria-labelledby="tab-cups" tabindex="0">
      <div class="target-head">
        <div>
          <h3>CUPS</h3>
          <span>{getTargetStatus("cups")}</span>
        </div>
        <div class="target-actions">
          <button type="button" class="secondary-button" disabled={pending.cups} on:click={(event) => showTargetDetail("cups", event)}>Detail</button>
          <button type="button" class="secondary-button" disabled={pending.cups} on:click={() => refreshTarget("cups")}>{pending.cups ? "Loading" : "Refresh"}</button>
        </div>
      </div>

      <label class="field">
        <span>Printer select</span>
        <select bind:value={cupsName}>
          <option value="">프린터 선택</option>
          {#each cupsPrinters as printer}
            <option value={printer.name}>{cupsLabel(printer)}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>Printer name</span>
        <input bind:value={cupsName} type="text" placeholder="printer name">
      </label>

      <button type="button" disabled={pending.print} on:click={() => printTarget("cups")}>
        {pending.print ? "Printing" : "CUPS print"}
      </button>
    </div>

    <div id="panel-winspool" class:hidden-panel={activeTab !== "winspool"} class="target-tab" role="tabpanel" aria-labelledby="tab-winspool" tabindex="0">
      <div class="target-head">
        <div>
          <h3>Winspool</h3>
          <span>{capabilities.winspool === "unsupported" ? "Windows Node 필요" : getTargetStatus("winspool")}</span>
        </div>
        <div class="target-actions">
          <button type="button" class="secondary-button" disabled={pending.winspool || capabilities.winspool === "unsupported"} on:click={(event) => showTargetDetail("winspool", event)}>Detail</button>
          <button type="button" class="secondary-button" disabled={pending.winspool || capabilities.winspool === "unsupported"} on:click={() => refreshTarget("winspool")}>{pending.winspool ? "Loading" : "Refresh"}</button>
        </div>
      </div>

      <label class="field">
        <span>Printer select</span>
        <select bind:value={winspoolName} disabled={capabilities.winspool === "unsupported"}>
          <option value="">{capabilities.winspool === "unsupported" ? "Windows Node에서만 사용 가능" : "프린터 선택"}</option>
          {#each winspoolPrinters as printer}
            <option value={printer.name}>{winspoolLabel(printer)}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>Printer name</span>
        <input bind:value={winspoolName} type="text" placeholder="printer name" disabled={capabilities.winspool === "unsupported"}>
      </label>

      <button type="button" disabled={pending.print || capabilities.winspool === "unsupported"} on:click={() => printTarget("winspool")}>
        {pending.print ? "Printing" : "Winspool print"}
      </button>
    </div>
  </section>

  <section class="panel log-panel" aria-labelledby="logTitle">
    <div class="panel-head">
      <div>
        <h2 id="logTitle">로그</h2>
        <p>{logs.length} events</p>
      </div>
      <button type="button" class="secondary-button" on:click={clearLogs}>Clear</button>
    </div>

    <div class="log-list" aria-live="polite">
      {#if logs.length === 0}
        <div class="empty-state">아직 로그 없음</div>
      {/if}

      {#each logs as log (log.id)}
        <button type="button" class="log-item" on:click={(event) => openLog(log, event)}>
          <span>
            <strong>{log.title}</strong>
            <small>{log.time}</small>
          </span>
          <em class:ok={log.ok} class:fail={!log.ok}>{log.ok ? "ok" : log.code}</em>
        </button>
      {/each}
    </div>
  </section>
</main>

<dialog bind:this={logDialog} class="log-dialog" aria-labelledby="logDialogTitle" on:close={() => lastFocusedElement?.focus?.()}>
  <div class="dialog-head">
    <h2 id="logDialogTitle">{selectedLog?.title ?? "Detail"}</h2>
    <div class="dialog-actions">
      <span aria-live="polite">{copyStatus}</span>
      <button type="button" class="secondary-button" on:click={copyLogDialogJson}>Copy</button>
      <button type="button" on:click={closeLogDialog}>Close</button>
    </div>
  </div>

  <pre>{selectedLog ? JSON.stringify(selectedLog, null, 2) : ""}</pre>
</dialog>
