# Encoding guide

This package exposes a fixed `ReceiptEncoding` type for receipt text

Runtime text conversion uses `TextEncoder` for `utf8`, an ASCII encoder for `ascii`, and `iconv-lite` for the other values

## Encoding and code page

`encoding(value)` controls how JavaScript strings become bytes

`codePage(page)` sends the ESC/POS `ESC t n` command and asks the printer to use a character table

Use both only when the printer manual says the matching character table must be selected

```ts
const receipt = createReceipt()
  .initialize()
  .codePage(21)
  .encoding("cp949")
  .text("테스트 출력")
  .encode();
```

ESC/POS code page numbers vary by printer model, firmware, region, and emulation mode

Treat the values below as common candidates, then confirm them against the printer manual or a real print test

## Supported encodings

| Encoding       | Common use                                | Common ESC/POS code page candidate       | Notes                                      |
| -------------- | ----------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `utf8`         | Unicode text when the printer supports it | None                                     | Many ESC/POS printers do not render UTF-8 bytes directly |
| `ascii`        | English, numbers, simple symbols          | None                                     | Safe subset on most character tables       |
| `cp437`        | United States, standard Europe            | `0`                                      | Often named PC437                          |
| `cp850`        | Western Europe                            | `2`                                      | Often named PC850 multilingual             |
| `cp852`        | Central and Eastern Europe Latin text     | `18`, sometimes `6`                      | Polish, Czech, Slovak, Hungarian           |
| `cp858`        | Western Europe with Euro sign             | `19`                                     | PC858 is close to PC850 with Euro support  |
| `cp860`        | Portuguese                                | `3`                                      | DOS Portuguese                             |
| `cp863`        | Canadian French                           | `4`                                      | DOS Canadian French                        |
| `cp865`        | Nordic languages                          | `5`                                      | Danish, Norwegian, related Nordic text     |
| `cp866`        | Cyrillic                                  | `17`, sometimes `7`                      | Russian and other Cyrillic text            |
| `cp949`        | Korean                                    | Model specific, often documented by Korean printer vendors | Use the value from the printer manual      |
| `cp932`        | Japanese                                  | Model specific, often `1` on some profiles | May require a Japanese Kanji mode instead of only `ESC t` |
| `cp950`        | Traditional Chinese                       | Model specific                           | Common in Taiwan and Hong Kong             |
| `big5`         | Traditional Chinese                       | Model specific                           | Similar use area to `cp950`                |
| `gb18030`      | Simplified Chinese                        | Model specific                           | Common in mainland China                   |
| `windows-874`  | Thai                                      | Model specific, often Thai table variants | Confirm exact Thai table number            |
| `windows-1250` | Central and Eastern Europe Latin text     | Model specific                           | Windows ANSI code page                     |
| `windows-1251` | Cyrillic                                  | Model specific                           | Windows ANSI code page                     |
| `windows-1252` | Western Europe and Americas Latin text    | `16`                                     | Often named WPC1252                        |
| `windows-1253` | Greek                                     | Model specific                           | Windows ANSI code page                     |
| `windows-1254` | Turkish                                   | Model specific                           | Windows ANSI code page                     |
| `windows-1255` | Hebrew                                    | Model specific                           | Windows ANSI code page                     |
| `windows-1256` | Arabic                                    | Model specific                           | Windows ANSI code page                     |
| `windows-1257` | Baltic languages                          | Model specific, sometimes `25`           | Lithuanian, Latvian, Estonian              |
| `windows-1258` | Vietnamese                                | Model specific                           | Windows ANSI code page                     |

## Practical selection

For Korean receipts, start with `encoding: "cp949"` and use the code page value documented by the printer vendor

For English-only receipts, `ascii` or the default `utf8` works when the printer path accepts those bytes

For Western European receipts, try `cp850`, `cp858`, or `windows-1252` depending on the printer table

For CJK printers, confirm whether the device expects a normal `ESC t n` table, a separate language mode, or driver-side conversion

When printed text is garbled, test these in order

1. Confirm the bytes sent by `encoding(value)`
2. Confirm the printer character table selected by `codePage(page)`
3. Confirm the printer is receiving RAW bytes without driver conversion
4. Confirm the printer firmware supports that language table
