{
  "targets": [
    {
      "target_name": "winspool",
      "sources": [
        "native/src/winspool.cc"
      ],
      "defines": [
        "NAPI_VERSION=3"
      ],
      "cflags_cc": [
        "-std=c++17"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "LanguageStandard": "stdcpp17",
          "AdditionalOptions": [
            "/utf-8"
          ]
        }
      },
      "conditions": [
        [
          "OS==\"win\"",
          {
            "libraries": [
              "Winspool.lib"
            ]
          }
        ]
      ]
    }
  ]
}
