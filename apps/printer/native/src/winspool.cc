#include <node_api.h>

#include <algorithm>
#include <cstdint>
#include <cwchar>
#include <string>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#include <winspool.h>
#endif

namespace {

// N-API helpers

struct PromiseState {
  napi_deferred deferred;
  napi_value promise;
};

struct PrintRawRequest {
  napi_env env = nullptr;
  napi_deferred deferred = nullptr;
  napi_async_work work = nullptr;
  std::wstring printerName;
  std::wstring documentName;
  std::vector<uint8_t> bytes;
  std::string errorCode;
  std::string errorMessage;
  std::string operation;
  DWORD win32Code = 0;
  DWORD jobId = 0;
  size_t bytesWritten = 0;
  bool ok = false;
  bool hasWin32Error = false;
};

PromiseState CreatePromise(napi_env env) {
  PromiseState state;

  napi_create_promise(env, &state.deferred, &state.promise);

  return state;
}

napi_value CreateFunction(napi_env env, const char* name, napi_callback callback) {
  napi_value value;

  napi_create_function(env, name, NAPI_AUTO_LENGTH, callback, nullptr, &value);

  return value;
}

napi_value CreateString(napi_env env, const char* value) {
  napi_value output;

  napi_create_string_utf8(env, value, NAPI_AUTO_LENGTH, &output);

  return output;
}

napi_value CreateNumber(napi_env env, double value) {
  napi_value output;

  napi_create_double(env, value, &output);

  return output;
}

napi_value CreateUint32(napi_env env, uint32_t value) {
  napi_value output;

  napi_create_uint32(env, value, &output);

  return output;
}

void SetProperty(napi_env env, napi_value object, const char* name, napi_value value) {
  napi_set_named_property(env, object, name, value);
}

napi_value CreateError(napi_env env, const char* code, const char* message) {
  napi_value error;

  napi_create_error(env, nullptr, CreateString(env, message), &error);
  SetProperty(env, error, "code", CreateString(env, code));

  return error;
}

napi_value Reject(napi_env env, PromiseState state, napi_value error) {
  napi_reject_deferred(env, state.deferred, error);

  return state.promise;
}

napi_value Resolve(napi_env env, PromiseState state, napi_value value) {
  napi_resolve_deferred(env, state.deferred, value);

  return state.promise;
}

napi_value RejectMessage(napi_env env, PromiseState state, const char* code, const char* message) {
  return Reject(env, state, CreateError(env, code, message));
}

#ifdef _WIN32

// String helpers

// Win32 wide 문자열을 JS 오류 메시지용 UTF-8로 변환함
std::string WideToUtf8(const std::wstring& value) {
  if (value.empty()) {
    return "";
  }

  const int required = WideCharToMultiByte(
    CP_UTF8,
    0,
    value.c_str(),
    static_cast<int>(value.size()),
    nullptr,
    0,
    nullptr,
    nullptr
  );

  // 변환 크기 계산 실패는 빈 문자열로 안전하게 축소함
  if (required <= 0) {
    return "";
  }

  std::string output(static_cast<size_t>(required), '\0');

  const int written = WideCharToMultiByte(
    CP_UTF8,
    0,
    value.c_str(),
    static_cast<int>(value.size()),
    output.data(),
    required,
    nullptr,
    nullptr
  );

  // 계산한 길이와 실제 변환 길이가 다르면 결과를 버림
  if (written != required) {
    return "";
  }

  return output;
}

// FormatMessageW 결과 끝의 개행과 공백을 제거함
std::wstring TrimMessage(std::wstring value) {
  while (!value.empty() && (value.back() == L'\r' || value.back() == L'\n' || value.back() == L' ')) {
    value.pop_back();
  }

  return value;
}

// Win32 오류 코드를 사람이 읽을 수 있는 메시지로 변환함
std::wstring FormatWin32Message(DWORD code) {
  LPWSTR buffer = nullptr;
  const DWORD length = FormatMessageW(
    FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
    nullptr,
    code,
    MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
    reinterpret_cast<LPWSTR>(&buffer),
    0,
    nullptr
  );

  // 시스템 메시지를 얻지 못하면 기본 spooler 오류 문구를 사용함
  if (length == 0 || !buffer) {
    return L"Windows Spooler operation failed";
  }

  std::wstring message(buffer, length);

  LocalFree(buffer);

  return TrimMessage(message);
}

// Win32 wide 문자열을 Node UTF-16 문자열로 노출함
napi_value CreateWideString(napi_env env, const wchar_t* value) {
  napi_value output;

  // 선택 필드는 null 포인터일 때 undefined로 노출함
  if (!value) {
    napi_get_undefined(env, &output);
    return output;
  }

  napi_create_string_utf16(
    env,
    reinterpret_cast<const char16_t*>(value),
    wcslen(value),
    &output
  );

  return output;
}

// JS 문자열 값을 Win32 wide 문자열로 복사함
bool ReadWideString(napi_env env, napi_value value, std::wstring* output) {
  size_t length = 0;

  if (napi_get_value_string_utf16(env, value, nullptr, 0, &length) != napi_ok) {
    return false;
  }

  std::vector<char16_t> buffer(length + 1);
  size_t copied = 0;

  if (napi_get_value_string_utf16(env, value, buffer.data(), buffer.size(), &copied) != napi_ok) {
    return false;
  }

  *output = std::wstring(
    reinterpret_cast<const wchar_t*>(buffer.data()),
    copied
  );

  return true;
}

// 객체의 문자열 속성만 wide 문자열로 읽음
bool ReadStringProperty(napi_env env, napi_value object, const char* name, std::wstring* output) {
  napi_value value;
  bool hasProperty = false;

  napi_has_named_property(env, object, name, &hasProperty);

  if (!hasProperty) {
    return false;
  }

  napi_get_named_property(env, object, name, &value);

  napi_valuetype type;
  napi_typeof(env, value, &type);

  if (type != napi_string) {
    return false;
  }

  return ReadWideString(env, value, output);
}

// Win32 오류 코드 중 프린터 없음으로 매핑할 값을 분류함
bool IsPrinterNotFound(DWORD code) {
  return code == ERROR_INVALID_PRINTER_NAME || code == ERROR_FILE_NOT_FOUND;
}

// Win32 실패 정보를 JS Error 객체의 code와 메타데이터로 변환함
napi_value CreateWin32Error(
  napi_env env,
  const char* operation,
  DWORD win32Code,
  const std::wstring& printerName = L""
) {
  const char* errorCode = IsPrinterNotFound(win32Code)
    ? "ERR_PRINTER_NOT_FOUND"
    : "ERR_WINSPOOL_FAILED";
  const std::wstring win32Message = FormatWin32Message(win32Code);
  std::string message = std::string("Winspool ") + operation + " failed";

  // 프린터명이 있으면 오류 메시지에 함께 담음
  if (!printerName.empty()) {
    message += " for printer ";
    message += WideToUtf8(printerName);
  }

  message += ": ";
  message += WideToUtf8(win32Message);

  napi_value error = CreateError(env, errorCode, message.c_str());

  SetProperty(env, error, "operation", CreateString(env, operation));
  SetProperty(env, error, "win32Code", CreateUint32(env, win32Code));

  // 프린터명이 있으면 오류 속성에도 함께 담음
  if (!printerName.empty()) {
    SetProperty(env, error, "printerName", CreateWideString(env, printerName.c_str()));
  }

  return error;
}

// 마지막 Win32 오류를 promise rejection으로 변환함
napi_value RejectLastWin32Error(
  napi_env env,
  PromiseState state,
  const char* operation,
  const std::wstring& printerName = L"",
  DWORD explicitCode = 0
) {
  const DWORD code = explicitCode == 0 ? GetLastError() : explicitCode;

  return Reject(env, state, CreateWin32Error(env, operation, code, printerName));
}

// Object helpers

// PRINTER_INFO_2W를 JS에서 쓰는 printer info 객체로 옮김
napi_value CreatePrinterInfo(napi_env env, const PRINTER_INFO_2W& info) {
  napi_value object;

  napi_create_object(env, &object);

  SetProperty(env, object, "name", CreateWideString(env, info.pPrinterName));
  SetProperty(env, object, "status", CreateUint32(env, info.Status));

  // 선택 필드는 Win32 값이 있을 때만 노출함
  if (info.pDriverName) {
    SetProperty(env, object, "driverName", CreateWideString(env, info.pDriverName));
  }

  // 선택 필드는 Win32 값이 있을 때만 노출함
  if (info.pPortName) {
    SetProperty(env, object, "portName", CreateWideString(env, info.pPortName));
  }

  return object;
}

// Buffer와 Uint8Array 계열 data 입력을 native byte 포인터로 읽음
bool ReadDataProperty(napi_env env, napi_value object, const uint8_t** data, size_t* length) {
  napi_value value;
  bool hasProperty = false;

  napi_has_named_property(env, object, "data", &hasProperty);

  // data 속성이 없으면 validation 실패로 돌려보냄
  if (!hasProperty) {
    return false;
  }

  napi_get_named_property(env, object, "data", &value);

  bool isBuffer = false;
  napi_is_buffer(env, value, &isBuffer);

  // Buffer 입력은 추가 복사 없이 backing memory를 참조함
  if (isBuffer) {
    void* rawData = nullptr;

    if (napi_get_buffer_info(env, value, &rawData, length) != napi_ok) {
      return false;
    }

    *data = static_cast<const uint8_t*>(rawData);

    return true;
  }

  bool isTypedArray = false;
  napi_is_typedarray(env, value, &isTypedArray);

  // Buffer가 아닌 값은 Uint8Array 계열만 허용함
  if (!isTypedArray) {
    return false;
  }

  napi_typedarray_type type;
  size_t typedArrayLength = 0;
  void* rawData = nullptr;
  napi_value arrayBuffer;
  size_t byteOffset = 0;

  if (napi_get_typedarray_info(
    env,
    value,
    &type,
    &typedArrayLength,
    &rawData,
    &arrayBuffer,
    &byteOffset
  ) != napi_ok) {
    return false;
  }

  // Uint8Array와 Uint8ClampedArray 외 typed array는 거부함
  if (type != napi_uint8_array && type != napi_uint8_clamped_array) {
    return false;
  }

  *data = static_cast<const uint8_t*>(rawData);
  *length = typedArrayLength;

  return true;
}

// Async print worker

// worker thread의 Win32 실패를 완료 콜백에서 처리하도록 기록함
void SetWin32Failure(PrintRawRequest* request, const char* operation, DWORD code) {
  request->operation = operation;
  request->win32Code = code;
  request->hasWin32Error = true;
}

// Win32 코드가 없는 내부 실패를 완료 콜백에 전달함
void SetMessageFailure(PrintRawRequest* request, const char* code, const char* message) {
  request->errorCode = code;
  request->errorMessage = message;
}

// worker thread에서 Winspool raw 출력 생명주기를 순서대로 실행함
void ExecutePrintRaw(napi_env env, void* data) {
  (void)env;

  auto* request = static_cast<PrintRawRequest*>(data);
  HANDLE printerHandle = nullptr;

  // OpenPrinterW 실패는 프린터 접근 단계의 Win32 오류로 기록함
  if (!OpenPrinterW(const_cast<LPWSTR>(request->printerName.c_str()), &printerHandle, nullptr)) {
    SetWin32Failure(request, "OpenPrinterW", GetLastError());
    return;
  }

  // RAW 문서 정보를 구성해 spooler job을 시작할 준비를 함
  DOC_INFO_1W documentInfo;
  documentInfo.pDocName = const_cast<LPWSTR>(request->documentName.c_str());
  documentInfo.pOutputFile = nullptr;
  documentInfo.pDatatype = const_cast<LPWSTR>(L"RAW");

  const DWORD jobId = StartDocPrinterW(printerHandle, 1, reinterpret_cast<LPBYTE>(&documentInfo));

  // StartDocPrinterW 실패 시 열린 printer handle을 닫고 중단함
  if (jobId == 0) {
    SetWin32Failure(request, "StartDocPrinterW", GetLastError());
    ClosePrinter(printerHandle);
    return;
  }

  // 페이지 시작 실패는 spool job을 abort하고 handle을 닫음
  if (!StartPagePrinter(printerHandle)) {
    SetWin32Failure(request, "StartPagePrinter", GetLastError());
    AbortPrinter(printerHandle);
    ClosePrinter(printerHandle);
    return;
  }

  size_t totalWritten = 0;

  // WritePrinter 제한을 넘지 않도록 데이터를 여러 청크로 나누어 씀
  while (totalWritten < request->bytes.size()) {
    const size_t remaining = request->bytes.size() - totalWritten;
    const DWORD requested = static_cast<DWORD>(std::min<size_t>(remaining, 0x7fffffff));
    DWORD written = 0;

    // WritePrinter 실패는 job을 abort해 부분 출력 상태를 정리함
    if (!WritePrinter(
      printerHandle,
      request->bytes.data() + totalWritten,
      requested,
      &written
    )) {
      SetWin32Failure(request, "WritePrinter", GetLastError());
      AbortPrinter(printerHandle);
      ClosePrinter(printerHandle);
      return;
    }

    // 0바이트 write는 무한 루프를 피하기 위해 내부 실패로 처리함
    if (written == 0) {
      SetMessageFailure(request, "ERR_WINSPOOL_FAILED", "WritePrinter wrote zero bytes");
      AbortPrinter(printerHandle);
      ClosePrinter(printerHandle);
      return;
    }

    totalWritten += written;
  }

  // 페이지 종료 실패는 job을 abort하고 handle을 닫음
  if (!EndPagePrinter(printerHandle)) {
    SetWin32Failure(request, "EndPagePrinter", GetLastError());
    AbortPrinter(printerHandle);
    ClosePrinter(printerHandle);
    return;
  }

  // 문서 종료 실패는 job을 abort하고 handle을 닫음
  if (!EndDocPrinter(printerHandle)) {
    SetWin32Failure(request, "EndDocPrinter", GetLastError());
    AbortPrinter(printerHandle);
    ClosePrinter(printerHandle);
    return;
  }

  // ClosePrinter 실패는 출력 성공 대신 cleanup 실패로 보고함
  if (!ClosePrinter(printerHandle)) {
    SetWin32Failure(request, "ClosePrinter", GetLastError());
    return;
  }

  request->ok = true;
  request->jobId = jobId;
  request->bytesWritten = totalWritten;
}

// main thread에서 worker 결과를 promise resolve 또는 reject로 마무리함
void CompletePrintRaw(napi_env env, napi_status status, void* data) {
  auto* request = static_cast<PrintRawRequest*>(data);

  napi_delete_async_work(env, request->work);

  // N-API async work 자체 실패는 일반 Winspool 실패로 반환함
  if (status != napi_ok) {
    napi_reject_deferred(
      env,
      request->deferred,
      CreateError(env, "ERR_WINSPOOL_FAILED", "Winspool async work failed")
    );
    delete request;
    return;
  }

  // 성공 시 jobId와 실제 기록한 byte 수를 JS로 반환함
  if (request->ok) {
    napi_value result;

    napi_create_object(env, &result);
    SetProperty(env, result, "jobId", CreateUint32(env, request->jobId));
    SetProperty(env, result, "bytesWritten", CreateNumber(env, static_cast<double>(request->bytesWritten)));
    napi_resolve_deferred(env, request->deferred, result);
    delete request;
    return;
  }

  // Win32 API 실패는 operation과 win32Code를 포함해 reject함
  if (request->hasWin32Error) {
    napi_reject_deferred(
      env,
      request->deferred,
      CreateWin32Error(
        env,
        request->operation.c_str(),
        request->win32Code,
        request->printerName
      )
    );
    delete request;
    return;
  }

  napi_reject_deferred(
    env,
    request->deferred,
    CreateError(env, request->errorCode.c_str(), request->errorMessage.c_str())
  );
  delete request;
}

// Winspool operations

// EnumPrintersW 두 번 호출 패턴으로 프린터 목록을 조회함
napi_value ListPrintersWindows(napi_env env, PromiseState state) {
  DWORD needed = 0;
  DWORD returned = 0;
  const DWORD flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;

  // 첫 호출은 필요한 buffer 크기를 얻기 위한 Win32 probe임
  EnumPrintersW(flags, nullptr, 2, nullptr, 0, &needed, &returned);

  const DWORD firstError = GetLastError();

  // 필요 buffer가 없으면 빈 목록인지 API 실패인지 GetLastError로 구분함
  if (needed == 0) {
    // 프린터가 없는 정상 상태는 빈 배열로 반환함
    if (firstError == ERROR_SUCCESS) {
      napi_value printers;

      napi_create_array_with_length(env, 0, &printers);

      return Resolve(env, state, printers);
    }

    return RejectLastWin32Error(env, state, "EnumPrintersW", L"", firstError);
  }

  std::vector<BYTE> buffer(needed);

  // 두 번째 EnumPrintersW 호출 실패는 최신 Win32 오류로 반환함
  if (!EnumPrintersW(flags, nullptr, 2, buffer.data(), needed, &needed, &returned)) {
    return RejectLastWin32Error(env, state, "EnumPrintersW");
  }

  const auto* printerInfo = reinterpret_cast<const PRINTER_INFO_2W*>(buffer.data());
  napi_value printers;

  napi_create_array_with_length(env, returned, &printers);

  for (DWORD index = 0; index < returned; index += 1) {
    napi_set_element(env, printers, index, CreatePrinterInfo(env, printerInfo[index]));
  }

  return Resolve(env, state, printers);
}

// GetDefaultPrinterW buffer probe 후 기본 프린터 이름을 읽음
napi_value GetDefaultPrinterWindows(napi_env env, PromiseState state) {
  DWORD needed = 0;

  // 첫 호출은 필요한 문자열 길이를 얻기 위한 Win32 probe임
  GetDefaultPrinterW(nullptr, &needed);

  const DWORD firstError = GetLastError();

  // 기본 프린터가 없는 Windows 상태는 null로 반환함
  if (firstError == ERROR_FILE_NOT_FOUND) {
    napi_value nullValue;

    napi_get_null(env, &nullValue);

    return Resolve(env, state, nullValue);
  }

  // buffer 크기 probe가 예상 오류가 아니면 Win32 실패로 반환함
  if (needed == 0 || firstError != ERROR_INSUFFICIENT_BUFFER) {
    return RejectLastWin32Error(env, state, "GetDefaultPrinterW", L"", firstError);
  }

  std::vector<wchar_t> buffer(needed);

  // 실제 기본 프린터 이름 조회 실패는 최신 Win32 오류로 반환함
  if (!GetDefaultPrinterW(buffer.data(), &needed)) {
    return RejectLastWin32Error(env, state, "GetDefaultPrinterW");
  }

  return Resolve(env, state, CreateWideString(env, buffer.data()));
}

// CreateDC + GetDeviceCaps로 드라이버에 설정된 용지 너비 정보를 조회함
napi_value GetPrinterCapabilitiesWindows(napi_env env, PromiseState state, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];

  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  // printerName 인자가 없으면 native 작업을 만들기 전에 거부함
  if (argc < 1) {
    return RejectMessage(env, state, "ERR_INVALID_TARGET", "printerName is required");
  }

  std::wstring printerName;

  // printerName은 비어 있지 않은 문자열만 허용함
  if (!ReadWideString(env, args[0], &printerName) || printerName.empty()) {
    return RejectMessage(env, state, "ERR_INVALID_TARGET", "printerName is required");
  }

  // 프린터 드라이버 device context를 열어 인쇄 영역 정보를 읽음
  HDC printerDc = CreateDCW(L"WINSPOOL", printerName.c_str(), nullptr, nullptr);

  // device context 생성 실패는 프린터 접근 단계의 Win32 오류로 반환함
  if (!printerDc) {
    return RejectLastWin32Error(env, state, "CreateDCW", printerName);
  }

  const int printableWidthDots = GetDeviceCaps(printerDc, HORZRES);
  const int dpi                = GetDeviceCaps(printerDc, LOGPIXELSX);
  const int widthMm            = GetDeviceCaps(printerDc, HORZSIZE);

  DeleteDC(printerDc);

  napi_value result;

  napi_create_object(env, &result);
  SetProperty(env, result, "printableWidthDots", CreateNumber(env, printableWidthDots));
  SetProperty(env, result, "widthMm", CreateNumber(env, widthMm));
  SetProperty(env, result, "dpi", CreateNumber(env, dpi));

  return Resolve(env, state, result);
}

// JS printRaw 입력을 검증하고 async worker 요청으로 포장함
napi_value PrintRawWindows(napi_env env, PromiseState state, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];

  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  // options 인자가 없으면 native 작업을 만들기 전에 거부함
  if (argc < 1) {
    return RejectMessage(env, state, "ERR_INVALID_TARGET", "printRaw options are required");
  }

  napi_valuetype optionsType;

  napi_typeof(env, args[0], &optionsType);

  // options가 객체가 아니면 native 작업을 만들기 전에 거부함
  if (optionsType != napi_object) {
    return RejectMessage(env, state, "ERR_INVALID_TARGET", "printRaw options must be an object");
  }

  std::wstring printerName;
  std::wstring documentName = L"RAW Document";

  // printerName은 비어 있지 않은 문자열만 허용함
  if (!ReadStringProperty(env, args[0], "printerName", &printerName) || printerName.empty()) {
    return RejectMessage(env, state, "ERR_INVALID_TARGET", "printerName is required");
  }

  // documentName은 선택값이며 없으면 기본 RAW 문서명을 유지함
  ReadStringProperty(env, args[0], "documentName", &documentName);

  const uint8_t* data = nullptr;
  size_t length = 0;

  // data는 비어 있지 않은 byte 배열만 허용함
  if (!ReadDataProperty(env, args[0], &data, &length) || !data || length == 0) {
    return RejectMessage(env, state, "ERR_INVALID_TARGET", "print data is required");
  }

  auto* request = new PrintRawRequest();

  // worker thread에서 안전하게 쓰도록 JS 입력을 request에 복사함
  request->env = env;
  request->deferred = state.deferred;
  request->printerName = printerName;
  request->documentName = documentName;
  request->bytes.assign(data, data + length);

  napi_value resourceName;

  napi_create_string_utf8(env, "WinspoolPrintRaw", NAPI_AUTO_LENGTH, &resourceName);

  const napi_status createStatus = napi_create_async_work(
    env,
    nullptr,
    resourceName,
    ExecutePrintRaw,
    CompletePrintRaw,
    request,
    &request->work
  );

  // async work 생성 실패는 request를 해제하고 즉시 거부함
  if (createStatus != napi_ok) {
    delete request;
    return RejectMessage(env, state, "ERR_WINSPOOL_FAILED", "Failed to create winspool async work");
  }

  const napi_status queueStatus = napi_queue_async_work(env, request->work);

  // queue 등록 실패는 async work와 request를 함께 정리함
  if (queueStatus != napi_ok) {
    napi_delete_async_work(env, request->work);
    delete request;
    return RejectMessage(env, state, "ERR_WINSPOOL_FAILED", "Failed to queue winspool async work");
  }

  return state.promise;
}

#endif

// Public bindings

// JS listPrinters 호출을 platform별 구현 또는 unsupported 오류로 연결함
napi_value ListPrinters(napi_env env, napi_callback_info info) {
  (void)info;

  PromiseState state = CreatePromise(env);

#ifdef _WIN32
  return ListPrintersWindows(env, state);
#else
  return RejectMessage(env, state, "ERR_UNSUPPORTED_PLATFORM", "listPrinters is only supported on Windows");
#endif
}

// JS getDefaultPrinter 호출을 platform별 구현 또는 unsupported 오류로 연결함
napi_value GetDefaultPrinter(napi_env env, napi_callback_info info) {
  (void)info;

  PromiseState state = CreatePromise(env);

#ifdef _WIN32
  return GetDefaultPrinterWindows(env, state);
#else
  return RejectMessage(env, state, "ERR_UNSUPPORTED_PLATFORM", "getDefaultPrinter is only supported on Windows");
#endif
}

// JS printRaw 호출을 platform별 구현 또는 unsupported 오류로 연결함
napi_value PrintRaw(napi_env env, napi_callback_info info) {
  PromiseState state = CreatePromise(env);

#ifdef _WIN32
  return PrintRawWindows(env, state, info);
#else
  (void)info;
  return RejectMessage(env, state, "ERR_UNSUPPORTED_PLATFORM", "printRaw is only supported on Windows");
#endif
}

// JS getPrinterCapabilities 호출을 platform별 구현 또는 unsupported 오류로 연결함
napi_value GetPrinterCapabilities(napi_env env, napi_callback_info info) {
  PromiseState state = CreatePromise(env);

#ifdef _WIN32
  return GetPrinterCapabilitiesWindows(env, state, info);
#else
  (void)info;
  return RejectMessage(env, state, "ERR_UNSUPPORTED_PLATFORM", "getPrinterCapabilities is only supported on Windows");
#endif
}

// Module init

// native 모듈 export에 JS에서 호출할 함수들을 등록함
napi_value Init(napi_env env, napi_value exports) {
  napi_set_named_property(env, exports, "listPrinters", CreateFunction(env, "listPrinters", ListPrinters));
  napi_set_named_property(env, exports, "getDefaultPrinter", CreateFunction(env, "getDefaultPrinter", GetDefaultPrinter));
  napi_set_named_property(env, exports, "printRaw", CreateFunction(env, "printRaw", PrintRaw));
  napi_set_named_property(env, exports, "getPrinterCapabilities", CreateFunction(env, "getPrinterCapabilities", GetPrinterCapabilities));

  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
