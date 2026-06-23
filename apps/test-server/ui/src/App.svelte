<script>
  import qrcode from "qrcode-generator";

  import LivePreview from "./_components/LivePreview.svelte";
  import RunLogPanel from "./_components/RunLogPanel.svelte";
  import TargetOptionList from "./_components/TargetOptionList.svelte";
  import TopBar from "./_components/TopBar.svelte";
  import { buildLiveMethod } from "./_components/live-method.js";

  // 앱 공통 상태와 탭 구성을 모아 관리
  const capabilityNames = ["core", "serial", "usb", "network"];
  const tabs            = ["serial", "usb", "network"];
  const baudRates       = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
  const encodingOptions = [
    "cp437",
    "cp850",
    "cp852",
    "cp858",
    "cp860",
    "cp863",
    "cp865",
    "cp866",
    "cp949",
    "cp950",
    "cp932",
    "big5",
    "gb18030",
    "windows-874",
    "windows-1250",
    "windows-1251",
    "windows-1252",
    "windows-1253",
    "windows-1254",
    "windows-1255",
    "windows-1256",
    "windows-1257",
    "windows-1258",
    "utf8",
    "ascii"
  ];
  const codePageOptions = [
    { page: 0, label: "PC437 USA", encoding: "cp437" },
    { page: 1, label: "Katakana", encoding: "cp932" },
    { page: 2, label: "PC850 Multilingual", encoding: "cp850" },
    { page: 3, label: "PC860 Portuguese", encoding: "cp860" },
    { page: 4, label: "PC863 Canadian French", encoding: "cp863" },
    { page: 5, label: "PC865 Nordic", encoding: "cp865" },
    { page: 16, label: "WPC1252 Latin", encoding: "windows-1252" },
    { page: 17, label: "PC866 Cyrillic", encoding: "cp866" },
    { page: 18, label: "PC852 Latin 2", encoding: "cp852" },
    { page: 19, label: "PC858 Euro", encoding: "cp858" },
    { page: 21, label: "PC949 Korean", encoding: "cp949" },
    { page: 22, label: "PC950 Traditional Chinese", encoding: "cp950" },
    { page: 23, label: "PC932 Japanese", encoding: "cp932" },
    { page: 24, label: "PC874 Thai", encoding: "windows-874" },
    { page: 25, label: "WPC1257 Baltic", encoding: "windows-1257" },
    { page: 26, label: "WPC1258 Vietnamese", encoding: "windows-1258" },
    { page: 47, label: "WPC1250 Latin 2", encoding: "windows-1250" },
    { page: 48, label: "WPC1251 Cyrillic", encoding: "windows-1251" },
    { page: 49, label: "WPC1254 Turkish", encoding: "windows-1254" },
    { page: 50, label: "WPC1255 Hebrew", encoding: "windows-1255" },
    { page: 51, label: "WPC1256 Arabic", encoding: "windows-1256" },
    { page: 52, label: "WPC1257 Baltic", encoding: "windows-1257" },
    { page: 53, label: "WPC1258 Vietnamese", encoding: "windows-1258" }
  ];
  const receiptSections = [
    { id: "layout", label: "Layout" },
    { id: "rows", label: "Rows" },
    { id: "media", label: "Media" },
    { id: "device", label: "Device" }
  ];
  const paperWidths     = {
    "58mm": 32,
    "76mm": 42,
    "80mm": 48
  };
  const receiptPreviewBaseSize    = 100;
  const receiptPreviewBaseWidth   = 420;
  const receiptPreviewTextPadding = 32;
  const receiptPreviewCharRatio   = 0.55;
  const receiptPaperSizes         = {
    "58mm": 58,
    "76mm": 76,
    "80mm": 80
  };
  const eanLeftOddPatterns        = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  const eanLeftEvenPatterns       = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
  const eanRightPatterns          = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
  const ean13ParityPatterns       = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
  const languageOptions = [
    { value: "en", label: "English" },
    { value: "ko", label: "한국어" }
  ];
  const messages        = {
    en: {
      appTitle: "Printer console",
      appCaption: "Local test server",
      healthy: "healthy",
      unhealthy: "unhealthy",
      language: "Language",
      refresh: "Refresh",
      refreshing: "Refreshing",
      receiptBuilder: "Receipt builder",
      encode: "Encode",
      encoding: "Encoding",
      lines: "Lines",
      width: "Width",
      feed: "Feed",
      divider: "Divider",
      cut: "Cut",
      layout: "Layout",
      rows: "Rows",
      media: "Media",
      device: "Device",
      layoutBuilder: "Layout builder",
      layoutHint: "Paper, wrapping, dividers",
      paper: "Paper",
      title: "Title",
      section: "Section",
      titleText: "Title text",
      sectionText: "Section text",
      autoWrap: "Auto wrap",
      wrapText: "Wrap text",
      indent: "Indent",
      truncate: "Truncate",
      blank: "Blank",
      truncateText: "Truncate text",
      truncateWidth: "Truncate width",
      blankLines: "Blank lines",
      dividerText: "Divider text",
      dividerChar: "Divider char",
      structuredRows: "Structured rows",
      rowsHint: "Rows, tables, items, totals",
      leftRight: "Left right",
      keyValue: "Key value",
      left: "Left",
      right: "Right",
      keyLabel: "Key label",
      keyValueText: "Key value",
      columns: "Columns",
      table: "Table",
      items: "Items",
      totals: "Totals",
      amount: "Amount",
      scopedStyle: "Scoped style",
      columnLeft: "Column left",
      columnRight: "Column right",
      amountLabel: "Amount label",
      amountValue: "Amount value",
      amountUnit: "Amount unit",
      scopedStyleText: "Scoped style text",
      mediaBlocks: "Media blocks",
      mediaHint: "QR, barcode, image",
      qr: "QR",
      qrData: "QR data",
      qrSize: "QR size",
      error: "Error",
      barcode: "Barcode",
      barcodeData: "Barcode data",
      type: "Type",
      height: "Height",
      image: "Image",
      file: "File",
      autoThreshold: "Auto threshold",
      manualThreshold: "Manual threshold",
      maxWidth: "Max width",
      threshold: "Threshold",
      deviceCommands: "Device commands",
      deviceHint: "Code page, font, hardware signals",
      codePage: "Code page",
      page: "Page",
      font: "Font",
      invertSample: "Invert sample",
      cashDrawer: "Cash drawer",
      beep: "Beep",
      livePreview: "Live preview",
      liveMethod: "Live method",
      receiptView: "Receipt",
      methodView: "Method",
      columnsUnit: "cols",
      encodedBytes: "Encoded bytes",
      hex: "Hex",
      bytes: "Bytes",
      printerTarget: "Printer target",
      printerTargets: "Printer targets",
      codePageHint: "Select a code page preset and keep receipt encoding in sync",
      copies: "Copies",
      detail: "Detail",
      loading: "Loading",
      printing: "Printing",
      serialPrint: "Serial print",
      usbPrint: "USB print",
      networkPrint: "Network print",
      portSelect: "Port select",
      portInput: "Port input",
      choosePort: "Choose port",
      baudRate: "Baud rate",
      dataBits: "Data bits",
      stopBits: "Stop bits",
      parity: "Parity",
      flowControl: "Flow control",
      preset: "Preset",
      directInput: "Direct input",
      host: "Host",
      port: "Port",
      printerSelect: "Printer select",
      printerName: "Printer name",
      choosePrinter: "Choose printer",
      usbUnavailable: "USB unavailable",
      windowsNodeRequired: "Windows Node required",
      windowsNodeOnly: "Windows Node only",
      ports: "ports",
      presets: "presets",
      printers: "printers",
      runLog: "Run log",
      events: "events",
      clear: "Clear",
      noEvents: "No events yet",
      copied: "copied",
      copy: "Copy",
      close: "Close",
      use: "Use",
      previewQr: "[QR]",
      previewBarcode: "[Barcode]",
      previewImage: "[Image]",
      previewCut: "[cut]",
      previewCashDrawer: "[cash drawer]",
      previewBeep: "[beep]",
      tipEncoding: "Text encoding used when bytes are generated",
      tipWidth: "Characters per receipt line",
      tipFeed: "Blank lines fed after content",
      tipDivider: "Adds a full-width separator after the base lines",
      tipCut: "Adds a paper cut command at the end",
      tipPaper: "Applies a common character width for the selected paper size",
      tipTitle: "Centers the title line",
      tipSection: "Adds a section divider with text in the middle",
      tipAutoWrap: "Wraps long text to the receipt width",
      tipTruncate: "Shortens long text with an ellipsis",
      tipBlank: "Adds empty lines inside the receipt",
      tipLeftRight: "Places a label on the left and value on the right",
      tipKeyValue: "Formats a label and value pair",
      tipColumns: "Splits one row into fixed-width columns",
      tipTable: "Adds a simple table with headers and rows",
      tipItems: "Adds sample item rows with quantity and amount",
      tipTotals: "Adds subtotal and total rows",
      tipAmount: "Formats one amount row",
      tipScopedStyle: "Applies style only inside this sample block",
      tipQr: "Adds a QR code command and fallback text",
      tipBarcode: "Adds a barcode command and fallback text",
      tipImage: "Adds a raster image command from a file or sample image",
      tipCodePage: "Sends an ESC/POS code page command before text",
      tipFont: "Switches printer font A or B",
      tipInvert: "Prints a sample line in inverse mode",
      tipCashDrawer: "Sends a cash drawer pulse command",
      tipBeep: "Sends a printer beep command"
    },
    ko: {
      appTitle: "프린터 콘솔",
      appCaption: "로컬 테스트 서버",
      healthy: "정상",
      unhealthy: "오류",
      language: "언어",
      refresh: "새로고침",
      refreshing: "새로고침 중",
      receiptBuilder: "영수증 빌더",
      encode: "인코딩",
      encoding: "인코딩",
      lines: "기본 문구",
      width: "줄 너비",
      feed: "용지 밀기",
      divider: "구분선",
      cut: "커팅",
      layout: "레이아웃",
      rows: "행",
      media: "미디어",
      device: "장치",
      layoutBuilder: "레이아웃 빌더",
      layoutHint: "용지, 줄바꿈, 구분선",
      paper: "용지",
      title: "제목",
      section: "섹션",
      titleText: "제목 문구",
      sectionText: "섹션 문구",
      autoWrap: "자동 줄바꿈",
      wrapText: "줄바꿈 문구",
      indent: "들여쓰기",
      truncate: "말줄임",
      blank: "빈 줄",
      truncateText: "말줄임 문구",
      truncateWidth: "말줄임 너비",
      blankLines: "빈 줄 수",
      dividerText: "구분선 문구",
      dividerChar: "구분선 문자",
      structuredRows: "구조화 행",
      rowsHint: "행, 표, 품목, 합계",
      leftRight: "좌우 정렬",
      keyValue: "키 값",
      left: "왼쪽",
      right: "오른쪽",
      keyLabel: "키 라벨",
      keyValueText: "키 값",
      columns: "컬럼",
      table: "표",
      items: "품목",
      totals: "합계",
      amount: "금액",
      scopedStyle: "범위 스타일",
      columnLeft: "왼쪽 컬럼",
      columnRight: "오른쪽 컬럼",
      amountLabel: "금액 라벨",
      amountValue: "금액 값",
      amountUnit: "금액 단위",
      scopedStyleText: "스타일 문구",
      mediaBlocks: "미디어 블록",
      mediaHint: "QR, 바코드, 이미지",
      qr: "QR",
      qrData: "QR 데이터",
      qrSize: "QR 크기",
      error: "오류 보정",
      barcode: "바코드",
      barcodeData: "바코드 데이터",
      type: "종류",
      height: "높이",
      image: "이미지",
      file: "파일",
      autoThreshold: "자동 임계값",
      manualThreshold: "수동 임계값",
      maxWidth: "최대 너비",
      threshold: "임계값",
      deviceCommands: "장치 명령",
      deviceHint: "코드페이지, 폰트, 장치 신호",
      codePage: "코드페이지",
      page: "페이지",
      font: "폰트",
      invertSample: "반전 샘플",
      cashDrawer: "돈통 열기",
      beep: "비프음",
      livePreview: "실시간 미리보기",
      liveMethod: "실시간 메서드",
      receiptView: "Receipt",
      methodView: "Method",
      columnsUnit: "칸",
      encodedBytes: "인코딩 바이트",
      hex: "16진수",
      bytes: "바이트",
      printerTarget: "프린터 대상",
      printerTargets: "프린터 대상",
      codePageHint: "코드페이지 프리셋을 고르면 영수증 인코딩도 함께 맞춥니다",
      copies: "매수",
      detail: "상세",
      loading: "불러오는 중",
      printing: "출력 중",
      serialPrint: "시리얼 출력",
      usbPrint: "USB 출력",
      networkPrint: "네트워크 출력",
      portSelect: "포트 선택",
      portInput: "포트 입력",
      choosePort: "포트 선택",
      baudRate: "전송 속도",
      dataBits: "데이터 비트",
      stopBits: "정지 비트",
      parity: "패리티",
      flowControl: "흐름 제어",
      preset: "프리셋",
      directInput: "직접 입력",
      host: "Host",
      port: "Port",
      printerSelect: "프린터 선택",
      printerName: "프린터 이름",
      choosePrinter: "프린터 선택",
      usbUnavailable: "USB 사용 불가",
      windowsNodeRequired: "Windows Node 필요",
      windowsNodeOnly: "Windows Node에서만 사용 가능",
      ports: "포트",
      presets: "프리셋",
      printers: "프린터",
      runLog: "실행 로그",
      events: "이벤트",
      clear: "비우기",
      noEvents: "아직 이벤트 없음",
      copied: "복사됨",
      copy: "복사",
      close: "닫기",
      use: "사용",
      previewQr: "[QR]",
      previewBarcode: "[바코드]",
      previewImage: "[이미지]",
      previewCut: "[커팅]",
      previewCashDrawer: "[돈통 신호]",
      previewBeep: "[비프음]",
      tipEncoding: "바이트 생성 시 사용할 텍스트 인코딩입니다",
      tipWidth: "영수증 한 줄에 들어가는 문자 수입니다",
      tipFeed: "내용 출력 후 용지를 몇 줄 밀지 정합니다",
      tipDivider: "기본 문구 뒤에 전체 너비 구분선을 추가합니다",
      tipCut: "마지막에 용지 커팅 명령을 추가합니다",
      tipPaper: "용지 크기에 맞는 기본 문자 너비를 적용합니다",
      tipTitle: "제목 문구를 가운데 정렬합니다",
      tipSection: "문구가 들어간 섹션 구분선을 추가합니다",
      tipAutoWrap: "긴 문구를 영수증 너비에 맞게 자동 줄바꿈합니다",
      tipTruncate: "긴 문구를 말줄임표로 줄입니다",
      tipBlank: "영수증 안에 빈 줄을 추가합니다",
      tipLeftRight: "왼쪽 라벨과 오른쪽 값을 한 줄에 배치합니다",
      tipKeyValue: "라벨과 값을 키 값 형태로 출력합니다",
      tipColumns: "한 줄을 고정 너비 컬럼으로 나눕니다",
      tipTable: "헤더와 행이 있는 간단한 표를 추가합니다",
      tipItems: "수량과 금액이 포함된 품목 행을 추가합니다",
      tipTotals: "소계와 합계 행을 추가합니다",
      tipAmount: "금액 한 줄을 포맷합니다",
      tipScopedStyle: "이 샘플 블록에만 스타일을 적용합니다",
      tipQr: "QR 코드 명령과 실패 시 대체 문구를 추가합니다",
      tipBarcode: "바코드 명령과 실패 시 대체 문구를 추가합니다",
      tipImage: "파일 또는 샘플 이미지를 래스터 명령으로 추가합니다",
      tipCodePage: "텍스트 출력 전 ESC/POS 코드페이지 명령을 보냅니다",
      tipFont: "프린터 폰트 A 또는 B로 전환합니다",
      tipInvert: "반전 모드 샘플 문구를 출력합니다",
      tipCashDrawer: "돈통 열기 펄스 명령을 보냅니다",
      tipBeep: "프린터 비프음 명령을 보냅니다"
    }
  };

  let activeTab               = "serial";
  let activeReceiptSection    = "layout";
  let language                 = getInitialLanguage();
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
    serial : false,
    usb    : false,
    network: false
  };
  let pending                 = {
    status : false,
    encode : false,
    print  : false,
    serial : false,
    usb    : false,
    network: false
  };

  // 영수증 본문과 출력 옵션 상태
  let receiptLines     = "테스트 출력\nSERIAL OK";
  let encoding         = "cp949";
  let receiptWidth     = 42;
  let divider          = true;
  let feed             = 3;
  let cut              = true;
  let copies           = 1;
  let paper            = "80mm";
  let codePageEnabled  = false;
  let codePage         = 21;
  let titleEnabled     = true;
  let titleText        = "MAXXU STORE";
  let sectionEnabled   = true;
  let sectionText      = "Order info";
  let wrapEnabled      = true;
  let wrapTextValue    = "This memo is automatically wrapped by the configured receipt width";
  let wrapIndent       = 2;
  let truncateEnabled  = true;
  let truncateTextValue = "ABCDEFGHIJKLMN";
  let truncateWidth    = 12;
  let blankEnabled     = true;
  let blankLines       = 1;
  let dividerText      = "MENU";
  let dividerChar      = "-";
  let leftRightEnabled = true;
  let leftRightLeft    = "Subtotal";
  let leftRightRight   = "12000";
  let keyValueEnabled  = true;
  let keyValueLabel    = "Order";
  let keyValueValue    = "A-1001";
  let columnsEnabled   = true;
  let columnLeft       = "Americano iced large";
  let columnRight      = "4500";
  let tableEnabled     = true;
  let itemsEnabled     = true;
  let totalsEnabled    = true;
  let amountEnabled    = true;
  let amountLabel      = "Paid";
  let amountValue      = 16500;
  let amountUnit       = "won";
  let styleEnabled     = true;
  let styleText        = "Scoped bold line";
  let fontValue        = "a";
  let invertEnabled    = false;
  let cashDrawerEnabled = false;
  let beepEnabled      = false;

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

  let imageEnabled       = true;
  let imageFile          = null;
  let imageAutoThreshold = true;
  let imageMaxWidth      = 384;
  let imageThreshold     = 220;
  let imagePreview       = null;
  let imagePreviewRun    = 0;

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

  let usbPrinters            = [];
  let usbName                = "";
  let usbTargetType          = "cups";
  let livePreview            = [];
  let liveMethod             = "";
  let liveTarget             = {};
  let receiptMethodState     = {};
  let receiptPreviewFontSize = 12;

  $: receiptPreviewFontSize = getReceiptPreviewFontSize();
  $: usbTargetType = getUsbTargetType(runtime);
  $: void updateImagePreview(imageFile, imageMaxWidth, imageThreshold, imageAutoThreshold);
  $: livePreview = buildLivePreview(
    language,
    receiptLines,
    receiptWidth,
    divider,
    feed,
    cut,
    paper,
    codePageEnabled,
    titleEnabled,
    titleText,
    sectionEnabled,
    sectionText,
    wrapEnabled,
    wrapTextValue,
    wrapIndent,
    truncateEnabled,
    truncateTextValue,
    truncateWidth,
    blankEnabled,
    blankLines,
    dividerText,
    dividerChar,
    leftRightEnabled,
    leftRightLeft,
    leftRightRight,
    keyValueEnabled,
    keyValueLabel,
    keyValueValue,
    columnsEnabled,
    columnLeft,
    columnRight,
    tableEnabled,
    itemsEnabled,
    totalsEnabled,
    amountEnabled,
    amountLabel,
    amountValue,
    amountUnit,
    styleEnabled,
    styleText,
    fontValue,
    invertEnabled,
    cashDrawerEnabled,
    beepEnabled,
    qrEnabled,
    qrData,
    qrCorrection,
    barcodeEnabled,
    barcodeData,
    barcodeType,
    barcodeHeight,
    barcodeWidth,
    imageEnabled,
    imageFile,
    imagePreview
  );
  $: receiptMethodState = {
    amountEnabled,
    amountLabel,
    amountUnit,
    amountValue,
    barcodeData,
    barcodeEnabled,
    barcodeHeight,
    barcodeType,
    barcodeWidth,
    beepEnabled,
    blankEnabled,
    blankLines,
    cashDrawerEnabled,
    codePage,
    codePageEnabled,
    columnLeft,
    columnRight,
    columnsEnabled,
    cut,
    divider,
    dividerChar,
    dividerText,
    encoding,
    feed,
    fontValue,
    imageEnabled,
    invertEnabled,
    itemsEnabled,
    keyValueEnabled,
    keyValueLabel,
    keyValueValue,
    leftRightEnabled,
    leftRightLeft,
    leftRightRight,
    paper,
    qrCorrection,
    qrData,
    qrEnabled,
    qrSize,
    receiptLines,
    receiptWidth,
    sectionEnabled,
    sectionText,
    styleEnabled,
    styleText,
    tableEnabled,
    titleEnabled,
    titleText,
    totalsEnabled,
    truncateEnabled,
    truncateTextValue,
    truncateWidth,
    wrapEnabled,
    wrapIndent,
    wrapTextValue
  };
  $: liveTarget = buildLiveTarget(activeTab, {
    baudRate,
    dataBits,
    flowControl,
    networkHost,
    networkPort,
    parity,
    serialInputPath,
    serialPath,
    stopBits,
    usbName,
    usbTargetType
  });
  $: liveMethod = buildLiveMethod({
    copies,
    receipt: receiptMethodState,
    target : liveTarget
  });

  function getInitialLanguage() {
    if (typeof localStorage === "undefined") {
      return "en";
    }

    return localStorage.getItem("node-printer-language") === "ko" ? "ko" : "en";
  }

  function changeLanguage(event) {
    language = event.currentTarget.value;
    localStorage.setItem("node-printer-language", language);
  }

  function t(key) {
    return messages[language]?.[key] ?? messages.en[key] ?? key;
  }

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

  function getUsbTargetType(currentRuntime = runtime) {
    return currentRuntime?.platform === "win32" ? "winspool" : "cups";
  }

  // 런타임과 기능 상태를 사람이 읽는 안내 메시지로 축약
  function updateRuntimeMessages(nextRuntime, nextCapabilities) {
    const messages = [];

    if (nextRuntime?.isWsl) {
      messages.push("WSL 실행 중");
    }

    if (nextCapabilities?.usb === "unsupported") {
      messages.push("USB 프린터 목록 사용 불가");
    }

    runtimeMessages = messages;
  }

  // 탭 제목 옆에 표시할 대상 목록 개수를 계산
  function getTargetStatus(type) {
    if (type === "serial") return `${serialPorts.length} ${t("ports")}`;
    if (type === "usb") return `${usbPrinters.length} ${t("printers")}`;
    if (type === "network") return `${networkPrinters.length} ${t("printers")}`;

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
    copyStatus = t("copied");
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
    return [printer.host, printer.port].filter(Boolean).join("  ");
  }

  function usbLabel(printer) {
    return [printer.name, printer.portName, printer.isDefault ? "default" : ""].filter(Boolean).join("  ");
  }

  function networkPrinterValue(printer) {
    return `${printer.host}:${printer.port ?? 9100}`;
  }

  function selectedSerialPort() {
    return serialPorts.find((port) => port.path === serialPath);
  }

  function selectedNetworkPrinter() {
    return networkPrinters.find((printer) => networkPrinterValue(printer) === networkPreset || printer.host === networkHost);
  }

  function selectedUsbPrinter() {
    return usbPrinters.find((printer) => printer.name === usbName);
  }

  // Target selection
  function selectSerialPortItem(port) {
    serialPath      = port.path;
    serialInputPath = port.path;
  }

  function selectNetworkPrinterItem(printer) {
    networkPreset = networkPrinterValue(printer);
    networkHost   = printer.host;
    networkPort   = printer.port ?? 9100;
  }

  function selectUsbPrinterItem(printer) {
    usbName = printer.name;
  }

  function selectCodePageOption(option) {
    codePageEnabled = true;
    codePage        = option.page;
    encoding        = option.encoding;
  }

  // 서버 요청 payload를 UI 상태에서 조립
  // 영수증 본문과 옵션 상태를 인코딩 API payload로 변환
  async function buildReceiptPayload() {
    return {
      lines   : receiptLines.split(/\r?\n/).filter((line) => line.length > 0),
      divider,
      blocks  : buildReceiptBlocks(),
      examples: await buildReceiptExamples(),
      feed    : Number(feed),
      cut,
      encoding,
      paper,
      charsPerLine: Number(receiptWidth),
      width   : Number(receiptWidth)
    };
  }

  function buildReceiptBlocks() {
    const blocks = [];

    if (codePageEnabled) {
      blocks.push({
        type    : "codePage",
        page    : Number(codePage),
        encoding
      });
    }

    if (titleEnabled) {
      blocks.push({ type: "title", text: titleText });
    }

    if (sectionEnabled) {
      blocks.push({ type: "section", text: sectionText });
    }

    if (wrapEnabled) {
      blocks.push({
        type  : "wrap",
        text  : wrapTextValue,
        indent: Number(wrapIndent)
      });
    }

    if (truncateEnabled) {
      blocks.push({
        type : "truncate",
        text : truncateTextValue,
        width: Number(truncateWidth)
      });
    }

    if (blankEnabled) {
      blocks.push({
        type : "blank",
        lines: Number(blankLines)
      });
    }

    if (dividerText.trim()) {
      blocks.push({
        type: "divider",
        char: dividerChar || "-",
        text: dividerText
      });
    }

    if (leftRightEnabled) {
      blocks.push({
        type : "leftRight",
        left : leftRightLeft,
        right: leftRightRight
      });
    }

    if (keyValueEnabled) {
      blocks.push({
        type : "keyValue",
        label: keyValueLabel,
        value: keyValueValue
      });
    }

    if (columnsEnabled) {
      blocks.push({
        type   : "columns",
        wrap   : true,
        columns: [
          { text: columnLeft, width: Math.max(1, Number(receiptWidth) - 12) },
          { text: columnRight, width: 12, align: "right" }
        ]
      });
    }

    if (tableEnabled) {
      blocks.push({
        type   : "table",
        divider: true,
        columns: [
          { title: "Name", width: Math.max(1, Number(receiptWidth) - 12) },
          { title: "Amount", width: 12, align: "right" }
        ],
        rows: [
          ["Latte", "5500"],
          ["Cookie", "2500"]
        ]
      });
    }

    if (itemsEnabled) {
      blocks.push({
        type : "items",
        unit : amountUnit,
        items: [
          { name: "Latte", quantity: 2, amount: 11000 },
          { name: "Cookie", quantity: 1, amount: 2500 }
        ]
      });
    }

    if (totalsEnabled) {
      blocks.push({
        type: "totals",
        unit: amountUnit,
        rows: [
          { label: "Subtotal", amount: 13500 },
          { label: "Total", amount: 16500, bold: true }
        ]
      });
    }

    if (amountEnabled) {
      blocks.push({
        type : "amount",
        label: amountLabel,
        value: Number(amountValue),
        unit : amountUnit
      });
    }

    if (styleEnabled) {
      blocks.push({
        type   : "style",
        options: { bold: true },
        blocks : [{ type: "text", text: styleText }]
      });
    }

    if (fontValue !== "a") {
      blocks.push({ type: "font", value: fontValue });
      blocks.push({ type: "text", text: "Font sample" });
      blocks.push({ type: "font", value: "a" });
    }

    if (invertEnabled) {
      blocks.push({ type: "invert", enabled: true });
      blocks.push({ type: "text", text: "Invert sample" });
      blocks.push({ type: "invert", enabled: false });
    }

    if (cashDrawerEnabled) {
      blocks.push({ type: "cashDrawer", pin: 2, on: 50, off: 250 });
    }

    if (beepEnabled) {
      blocks.push({ type: "beep", count: 1, duration: 1 });
    }

    return blocks;
  }

  function applyPaperWidth() {
    receiptWidth = paperWidths[paper] ?? receiptWidth;
  }

  function buildLivePreview() {
    const width = getReceiptWidth();
    const lines = [];

    for (const line of receiptLines.split(/\r?\n/).filter((value) => value.length > 0)) {
      lines.push(fitPreviewText(line, width));
    }

    if (divider) {
      lines.push("-".repeat(width));
    }

    if (titleEnabled) {
      lines.push(fitPreviewText(titleText, width, "center"));
    }

    if (sectionEnabled) {
      lines.push(formatPreviewDivider(width, "-", sectionText));
    }

    if (wrapEnabled) {
      lines.push(...wrapPreviewText(wrapTextValue, width, Number(wrapIndent)));
    }

    if (truncateEnabled) {
      lines.push(truncatePreviewText(truncateTextValue, Number(truncateWidth)));
    }

    if (blankEnabled) {
      lines.push(...Array.from({ length: clampInteger(blankLines, 0, 10) }, () => ""));
    }

    if (dividerText.trim()) {
      lines.push(formatPreviewDivider(width, dividerChar || "-", dividerText));
    }

    if (leftRightEnabled) {
      lines.push(formatPreviewPair(leftRightLeft, leftRightRight, width));
    }

    if (keyValueEnabled) {
      lines.push(formatPreviewPair(`${keyValueLabel}:`, keyValueValue, width));
    }

    if (columnsEnabled) {
      lines.push(...formatPreviewColumns(
        [
          { text: columnLeft, width: Math.max(1, width - 12) },
          { text: columnRight, width: 12, align: "right" }
        ]
      ));
    }

    if (tableEnabled) {
      lines.push(formatPreviewColumns([
        { text: "Name", width: Math.max(1, width - 12) },
        { text: "Amount", width: 12, align: "right" }
      ])[0]);
      lines.push("-".repeat(width));
      lines.push(formatPreviewColumns([
        { text: "Latte", width: Math.max(1, width - 12) },
        { text: "5500", width: 12, align: "right" }
      ])[0]);
      lines.push(formatPreviewColumns([
        { text: "Cookie", width: Math.max(1, width - 12) },
        { text: "2500", width: 12, align: "right" }
      ])[0]);
    }

    if (itemsEnabled) {
      lines.push(formatPreviewPair("Latte x2", formatPreviewAmount(11000), width));
      lines.push(formatPreviewPair("Cookie x1", formatPreviewAmount(2500), width));
    }

    if (totalsEnabled) {
      lines.push(formatPreviewPair("Subtotal", formatPreviewAmount(13500), width));
      lines.push(formatPreviewPair("Total", formatPreviewAmount(16500), width));
    }

    if (amountEnabled) {
      lines.push(formatPreviewPair(amountLabel, formatPreviewAmount(amountValue), width));
    }

    if (styleEnabled) {
      lines.push(fitPreviewText(styleText, width));
    }

    if (fontValue !== "a") {
      lines.push(fitPreviewText("Font sample", width));
    }

    if (invertEnabled) {
      lines.push(fitPreviewText("Invert sample", width));
    }

    if (qrEnabled) {
      lines.push(...formatPreviewQr(qrData, width));
    }

    if (barcodeEnabled) {
      lines.push(...formatPreviewBarcode(barcodeData, barcodeType, width));
    }

    if (imageEnabled) {
      lines.push(...formatPreviewImage(imagePreview, imageFile?.name ?? "sample", width));
    }

    if (cashDrawerEnabled) {
      lines.push(fitPreviewText(t("previewCashDrawer"), width));
    }

    if (beepEnabled) {
      lines.push(fitPreviewText(t("previewBeep"), width));
    }

    if (Number.isInteger(Number(feed)) && Number(feed) > 0) {
      lines.push(...Array.from({ length: clampInteger(feed, 0, 10) }, () => ""));
    }

    if (cut) {
      lines.push(fitPreviewText(t("previewCut"), width));
    }

    return lines;
  }

  function getReceiptWidth() {
    return clampInteger(receiptWidth || paperWidths[paper], 1, 80);
  }

  function getReceiptPaperSize(value) {
    return clampInteger(receiptPaperSizes[value] ?? 80, 1, receiptPreviewBaseSize);
  }

  function getReceiptPreviewFontSize() {
    const columns = getReceiptWidth();
    const paperRatio = getReceiptPaperSize(paper) / receiptPreviewBaseSize;
    const innerWidth = Math.max(1, receiptPreviewBaseWidth * paperRatio - receiptPreviewTextPadding);
    const fontSize = innerWidth / Math.max(1, columns) / receiptPreviewCharRatio;

    return Math.max(6.5, Math.min(12, Math.floor(fontSize * 10) / 10));
  }

  function fitPreviewText(value, width, align = "left") {
    const text = truncatePreviewText(String(value ?? ""), width, "");
    const size = Array.from(text).length;
    const gap = Math.max(0, width - size);

    if (align === "right") {
      return `${" ".repeat(gap)}${text}`;
    }

    if (align === "center") {
      const left = Math.floor(gap / 2);
      return `${" ".repeat(left)}${text}${" ".repeat(gap - left)}`;
    }

    return `${text}${" ".repeat(gap)}`;
  }

  function formatPreviewDivider(width, char, text = "") {
    const mark = Array.from(char || "-")[0] ?? "-";

    if (!text) {
      return mark.repeat(width);
    }

    const label = truncatePreviewText(text, width, "");
    const gap = Math.max(0, width - Array.from(label).length);
    const left = Math.floor(gap / 2);

    return `${mark.repeat(left)}${label}${mark.repeat(gap - left)}`;
  }

  function truncatePreviewText(value, width, ellipsis = "...") {
    const limit = clampInteger(width, 1, 80);
    const chars = Array.from(String(value ?? ""));

    if (chars.length <= limit) {
      return chars.join("");
    }

    const suffix = Array.from(ellipsis).slice(0, limit).join("");
    const keep = Math.max(0, limit - Array.from(suffix).length);

    return `${chars.slice(0, keep).join("")}${suffix}`;
  }

  function wrapPreviewText(value, width, indent) {
    const words = String(value ?? "").split(/\s+/).filter(Boolean);
    const lines = [];
    const nextIndent = Math.max(0, Number(indent) || 0);
    let current = "";

    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }

      if (Array.from(`${current} ${word}`).length <= width) {
        current = `${current} ${word}`;
        continue;
      }

      lines.push(fitPreviewText(current, width));
      current = `${" ".repeat(nextIndent)}${word}`;
    }

    if (current) {
      lines.push(fitPreviewText(current, width));
    }

    return lines.length > 0 ? lines : [""];
  }

  function formatPreviewPair(left, right, width) {
    const rightText = truncatePreviewText(right, width, "");
    const leftText = truncatePreviewText(left, Math.max(1, width - Array.from(rightText).length), "");
    const gap = Math.max(0, width - Array.from(leftText).length - Array.from(rightText).length);

    return `${leftText}${" ".repeat(gap)}${rightText}`;
  }

  function formatPreviewColumns(columns) {
    return [
      columns
        .map((column) => fitPreviewText(column.text, column.width, column.align))
        .join("")
    ];
  }

  function formatPreviewAmount(value) {
    const number = Number(value) || 0;
    const locale = language === "ko" ? "ko-KR" : "en-US";

    return `${new Intl.NumberFormat(locale).format(number)}${amountUnit}`;
  }

  function formatPreviewQr(value, width) {
    if (width < 8) {
      return [fitPreviewText(t("previewQr"), width)];
    }

    try {
      const data       = String(value ?? "");
      const correction = String(qrCorrection || "m").toUpperCase();
      const qr         = qrcode(0, correction);
      const modules    = [];

      qr.addData(data);
      qr.make();

      for (let row = 0; row < qr.getModuleCount(); row += 1) {
        for (let column = 0; column < qr.getModuleCount(); column += 1) {
          modules.push(qr.isDark(row, column));
        }
      }

      return [
        {
          type : "qr",
          data,
          size : qr.getModuleCount(),
          modules,
          label: `${t("previewQr")} ${data}`
        }
      ];
    } catch {
      return [fitPreviewText(`${t("previewQr")} ${value}`, width, "center")];
    }
  }

  function formatPreviewBarcode(value, type, width) {
    if (width < 8) {
      return [fitPreviewText(t("previewBarcode"), width)];
    }

    const barcode      = buildPreviewBarcode(value, type);
    const moduleWidth  = clampInteger(barcodeWidth, 2, 6);
    const displayWidth = Math.min(260, Math.max(140, Math.round(barcode.modules.length * moduleWidth * 0.72)));

    return [
      {
        type     : "barcode",
        data     : barcode.data,
        label    : `${t("previewBarcode")} ${barcode.type} ${barcode.data}`,
        modules  : barcode.modules,
        height   : clampInteger(barcodeHeight, 24, 120),
        width    : displayWidth,
        symbology: barcode.type
      }
    ];
  }

  function formatPreviewImage(preview, name, width) {
    if (width < 8) {
      return [fitPreviewText(t("previewImage"), width)];
    }

    const image        = preview ?? buildSampleImage(Math.min(Number(imageMaxWidth), 96));
    const displayWidth = Math.min(220, Math.max(96, Math.round(image.width * 1.6)));

    return [
      {
        type  : "image",
        name,
        label : `${t("previewImage")} ${name}`,
        width : image.width,
        height: image.height,
        data  : image.data,
        size  : displayWidth
      }
    ];
  }

  function buildPreviewBarcode(value, type) {
    const normalizedType = String(type || "code128").toLowerCase();

    if (normalizedType === "ean13") return buildEan13Preview(value);
    if (normalizedType === "ean8") return buildEan8Preview(value);
    if (normalizedType === "upc-a") return buildUpcaPreview(value);

    const data = String(value ?? "").trim() || "0";

    return {
      type   : normalizedType,
      data,
      modules: buildGenericBarcodeModules(data, normalizedType)
    };
  }

  function buildEan13Preview(value) {
    const data   = normalizeEanDigits(value, 12, 13);
    const parity = ean13ParityPatterns[Number(data[0])] ?? ean13ParityPatterns[0];
    let pattern  = "101";

    for (let index = 1; index <= 6; index += 1) {
      const digit = Number(data[index]);
      pattern    += parity[index - 1] === "G" ? eanLeftEvenPatterns[digit] : eanLeftOddPatterns[digit];
    }

    pattern += "01010";

    for (let index = 7; index <= 12; index += 1) {
      pattern += eanRightPatterns[Number(data[index])];
    }

    pattern += "101";

    return {
      type   : "ean13",
      data,
      modules: patternToModules(pattern)
    };
  }

  function buildEan8Preview(value) {
    const data  = normalizeEanDigits(value, 7, 8);
    let pattern = "101";

    for (let index = 0; index < 4; index += 1) {
      pattern += eanLeftOddPatterns[Number(data[index])];
    }

    pattern += "01010";

    for (let index = 4; index < 8; index += 1) {
      pattern += eanRightPatterns[Number(data[index])];
    }

    pattern += "101";

    return {
      type   : "ean8",
      data,
      modules: patternToModules(pattern)
    };
  }

  function buildUpcaPreview(value) {
    const data = normalizeEanDigits(value, 11, 12);
    const ean  = buildEan13Preview(`0${data}`);

    return {
      type   : "upc-a",
      data,
      modules: ean.modules
    };
  }

  function normalizeEanDigits(value, baseLength, totalLength) {
    const digits = String(value ?? "").replace(/\D/g, "");

    if (digits.length >= totalLength) {
      return digits.slice(0, totalLength);
    }

    const body = digits.slice(0, baseLength).padEnd(baseLength, "0");

    return `${body}${calculateEanCheckDigit(body)}`;
  }

  function calculateEanCheckDigit(body) {
    const sum = Array.from(body)
      .reverse()
      .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);

    return String((10 - (sum % 10)) % 10);
  }

  function buildGenericBarcodeModules(value, type) {
    const source  = `${type}:${value}`;
    const modules = [true, false, true, false, true, false];

    for (const char of source) {
      const code = char.charCodeAt(0);

      for (let bit = 0; bit < 7; bit += 1) {
        const wide = (code >> bit) & 1;

        modules.push(true, true);

        if (wide) {
          modules.push(true);
        }

        modules.push(false);
      }

      modules.push(false);
    }

    modules.push(true, false, true);

    return modules.slice(0, 180);
  }

  function patternToModules(pattern) {
    return Array.from(pattern, (bit) => bit === "1");
  }

  function centerPreviewLines(lines, width) {
    return lines.map((line) => fitPreviewText(line, width, "center"));
  }

  function clampInteger(value, min, max) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return min;
    }

    return Math.max(min, Math.min(max, Math.trunc(parsed)));
  }

  async function updateImagePreview(file, maxWidth, threshold, autoThreshold) {
    const run = imagePreviewRun + 1;

    imagePreviewRun = run;

    if (!file) {
      imagePreview = buildSampleImage(Math.min(clampInteger(maxWidth, 8, 384), 96));
      return;
    }

    try {
      const previewThreshold = autoThreshold ? undefined : Number(threshold);
      const previewWidth     = Math.min(clampInteger(maxWidth, 8, 384), 96);
      const preview          = await readImagePreviewPixels(file, previewWidth, previewThreshold);

      if (run === imagePreviewRun) {
        imagePreview = preview;
      }
    } catch {
      if (run === imagePreviewRun) {
        imagePreview = buildSampleImage(Math.min(clampInteger(maxWidth, 8, 384), 96));
      }
    }
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

    if (type === "usb") {
      return {
        type: usbTargetType,
        printerName: usbName.trim()
      };
    }

    return {};
  }

  function buildLiveTarget(type, state) {
    if (type === "serial") {
      const path = state.serialInputPath.trim() || state.serialPath;

      return {
        type       : "serial",
        path,
        baudRate   : Number(state.baudRate),
        dataBits   : Number(state.dataBits),
        stopBits   : Number(state.stopBits),
        parity     : state.parity,
        flowControl: state.flowControl || undefined
      };
    }

    if (type === "network") {
      return {
        type,
        host: state.networkHost.trim(),
        port: Number(state.networkPort)
      };
    }

    if (type === "usb") {
      return {
        type: state.usbTargetType,
        printerName: state.usbName.trim()
      };
    }

    return {};
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

  async function readImagePreviewPixels(file, maxWidth, threshold) {
    const image     = await loadImageFile(file);
    const imageData = getImageLuminances(image, maxWidth, 96);

    URL.revokeObjectURL(image.src);

    const effectiveThreshold = threshold ?? calculateImageThreshold(imageData.luminances);

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
  function getImageLuminances(image, maxWidth, maxHeight = 240) {
    const scale  = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
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
      if (type === "usb") await refreshUsbPrinters(silent);
      if (type === "network") await refreshNetworkPrinters(silent);

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

  // USB printer 목록을 불러오고 기본 프린터 이름을 반영
  async function refreshUsbPrinters(silent = false) {
    if (capabilities.usb !== "ready") {
      usbPrinters = [];
      if (!silent) {
        addLog("success", "usb unsupported", {
          ok     : true,
          runtime,
          message: "USB printer listing requires CUPS or Winspool"
        });
      }
      return;
    }

    try {
      const result   = await requestJson("/api/usb/printers");
      const printers = Array.isArray(result) ? result : result?.printers || [];

      usbPrinters = printers;

      if (!usbName && printers.length > 0) {
        usbName = firstValue(printers, (printer) => printer.name);
      }

      if (result?.unsupported) {
        if (!silent) addLog("success", "usb unsupported", result);
        return;
      }

      if (!silent) addLog("success", "usb printers refreshed", { printers });
    } catch (error) {
      addLog("fail", "usb printers failed", getErrorDetail(error));
    }
  }

  // network printer 목록을 불러오고 첫 후보를 host와 port에 반영
  async function refreshNetworkPrinters(silent = false) {
    try {
      const result   = await requestJson("/api/network/printers");
      const printers = Array.isArray(result) ? result : result?.printers || [];

      networkPrinters = printers;

      if (!networkHost && printers.length > 0) {
        const selected = printers[0];

        networkPreset = networkPrinterValue(selected);
        networkHost   = selected.host;
        networkPort   = selected.port ?? 9100;
      }

      if (!silent) addLog("success", "network printers refreshed", { printers });
    } catch (error) {
      addLog("fail", "network printers failed", getErrorDetail(error));
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
    if (type === "usb") return selectedUsbPrinter() ?? buildTarget("usb");
    if (type === "network") return selectedNetworkPrinter() ?? buildTarget("network");

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

{#key language}
<TopBar
  appCaption={t("appCaption")}
  appTitle={t("appTitle")}
  {capabilities}
  {capabilityClass}
  {capabilityLabel}
  {capabilityNames}
  {changeLanguage}
  {healthDetail}
  {healthOk}
  bind:language
  {languageOptions}
  pendingStatus={pending.status}
  {refreshStatus}
  {t}
/>

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
        <h2 id="receiptTitle">{t("receiptBuilder")}</h2>
      </div>
      <button type="button" disabled={pending.encode} on:click={encodeReceipt}>
        {pending.encode ? t("encoding") : t("encode")}
      </button>
    </div>

    <div class="receipt-workspace">
      <div class="builder-controls">
    <div class="form-stack">
      <section class="example-group method-panel primary-method-panel">
        <div class="group-head method-head">
          <h3>{t("receiptBuilder")}</h3>
          <span>options, value</span>
        </div>

        <div class="method-card">
          <div class="method-card-head">
            <div class="method-card-title">
              <strong>Text</strong>
            </div>
          </div>

          <label class="field media-field">
            <strong>value</strong>
            <textarea bind:value={receiptLines} rows="5" spellcheck="false"></textarea>
          </label>
        </div>

        <div class="method-card">
          <div class="method-card-head">
            <div class="method-card-title">
              <strong>Receipt</strong>
            </div>
          </div>

          <section class="receipt-code-page" aria-labelledby="receiptCodePageTitle">
            <div class="code-page-head">
              <div>
                <h3 id="receiptCodePageTitle">{t("codePage")}</h3>
                <span>{t("codePageHint")}</span>
              </div>

              <label class="method-toggle media-use" title={t("tipCodePage")}>
                <input bind:checked={codePageEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <div class="code-page-list" aria-label={t("codePage")}>
              {#each codePageOptions as option}
                <button
                  type="button"
                  class:active={codePageEnabled && Number(codePage) === option.page && encoding === option.encoding}
                  aria-pressed={codePageEnabled && Number(codePage) === option.page && encoding === option.encoding}
                  on:click={() => selectCodePageOption(option)}
                >
                  <span>{option.label}</span>
                  <strong>{option.encoding} / ESC t {option.page}</strong>
                </button>
              {/each}
            </div>
          </section>

          <div class="method-card-fields two">
            <label class="field media-field" title={t("tipEncoding")}>
              <strong>encoding</strong>
              <select bind:value={encoding}>
                {#each encodingOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </label>

            <label class="field media-field" title={t("tipWidth")}>
              <strong>width</strong>
              <input bind:value={receiptWidth} type="number" min="1" max="80">
            </label>
          </div>
        </div>

        <div class="method-card-grid">
          <div class="method-card compact-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Feed</strong>
              </div>
            </div>

            <label class="field media-field" title={t("tipFeed")}>
              <strong>lines</strong>
              <input bind:value={feed} type="number" min="0" max="10">
            </label>
          </div>

          <div class="method-card compact-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Divider</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipDivider")}>
                <input bind:checked={divider} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>
          </div>

          <div class="method-card compact-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Cut</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipCut")}>
                <input bind:checked={cut} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="receipt-option-nav" role="tablist" aria-label="Receipt builder sections">
      {#each receiptSections as section}
        <button
          type="button"
          role="tab"
          class:active={activeReceiptSection === section.id}
          aria-selected={activeReceiptSection === section.id}
          on:click={() => activeReceiptSection = section.id}
        >
          {t(section.id)}
        </button>
      {/each}
    </div>

    <div class="example-stack option-stack">
      {#if activeReceiptSection === "layout"}
        <section class="example-group clean-options">
          <div class="group-head">
            <h3>{t("layout")}</h3>
            <span>value, options</span>
          </div>

          <div class="method-list">
            <label class="field method-row method-row-field" title={t("tipPaper")}>
              <span>{t("paper")}</span>
              <strong>paper</strong>
              <select bind:value={paper} on:change={applyPaperWidth}>
                <option value="58mm">58mm</option>
                <option value="76mm">76mm</option>
                <option value="80mm">80mm</option>
              </select>
            </label>

            <div class="method-row method-row-grid">
              <label class="method-toggle" title={t("tipTitle")}>
                <input bind:checked={titleEnabled} type="checkbox">
                <span>{t("title")}</span>
              </label>
              <label class="field">
                <strong>value</strong>
                <input bind:value={titleText} type="text">
              </label>
            </div>

            <div class="method-row method-row-grid">
              <label class="method-toggle" title={t("tipSection")}>
                <input bind:checked={sectionEnabled} type="checkbox">
                <span>{t("section")}</span>
              </label>
              <label class="field">
                <strong>value</strong>
                <input bind:value={sectionText} type="text">
              </label>
            </div>

            <div class="method-row method-row-wide">
              <label class="method-toggle" title={t("tipAutoWrap")}>
                <input bind:checked={wrapEnabled} type="checkbox">
                <span>{t("autoWrap")}</span>
              </label>
              <label class="field">
                <strong>value</strong>
                <textarea bind:value={wrapTextValue} rows="3" spellcheck="false"></textarea>
              </label>
              <label class="field short-method-field">
                <strong>indent</strong>
                <input bind:value={wrapIndent} type="number" min="0" max="12">
              </label>
            </div>

            <div class="method-row method-row-grid">
              <label class="method-toggle" title={t("tipTruncate")}>
                <input bind:checked={truncateEnabled} type="checkbox">
                <span>{t("truncate")}</span>
              </label>
              <label class="field">
                <strong>value</strong>
                <input bind:value={truncateTextValue} type="text">
              </label>
              <label class="field short-method-field">
                <strong>width</strong>
                <input bind:value={truncateWidth} type="number" min="1" max="80">
              </label>
            </div>

            <div class="method-row method-row-grid">
              <label class="method-toggle" title={t("tipBlank")}>
                <input bind:checked={blankEnabled} type="checkbox">
                <span>{t("blank")}</span>
              </label>
              <label class="field short-method-field">
                <strong>lines</strong>
                <input bind:value={blankLines} type="number" min="0" max="10">
              </label>
            </div>

            <div class="method-row method-row-grid">
              <div class="method-label">
                {t("divider")}
              </div>
              <label class="field">
                <strong>text</strong>
                <input bind:value={dividerText} type="text">
              </label>
              <label class="field short-method-field">
                <strong>char</strong>
                <input bind:value={dividerChar} type="text" maxlength="1">
              </label>
            </div>
          </div>
        </section>
      {:else if activeReceiptSection === "rows"}
        <section class="example-group">
          <div class="group-head">
            <h3>{t("rows")}</h3>
            <span>rows, options</span>
          </div>

          <div class="method-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Left right</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipLeftRight")}>
                <input bind:checked={leftRightEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <div class="method-card-fields two">
              <label class="field media-field">
                <strong>left</strong>
                <input bind:value={leftRightLeft} type="text">
              </label>

              <label class="field media-field">
                <strong>right</strong>
                <input bind:value={leftRightRight} type="text">
              </label>
            </div>
          </div>

          <div class="method-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Key value</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipKeyValue")}>
                <input bind:checked={keyValueEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <div class="method-card-fields two">
              <label class="field media-field">
                <strong>label</strong>
                <input bind:value={keyValueLabel} type="text">
              </label>

              <label class="field media-field">
                <strong>value</strong>
                <input bind:value={keyValueValue} type="text">
              </label>
            </div>
          </div>

          <div class="method-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Columns</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipColumns")}>
                <input bind:checked={columnsEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <div class="method-card-fields two">
              <label class="field media-field">
                <strong>left</strong>
                <input bind:value={columnLeft} type="text">
              </label>

              <label class="field media-field">
                <strong>right</strong>
                <input bind:value={columnRight} type="text">
              </label>
            </div>
          </div>

          <div class="method-card-grid">
            <div class="method-card compact-card">
              <div class="method-card-head">
                <div class="method-card-title">
                  <strong>Table</strong>
                </div>
                <label class="method-toggle media-use" title={t("tipTable")}>
                  <input bind:checked={tableEnabled} type="checkbox">
                  <span>{t("use")}</span>
                </label>
              </div>
            </div>

            <div class="method-card compact-card">
              <div class="method-card-head">
                <div class="method-card-title">
                  <strong>Items</strong>
                </div>
                <label class="method-toggle media-use" title={t("tipItems")}>
                  <input bind:checked={itemsEnabled} type="checkbox">
                  <span>{t("use")}</span>
                </label>
              </div>
            </div>

            <div class="method-card compact-card">
              <div class="method-card-head">
                <div class="method-card-title">
                  <strong>Totals</strong>
                </div>
                <label class="method-toggle media-use" title={t("tipTotals")}>
                  <input bind:checked={totalsEnabled} type="checkbox">
                  <span>{t("use")}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="method-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Amount</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipAmount")}>
                <input bind:checked={amountEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <div class="method-card-fields three">
              <label class="field media-field">
                <strong>label</strong>
                <input bind:value={amountLabel} type="text">
              </label>

              <label class="field media-field">
                <strong>value</strong>
                <input bind:value={amountValue} type="number" min="0">
              </label>

              <label class="field media-field">
                <strong>unit</strong>
                <input bind:value={amountUnit} type="text">
              </label>
            </div>
          </div>

          <div class="method-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Style</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipScopedStyle")}>
                <input bind:checked={styleEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <label class="field media-field">
              <strong>text</strong>
              <input bind:value={styleText} type="text">
            </label>
          </div>
        </section>
      {:else if activeReceiptSection === "media"}
        <section class="example-group">
          <div class="group-head">
            <h3>{t("media")}</h3>
            <span>value, options</span>
          </div>

          <div class="media-card">
            <div class="media-card-head">
              <div class="media-title">
                <strong>QR</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipQr")}>
                <input bind:checked={qrEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <div class="media-fields three">
              <label class="field media-field wide-field">
                <strong>value</strong>
                <input bind:value={qrData} type="text">
              </label>

              <label class="field media-field">
                <strong>size</strong>
                <input bind:value={qrSize} type="number" min="1" max="16">
              </label>

              <label class="field media-field">
                <strong>error</strong>
                <select bind:value={qrCorrection}>
                  <option value="m">m</option>
                  <option value="l">l</option>
                  <option value="q">q</option>
                  <option value="h">h</option>
                </select>
              </label>
            </div>
          </div>

          <div class="media-card">
            <div class="media-card-head">
              <div class="media-title">
                <strong>Barcode</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipBarcode")}>
                <input bind:checked={barcodeEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <div class="media-fields four">
              <label class="field media-field wide-field">
                <strong>value</strong>
                <input bind:value={barcodeData} type="text">
              </label>

              <label class="field media-field">
                <strong>type</strong>
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

              <label class="field media-field">
                <strong>height</strong>
                <input bind:value={barcodeHeight} type="number" min="1" max="255">
              </label>

              <label class="field media-field">
                <strong>width</strong>
                <input bind:value={barcodeWidth} type="number" min="2" max="6">
              </label>
            </div>
          </div>

          <div class="media-card">
            <div class="media-card-head">
              <div class="media-title">
                <strong>Image</strong>
              </div>
              <label class="method-toggle media-use" title={t("tipImage")}>
                <input bind:checked={imageEnabled} type="checkbox">
                <span>{t("use")}</span>
              </label>
            </div>

            <div class="media-fields three">
              <label class="field media-field wide-field">
                <strong>input</strong>
                <input type="file" accept="image/*" on:change={handleImageFileChange}>
              </label>

              <label class="method-toggle media-inline-toggle">
                <input bind:checked={imageAutoThreshold} type="checkbox">
                <span>auto</span>
              </label>

              <button type="button" class="secondary-button media-action" disabled={!imageFile} on:click={applyManualThreshold}>
                {t("manualThreshold")}
              </button>

              <label class="field media-field">
                <strong>maxWidth</strong>
                <input bind:value={imageMaxWidth} type="number" min="8" max="384">
              </label>

              <label class="field media-field">
                <strong>threshold</strong>
                <input bind:value={imageThreshold} type="number" min="0" max="255" disabled={imageAutoThreshold}>
              </label>
            </div>
          </div>
        </section>
      {:else}
        <section class="example-group">
          <div class="group-head">
            <h3>{t("device")}</h3>
            <span>command, options</span>
          </div>

          <div class="method-card">
            <div class="method-card-head">
              <div class="method-card-title">
                <strong>Font</strong>
              </div>
            </div>

            <label class="field media-field" title={t("tipFont")}>
              <strong>value</strong>
              <select bind:value={fontValue}>
                <option value="a">A</option>
                <option value="b">B</option>
              </select>
            </label>
          </div>

          <div class="method-card-grid">
            <div class="method-card compact-card">
              <div class="method-card-head">
                <div class="method-card-title">
                  <strong>Invert</strong>
                </div>
                <label class="method-toggle media-use" title={t("tipInvert")}>
                  <input bind:checked={invertEnabled} type="checkbox">
                  <span>{t("use")}</span>
                </label>
              </div>
            </div>

            <div class="method-card compact-card">
              <div class="method-card-head">
                <div class="method-card-title">
                  <strong>Cash drawer</strong>
                </div>
                <label class="method-toggle media-use" title={t("tipCashDrawer")}>
                  <input bind:checked={cashDrawerEnabled} type="checkbox">
                  <span>{t("use")}</span>
                </label>
              </div>
            </div>

            <div class="method-card compact-card">
              <div class="method-card-head">
                <div class="method-card-title">
                  <strong>Beep</strong>
                </div>
                <label class="method-toggle media-use" title={t("tipBeep")}>
                  <input bind:checked={beepEnabled} type="checkbox">
                  <span>{t("use")}</span>
                </label>
              </div>
            </div>
          </div>
        </section>
      {/if}
    </div>

      </div>

    <LivePreview
      columns={getReceiptWidth()}
      {encodedReceipt}
      {livePreview}
      methodText={liveMethod}
      {paper}
      previewFontSize={receiptPreviewFontSize}
      {t}
    />
    </div>
  </section>

  <section class="panel target-panel" aria-labelledby="targetTitle">
    <div class="panel-head stacked">
      <div>
        <h2 id="targetTitle">{t("printerTarget")}</h2>
      </div>

      <div class="tab-list" role="tablist" aria-label={t("printerTargets")} tabindex="0" on:keydown={handleTabKey}>
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

    <div class="form-stack">
      <label class="field short-field">
        <span>{t("copies")}</span>
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
          <button type="button" class="secondary-button" disabled={pending.serial} on:click={(event) => showTargetDetail("serial", event)}>{t("detail")}</button>
          <button type="button" class="secondary-button" disabled={pending.serial} on:click={() => refreshTarget("serial")}>{pending.serial ? t("loading") : t("refresh")}</button>
        </div>
      </div>

      <div class="target-content-grid">
        <div class="target-editor">
          <label class="field">
            <span>{t("portInput")}</span>
            <input bind:value={serialInputPath} type="text" placeholder="COM3 또는 /dev/ttyS2">
          </label>

          <div class="inline-grid three">
            <label class="field">
              <span>{t("baudRate")}</span>
              <select bind:value={baudRate}>
                {#each baudRates as rate}
                  <option value={rate}>{rate}</option>
                {/each}
              </select>
            </label>

            <label class="field">
              <span>{t("dataBits")}</span>
              <select bind:value={dataBits}>
                <option value={8}>8</option>
                <option value={7}>7</option>
                <option value={6}>6</option>
                <option value={5}>5</option>
              </select>
            </label>

            <label class="field">
              <span>{t("stopBits")}</span>
              <select bind:value={stopBits}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
          </div>

          <div class="inline-grid two">
            <label class="field">
              <span>{t("parity")}</span>
              <select bind:value={parity}>
                <option value="none">none</option>
                <option value="even">even</option>
                <option value="odd">odd</option>
                <option value="mark">mark</option>
                <option value="space">space</option>
              </select>
            </label>

            <label class="field">
              <span>{t("flowControl")}</span>
              <select bind:value={flowControl}>
                <option value="">none</option>
                <option value="rtscts">rtscts</option>
                <option value="xon">xon</option>
                <option value="xoff">xoff</option>
              </select>
            </label>
          </div>

          <button type="button" disabled={pending.print} on:click={() => printTarget("serial")}>
            {pending.print ? t("printing") : t("serialPrint")}
          </button>
        </div>

        <TargetOptionList
          title={t("ports")}
          items={serialPorts}
          value={serialPath}
          getValue={(port) => port.path}
          getLabel={serialLabel}
          emptyText={t("choosePort")}
          onSelect={selectSerialPortItem}
        />
      </div>
    </div>

    <div id="panel-network" class:hidden-panel={activeTab !== "network"} class="target-tab" role="tabpanel" aria-labelledby="tab-network" tabindex="0">
      <div class="target-head">
        <div>
          <h3>Network</h3>
          <span>{getTargetStatus("network")}</span>
        </div>
        <div class="target-actions">
          <button type="button" class="secondary-button" disabled={pending.network} on:click={(event) => showTargetDetail("network", event)}>{t("detail")}</button>
          <button type="button" class="secondary-button" disabled={pending.network} on:click={() => refreshTarget("network")}>{pending.network ? t("loading") : t("refresh")}</button>
        </div>
      </div>

      <div class="target-content-grid">
        <div class="target-editor">
          <div class="inline-grid two">
            <label class="field">
              <span>{t("host")}</span>
              <input bind:value={networkHost} type="text" placeholder="192.168.0.50">
            </label>

            <label class="field">
              <span>{t("port")}</span>
              <input bind:value={networkPort} type="number" min="1" max="65535">
            </label>
          </div>

          <button type="button" disabled={pending.print} on:click={() => printTarget("network")}>
            {pending.print ? t("printing") : t("networkPrint")}
          </button>
        </div>

        <TargetOptionList
          title={t("printers")}
          items={networkPrinters}
          value={networkPreset}
          getValue={networkPrinterValue}
          getLabel={networkLabel}
          emptyText={t("directInput")}
          onSelect={selectNetworkPrinterItem}
        />
      </div>
    </div>

    <div id="panel-usb" class:hidden-panel={activeTab !== "usb"} class="target-tab" role="tabpanel" aria-labelledby="tab-usb" tabindex="0">
      <div class="target-head">
        <div>
          <h3>USB</h3>
          <span>{capabilities.usb === "ready" ? getTargetStatus("usb") : t("usbUnavailable")}</span>
        </div>
        <div class="target-actions">
          <button type="button" class="secondary-button" disabled={pending.usb || capabilities.usb !== "ready"} on:click={(event) => showTargetDetail("usb", event)}>{t("detail")}</button>
          <button type="button" class="secondary-button" disabled={pending.usb || capabilities.usb !== "ready"} on:click={() => refreshTarget("usb")}>{pending.usb ? t("loading") : t("refresh")}</button>
        </div>
      </div>

      <div class="target-content-grid">
        <div class="target-editor">
          <label class="field">
            <span>{t("printerName")}</span>
            <input bind:value={usbName} type="text" placeholder="printer name" disabled={capabilities.usb !== "ready"}>
          </label>

          <button type="button" disabled={pending.print || capabilities.usb !== "ready"} on:click={() => printTarget("usb")}>
            {pending.print ? t("printing") : t("usbPrint")}
          </button>
        </div>

        <TargetOptionList
          title={t("printers")}
          items={usbPrinters}
          value={usbName}
          getValue={(printer) => printer.name}
          getLabel={usbLabel}
          emptyText={capabilities.usb === "ready" ? t("choosePrinter") : t("usbUnavailable")}
          disabled={capabilities.usb !== "ready"}
          onSelect={selectUsbPrinterItem}
        />
      </div>
    </div>
  </section>

  <RunLogPanel {clearLogs} {logs} {openLog} {t} />
</main>

<dialog bind:this={logDialog} class="log-dialog" aria-labelledby="logDialogTitle" on:close={() => lastFocusedElement?.focus?.()}>
  <div class="dialog-head">
    <h2 id="logDialogTitle">{selectedLog?.title ?? t("detail")}</h2>
    <div class="dialog-actions">
      <span aria-live="polite">{copyStatus}</span>
      <button type="button" class="secondary-button" on:click={copyLogDialogJson}>{t("copy")}</button>
      <button type="button" on:click={closeLogDialog}>{t("close")}</button>
    </div>
  </div>

  <pre>{selectedLog ? JSON.stringify(selectedLog, null, 2) : ""}</pre>
</dialog>
{/key}

<style>
  /* Toss style foundation */
  :global(body) {
    background: #f5f7fa;
  }

  :global(button) {
    min-height: 44px;
    border-radius: 12px;
    font-weight: 800;
  }

  :global(input),
  :global(select),
  :global(textarea) {
    border-color: #e5e8eb;
    border-radius: 12px;
    background: #f9fafb;
  }

  :global(input:hover),
  :global(select:hover),
  :global(textarea:hover) {
    border-color: #cfd6df;
  }

  :global(input:focus),
  :global(select:focus),
  :global(textarea:focus) {
    border-color: #3182f6;
    background: #ffffff;
  }

  .panel {
    border: 1px solid #e9edf3;
    border-radius: 20px;
    box-shadow: 0 8px 24px rgb(15 23 42 / 0.05);
  }

  .panel-head {
    padding: 20px 24px;
    border-bottom-color: #eef1f5;
  }

  .panel-head h2 {
    font-size: 20px;
  }

  .form-stack,
  .example-stack,
  .target-tab {
    gap: 16px;
    padding: 20px 24px;
  }

  /* Receipt workspace */
  .page-shell {
    grid-template-columns: minmax(460px, 1.55fr) minmax(340px, 0.9fr) minmax(260px, 0.55fr);
    align-items: stretch;
    height: calc(100vh - 84px);
    max-width: none;
  }

  .receipt-panel,
  .target-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-height: none;
    overflow: hidden;
  }

  :global(.log-panel) {
    height: 100%;
    max-height: none;
    min-width: 0;
  }

  .receipt-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
    align-items: start;
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .builder-controls {
    min-width: 0;
  }

  .field {
    gap: 8px;
    color: #4e5968;
    font-size: 13px;
    font-weight: 800;
  }

  .field span {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .method-list {
    display: grid;
    overflow: hidden;
    border: 1px solid #eef1f5;
    border-radius: 14px;
  }

  .method-row {
    display: grid;
    gap: 12px;
    align-items: center;
    min-width: 0;
    padding: 12px 14px;
    background: #ffffff;
    border-top: 1px solid #eef1f5;
  }

  .method-row:first-child {
    border-top: 0;
  }

  .method-row-grid {
    grid-template-columns: minmax(124px, 140px) minmax(0, 1fr);
    grid-auto-columns: minmax(92px, 124px);
    grid-auto-flow: column;
  }

  .method-row-wide {
    grid-template-columns: minmax(124px, 140px) minmax(0, 1fr) minmax(92px, 124px);
    align-items: start;
  }

  .method-row-field {
    grid-template-columns: minmax(124px, 140px) 52px minmax(0, 1fr);
  }

  .method-toggle,
  .method-label {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    min-height: 38px;
    color: #4e5968;
    font-size: 13px;
    font-weight: 800;
    overflow: hidden;
  }

  .method-toggle input {
    width: 18px;
    min-height: 18px;
    margin: 0;
    accent-color: #3182f6;
  }

  .method-row .field {
    gap: 6px;
    min-width: 0;
  }

  .method-row .field strong,
  .method-row-field > strong {
    color: #6b7684;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
  }

  .method-row input,
  .method-row select {
    min-height: 36px;
  }

  .method-row textarea {
    min-height: 72px;
  }

  .short-method-field input {
    text-align: center;
  }

  .media-card,
  .method-card {
    display: grid;
    gap: 12px;
    min-width: 0;
    overflow: hidden;
    padding: 14px;
    background: #fbfcfe;
    border: 1px solid #eef1f5;
    border-radius: 14px;
  }

  .media-card-head,
  .method-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    gap: 12px;
  }

  .media-title,
  .method-card-title {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
    line-height: 1.25;
    overflow: hidden;
  }

  .media-title strong,
  .method-card-title strong {
    color: #141922;
    font-size: 15px;
    font-weight: 900;
  }

  .method-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 10px;
  }

  .compact-card {
    min-width: 0;
  }

  .compact-card .method-card-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }

  .media-use,
  .media-inline-toggle {
    flex: 0 0 auto;
    min-height: 34px;
    padding: 0 10px;
    background: #ffffff;
    border: 1px solid #e5e8eb;
    border-radius: 10px;
    white-space: nowrap;
  }

  .media-use:has(input:checked),
  .media-inline-toggle:has(input:checked) {
    color: #1b64da;
    background: #f7fbff;
    border-color: #9ac7ff;
  }

  .media-fields,
  .method-card-fields {
    display: grid;
    gap: 10px;
    align-items: end;
  }

  .media-fields.three,
  .method-card-fields.three {
    grid-template-columns: minmax(0, 1fr) minmax(112px, 140px) minmax(112px, 140px);
  }

  .method-card-fields.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .media-fields.four {
    grid-template-columns: minmax(0, 1fr) repeat(3, minmax(88px, 120px));
  }

  .media-field {
    gap: 6px;
    min-width: 0;
  }

  .media-field strong {
    color: #6b7684;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
  }

  .media-field input,
  .media-field select {
    min-height: 36px;
  }

  .media-action {
    min-height: 36px;
  }

  .example-group {
    gap: 16px;
    padding: 18px;
    background: #ffffff;
    border-color: #eef1f5;
    border-radius: 18px;
  }

  .primary-method-panel {
    background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  }

  .group-head {
    align-items: flex-start;
    padding-bottom: 2px;
  }

  .group-head h3 {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 100%;
    font-size: 17px;
  }

  .group-head span {
    padding-top: 3px;
    color: #8b95a1;
    white-space: nowrap;
  }

  .receipt-option-nav {
    top: 77px;
    gap: 8px;
    padding: 12px 24px;
    border-bottom-color: #eef1f5;
  }

  .receipt-option-nav button {
    min-height: 44px;
    color: #4e5968;
    background: #f2f4f6;
    border-radius: 12px;
  }

  .receipt-option-nav button:hover,
  .receipt-option-nav button.active {
    color: #1b64da;
    background: #eaf3ff;
    border-color: transparent;
  }

  .receipt-code-page {
    display: grid;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid #eef1f5;
  }

  .code-page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .code-page-head h3 {
    margin: 0;
    color: #141922;
    font-size: 16px;
    font-weight: 900;
  }

  .code-page-head span {
    display: block;
    margin-top: 4px;
    color: #8b95a1;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
  }

  .code-page-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
    min-width: 0;
  }

  .code-page-list button {
    display: grid;
    justify-items: start;
    gap: 4px;
    min-width: 0;
    min-height: 54px;
    padding: 9px 10px;
    color: #4e5968;
    background: #f9fafb;
    border: 1px solid #e5e8eb;
    border-radius: 12px;
    text-align: left;
  }

  .code-page-list button:hover,
  .code-page-list button.active {
    color: #1b64da;
    background: #eaf3ff;
    border-color: #9ac7ff;
  }

  .code-page-list span,
  .code-page-list strong {
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .code-page-list span {
    font-size: 12px;
    font-weight: 900;
  }

  .code-page-list strong {
    color: inherit;
    font-size: 11px;
    font-weight: 800;
  }

  .target-head {
    padding-bottom: 8px;
  }

  .target-content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(140px, 0.72fr);
    gap: 12px;
    align-items: start;
  }

  .target-editor {
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  @media (max-width: 1280px) {
    .page-shell {
      grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.82fr);
      height: auto;
      min-height: calc(100vh - 84px);
    }

    :global(.log-panel) {
      grid-column: 1 / -1;
      min-height: 320px;
    }
  }

  @media (max-width: 1120px) {
    .receipt-workspace {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 980px) {
    .page-shell {
      grid-template-columns: 1fr;
    }

    .receipt-panel,
    .target-panel,
    :global(.log-panel) {
      height: auto;
      max-height: none;
    }
  }

  @media (max-width: 720px) {
    .method-row-grid,
    .method-row-wide,
    .method-row-field,
    .method-card-grid,
    .method-card-fields.two,
    .method-card-fields.three,
    .media-fields.three,
    .media-fields.four,
    .target-content-grid {
      grid-template-columns: 1fr;
      grid-auto-flow: row;
    }

    .group-head {
      display: grid;
    }

    .group-head span {
      white-space: normal;
    }
  }
</style>
