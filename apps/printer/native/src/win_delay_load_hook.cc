#ifdef _WIN32

#include <string.h>
#include <windows.h>
#include <delayimp.h>

static FARPROC WINAPI LoadNodeProcess(unsigned int event, DelayLoadInfo* info) {
  if (event != dliNotePreLoadLibrary) {
    return nullptr;
  }

  if (_stricmp(info->szDll, "node.exe") != 0) {
    return nullptr;
  }

  return reinterpret_cast<FARPROC>(GetModuleHandle(nullptr));
}

decltype(__pfnDliNotifyHook2) __pfnDliNotifyHook2 = LoadNodeProcess;

#endif
