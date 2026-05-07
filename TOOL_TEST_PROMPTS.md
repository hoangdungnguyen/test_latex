# Tool Test Prompts for Local Models (Bonsai)

Use these prompts to test each tool in the agent panel. Switch to Bonsai model first.

---

## 1. ls - List Files
**Prompt:**
```
List all files in the current directory using the ls tool.
```
**Expected:** Tool call `ls` with result showing files.

---

## 2. bash - Echo Command
**Prompt:**
```
Run the command "echo Hello from Bonsai" using the bash tool.
```
**Expected:** Tool call `bash` with `{"command":"echo Hello from Bonsai"}`

---

## 3. bash - List with ls -la
**Prompt:**
```
List all files with details using: ls -la
```
**Expected:** Tool call `bash` with `{"command":"ls -la"}`

---

## 4. bash - Show pwd
**Prompt:**
```
Show the current working directory using pwd.
```
**Expected:** Tool call `bash` with `{"command":"pwd"}`

---

## 5. view - Read File
**Prompt:**
```
Read the file "main.tex" using the view tool.
```
**Expected:** Tool call `view` with `{"file_path":"main.tex"}`

---

## 6. bash - Count Lines (wc)
**Prompt:**
```
Count the number of lines in main.tex using wc -l.
```
**Expected:** Tool call `bash` with `{"command":"wc -l main.tex"}`

---

## 7. bash - List Only .tex Files
**Prompt:**
```
List only .tex files using: ls *.tex
```
**Expected:** Tool call `bash` with `{"command":"ls *.tex"}`

---

## 8. view - Read with Limit
**Prompt:**
```
Read the first 5 lines of main.tex.
```
**Expected:** Tool call `view` with `{"file_path":"main.tex","limit":5}`

---

## 9. Multiple Tools (Chain)
**Prompt:**
```
First list files with ls, then show pwd.
```
**Expected:** Multiple tool calls in sequence.

---

## Tool Parameters Quick Reference

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| `ls` | - | `path` |
| `bash` | `command` | - |
| `view` | `file_path` | `offset`, `limit` |
| `write` | `file_path`, `content` | - |
| `edit` | `file_path`, `oldString`, `newString` | - |
| `grep` | `pattern` | `path` |
| `glob` | `pattern` | - |
| `compile` | `texFile` | - |
| `diagnostics` | - | - |
| `fetch` | `url` | - |

---

## File Path Rules

- Use **simple filenames** without @ prefix: `main.tex` NOT `@main.tex`
- Use **relative paths**: `subdir/file.tex`
- Use **forward slashes** (not backslashes)

---

## Expected Format for Tool Calls

```
TOOL: tool_name
COMMAND: arguments
END
```

Example:
```
TOOL: bash
COMMAND: ls -la
END
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Model uses `@file.tex` | Hallucinated syntax | Use: `main.tex` without @ |
| Model ignores tool result | Model limitation | Use cloud model for complex tasks |
| No tool called | Wrong format | Use EXACT format shown above |
