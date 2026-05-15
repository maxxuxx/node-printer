## Priority Rules

### 1. Think Before Coding

**Do not assume. Do not hide confusion. Surface tradeoffs**

Before implementing:
- State your assumptions explicitly. If uncertain, ask
- If multiple interpretations exist, present them instead of choosing silently
- If a simpler approach exists, say so. Push back when warranted
- If something is unclear, stop, name what is confusing, and ask

### 2. Simplicity First

**Write the minimum code that solves the problem. Nothing speculative**

- Do not add features beyond what was asked
- Do not add abstractions for single-use code
- Do not add configurability that was not requested
- Do not add error handling for impossible scenarios
- If 200 lines could be 50 lines without losing clarity, rewrite it

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify

### 3. Surgical Changes

**Touch only what is needed. Clean up only your own mess**

When editing existing code:
- Do not improve adjacent code, comments, or formatting unless required
- Do not refactor unrelated code
- Match existing style, even if you would normally choose differently
- If you notice unrelated dead code, mention it instead of deleting it

When your changes create unused code:
- Remove imports, variables, functions, files, and types made unused by your own change
- Do not remove pre-existing dead code unless explicitly asked

Every changed line should trace directly to the user's request

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified**

Transform tasks into verifiable goals:
- "Add validation" -> "Write or identify checks for invalid inputs, then make them pass"
- "Fix the bug" -> "Reproduce the issue, fix it, then verify the same path"
- "Refactor X" -> "Confirm behavior before and after when practical"

For multi-step tasks, state a brief plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

### 5. Language Rule

**Think in English, explain in Korean, and preserve target-language conventions**

- Think in English
- Explain progress, decisions, risks, and completion in Korean
- Keep code, filenames, commit messages, and documentation in the language already used by the target package unless the user requests otherwise


### 6. Interaction Style

**Say the useful part first and keep replies short**

- Be concise, direct, and practical
- Lead with the answer, decision, or next action
- Avoid filler, praise, apologies, and long preambles
- Keep explanations short unless detail is necessary for correctness
- Prefer short paragraphs or flat bullets
- Do not restate the user's request unless clarification is needed

### 7. Text Style

**Avoid trailing punctuation in UI copy, responses, and documentation**

- Do not end UI copy, assistant responses, documentation, comments, or short status text with punctuation
- This applies to labels, buttons, headings, placeholders, messages, release notes, docs, and user-facing explanations
- This includes `.`, `!`, `?`, `:`, `;`, and similar trailing punctuation
- Exception: keep punctuation when required by code, file paths, URLs, commands, data formats, or quoted text

### 8. Encoding Safety

**Preserve UTF-8 Korean text exactly and stop before editing garbled output**

- Preserve UTF-8 Korean text exactly unless explicitly asked to edit it
- If Korean appears garbled in terminal output, stop and ask before modifying that file
- Do not perform full-file rewrites on files containing Korean unless necessary
- Use targeted patches and keep unrelated Korean comments, strings, and docs unchanged


### 9. Formatting Alignment

**Align related code locally while respecting the project formatter**

- Source code must use vertical alignment for related consecutive lines
- Align `=`, `=>`, `:`, and similar separators when lines form the same logical block
- Do not leave visually ragged assignment, mapping, config, or object literal blocks
- If the project formatter would undo the alignment, follow the formatter and mention the conflict
- Do not touch unrelated lines only for alignment

### 10. Code Sectioning

**Group related functions and variables into commented sections**

- When implementing multiple functions, variables, constants, types, or handlers, split them into responsibility-based sections
- Add a short section comment for each group so the structure is easy to scan
- Use section comments for groups, not obvious line-by-line comments
- Keep sections local to the edited code and avoid reorganizing unrelated code

### 11. Naming Clarity

**Choose common, simple, direct names that explain themselves**

- Folder, file, method, function, variable, type, and constant names should use popular and intuitive words
- Prefer plain words that a new contributor can understand at a glance
- File and folder names should be made from simple obvious words, not clever or obscure terms
- Methods and functions must be short, focused, and easy to understand by reading them once
- If a method needs a long name or explanation to be understood, rename it or split it
- Avoid vague names, unnecessary abbreviations, invented terms, and over-specific wording unless the project already uses them
