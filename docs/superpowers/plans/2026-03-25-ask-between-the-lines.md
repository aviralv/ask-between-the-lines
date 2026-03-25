# Ask Between the Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local HTTP server wrapping `claude -p` and an Obsidian plugin that lets you ask Claude inline with `;;`, getting responses as collapsible callout blocks with full document context and MCP tool access.

**Architecture:** Two independent packages in a monorepo — a Python FastAPI server (`server/`) and a TypeScript Obsidian plugin (`plugin/`). They communicate via a single `POST /ask` HTTP endpoint on localhost. The server spawns `claude -p --permission-mode bypassPermissions` per request, the plugin handles trigger detection and response rendering.

**Tech Stack:** Python 3.11+ (FastAPI, uvicorn, uv), TypeScript (Obsidian plugin API), `claude` CLI

**Spec:** `docs/superpowers/specs/2026-03-25-ask-between-the-lines-design.md`

**Implementation notes from spec review:**
- Prompt template should be stored as a configurable constant, not a magic string buried in code
- Long documents will silently degrade without warning — acceptable for v1, but be aware

---

## File Structure

```
ask-between-the-lines/
├── server/
│   ├── pyproject.toml              # Package config, [project.scripts] abtl = "abtl.cli:main"
│   ├── src/
│   │   └── abtl/
│   │       ├── __init__.py         # Version only
│   │       ├── server.py           # FastAPI app: /health, /ask endpoints
│   │       ├── claude_adapter.py   # Spawns claude -p, handles stdin/stdout/errors
│   │       ├── prompt.py           # Prompt template constant
│   │       └── cli.py             # CLI entry point: `abtl serve`
│   └── tests/
│       ├── test_server.py          # HTTP endpoint tests (FastAPI TestClient)
│       ├── test_claude_adapter.py  # Adapter unit tests (mocked subprocess)
│       └── test_prompt.py          # Prompt template tests
│
├── plugin/
│   ├── package.json                # Dependencies: obsidian, typescript, esbuild
│   ├── tsconfig.json               # TypeScript config
│   ├── esbuild.config.mjs          # Build config
│   ├── manifest.json               # Obsidian plugin manifest
│   ├── main.ts                     # Plugin entry: lifecycle, command registration
│   ├── trigger.ts                  # ;; detection and query extraction
│   ├── client.ts                   # HTTP client: health check, ask, auto-start
│   └── callout.ts                  # Callout block formatting and editor insertion
│
├── CLAUDE.md
└── README.md
```

**Why split the server into 4 files instead of 1:**
- `server.py` — HTTP layer only (routes, request/response)
- `claude_adapter.py` — subprocess management (spawn, timeout, error handling)
- `prompt.py` — template constant (easy to find and iterate on)
- `cli.py` — CLI entry point (thin wrapper)

Each file has one job. The adapter can be tested without HTTP, the prompt can be changed without touching server code.

**Why split the plugin into 4 files instead of 1:**
- `main.ts` — Obsidian lifecycle (load/unload, command registration, settings)
- `trigger.ts` — text parsing (find `;;`, extract query, pure function)
- `client.ts` — network (health check, POST, retry logic)
- `callout.ts` — editor mutations (replace text, format callout blocks)

Each can be understood and tested independently.

---

## Task 1: Server Package Scaffold

**Files:**
- Create: `server/pyproject.toml`
- Create: `server/src/abtl/__init__.py`
- Create: `server/src/abtl/cli.py`
- Create: `server/src/abtl/server.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "ask-between-the-lines"
version = "0.1.0"
description = "Local HTTP server wrapping claude -p for inline AI queries"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
]

[project.scripts]
abtl = "abtl.cli:main"

[tool.hatch.build.targets.wheel]
packages = ["src/abtl"]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "httpx>=0.27.0",
]
```

- [ ] **Step 2: Create `__init__.py`**

```python
__version__ = "0.1.0"
```

- [ ] **Step 3: Create minimal `server.py` with health endpoint only**

```python
from fastapi import FastAPI

app = FastAPI(title="Ask Between the Lines")


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Create `cli.py`**

```python
import uvicorn


def main():
    uvicorn.run(
        "abtl.server:app",
        host="127.0.0.1",
        port=8765,
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Verify the server starts**

Run: `cd server && uv run abtl`

Expected: Server starts on http://127.0.0.1:8765

Run: `curl http://localhost:8765/health`

Expected: `{"status":"ok"}`

Kill the server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add server/
git commit -m "feat(server): scaffold FastAPI server with health endpoint"
```

---

## Task 2: Prompt Template

**Files:**
- Create: `server/src/abtl/prompt.py`
- Create: `server/tests/test_prompt.py`

- [ ] **Step 1: Write the failing test**

```python
from abtl.prompt import build_prompt


def test_build_prompt_includes_document_and_query():
    result = build_prompt(document="# My Doc\n\nContent here", query="Summarize this")
    assert "# My Doc" in result
    assert "Content here" in result
    assert "Summarize this" in result


def test_build_prompt_has_system_framing():
    result = build_prompt(document="doc", query="q")
    assert "--- DOCUMENT ---" in result
    assert "--- END DOCUMENT ---" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && uv run pytest tests/test_prompt.py -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'abtl.prompt'`

- [ ] **Step 3: Write the implementation**

```python
SYSTEM_TEMPLATE = """You are an AI assistant embedded in the user's document. The user is writing \
in markdown and has asked you a question inline. Answer based on the document \
context and any tools available to you.

--- DOCUMENT ---
{document}
--- END DOCUMENT ---

User asks: {query}"""


def build_prompt(document: str, query: str) -> str:
    return SYSTEM_TEMPLATE.format(document=document, query=query)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && uv run pytest tests/test_prompt.py -v`

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add server/src/abtl/prompt.py server/tests/test_prompt.py
git commit -m "feat(server): add prompt template"
```

---

## Task 3: Claude Adapter

**Files:**
- Create: `server/src/abtl/claude_adapter.py`
- Create: `server/tests/test_claude_adapter.py`

The adapter spawns `claude -p` as a subprocess, pipes the prompt via stdin, and returns stdout. This is the integration boundary — tests mock the subprocess.

- [ ] **Step 1: Write the failing tests**

```python
import subprocess
from unittest.mock import patch, MagicMock

from abtl.claude_adapter import ask_claude, ClaudeError


def test_ask_claude_returns_stdout():
    mock_result = MagicMock()
    mock_result.stdout = "The answer is 42"
    mock_result.returncode = 0

    with patch("abtl.claude_adapter.subprocess.run", return_value=mock_result) as mock_run:
        result = ask_claude("prompt text")

    assert result == "The answer is 42"
    mock_run.assert_called_once()
    call_args = mock_run.call_args
    assert "claude" in call_args.args[0]
    assert "-p" in call_args.args[0]
    assert "--permission-mode" in call_args.args[0]
    assert "bypassPermissions" in call_args.args[0]


def test_ask_claude_passes_prompt_as_input():
    mock_result = MagicMock()
    mock_result.stdout = "response"
    mock_result.returncode = 0

    with patch("abtl.claude_adapter.subprocess.run", return_value=mock_result) as mock_run:
        ask_claude("my prompt")

    assert mock_run.call_args.kwargs["input"] == "my prompt"


def test_ask_claude_raises_on_timeout():
    with patch("abtl.claude_adapter.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="claude", timeout=120)):
        try:
            ask_claude("prompt")
            assert False, "Should have raised ClaudeError"
        except ClaudeError as e:
            assert "timed out" in str(e).lower()


def test_ask_claude_raises_on_nonzero_exit():
    mock_result = MagicMock()
    mock_result.stdout = ""
    mock_result.stderr = "Something went wrong"
    mock_result.returncode = 1

    with patch("abtl.claude_adapter.subprocess.run", return_value=mock_result):
        try:
            ask_claude("prompt")
            assert False, "Should have raised ClaudeError"
        except ClaudeError as e:
            assert "Something went wrong" in str(e)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && uv run pytest tests/test_claude_adapter.py -v`

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
import subprocess


class ClaudeError(Exception):
    pass


DEFAULT_TIMEOUT = 120


def ask_claude(prompt: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    try:
        result = subprocess.run(
            ["claude", "-p", "--permission-mode", "bypassPermissions"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise ClaudeError(f"claude -p timed out after {timeout} seconds")
    except FileNotFoundError:
        raise ClaudeError("claude CLI not found. Is it installed and on PATH?")

    if result.returncode != 0:
        raise ClaudeError(f"claude -p failed (exit {result.returncode}): {result.stderr}")

    return result.stdout.strip()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && uv run pytest tests/test_claude_adapter.py -v`

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add server/src/abtl/claude_adapter.py server/tests/test_claude_adapter.py
git commit -m "feat(server): add claude adapter with subprocess management"
```

---

## Task 4: POST /ask Endpoint

**Files:**
- Modify: `server/src/abtl/server.py`
- Create: `server/tests/test_server.py`

- [ ] **Step 1: Write the failing tests**

```python
from unittest.mock import patch
from fastapi.testclient import TestClient

from abtl.server import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ask_returns_claude_response():
    with patch("abtl.server.ask_claude", return_value="The answer is 42"):
        response = client.post("/ask", json={
            "document": "# Doc\n\nContent",
            "query": "What is the answer?"
        })
    assert response.status_code == 200
    assert response.text == "The answer is 42"


def test_ask_returns_504_on_timeout():
    from abtl.claude_adapter import ClaudeError
    with patch("abtl.server.ask_claude", side_effect=ClaudeError("timed out after 120 seconds")):
        response = client.post("/ask", json={
            "document": "doc",
            "query": "q"
        })
    assert response.status_code == 504


def test_ask_returns_500_on_claude_error():
    from abtl.claude_adapter import ClaudeError
    with patch("abtl.server.ask_claude", side_effect=ClaudeError("CLI not found")):
        response = client.post("/ask", json={
            "document": "doc",
            "query": "q"
        })
    assert response.status_code == 500


def test_ask_returns_422_on_missing_fields():
    response = client.post("/ask", json={"document": "doc"})
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && uv run pytest tests/test_server.py -v`

Expected: health test passes, ask tests fail

- [ ] **Step 3: Write the implementation**

Update `server/src/abtl/server.py`:

```python
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from abtl.claude_adapter import ask_claude, ClaudeError
from abtl.prompt import build_prompt

app = FastAPI(title="Ask Between the Lines")


class AskRequest(BaseModel):
    document: str
    query: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ask", response_class=PlainTextResponse)
async def ask(request: AskRequest):
    prompt = build_prompt(document=request.document, query=request.query)
    try:
        response = ask_claude(prompt)
    except ClaudeError as e:
        error_msg = str(e)
        if "timed out" in error_msg.lower():
            return PlainTextResponse(error_msg, status_code=504)
        return PlainTextResponse(error_msg, status_code=500)
    return response
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && uv run pytest tests/test_server.py -v`

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add server/src/abtl/server.py server/tests/test_server.py
git commit -m "feat(server): add POST /ask endpoint with claude integration"
```

---

## Task 5: Server Integration Test

**Files:**
- Create: `server/tests/test_integration.py`

One real end-to-end test that hits the actual `claude -p` CLI. This test is slow (~8s+) and requires `claude` on PATH.

- [ ] **Step 1: Write the integration test**

```python
import shutil
import pytest
from fastapi.testclient import TestClient

from abtl.server import app

client = TestClient(app)

requires_claude = pytest.mark.skipif(
    shutil.which("claude") is None,
    reason="claude CLI not found on PATH"
)


@requires_claude
def test_ask_real_claude():
    response = client.post("/ask", json={
        "document": "# Test Document\n\nThe capital of France is Paris.",
        "query": "What is the capital of France according to this document?"
    })
    assert response.status_code == 200
    assert "Paris" in response.text
```

- [ ] **Step 2: Run the integration test**

Run: `cd server && uv run pytest tests/test_integration.py -v -s`

Expected: PASS (takes ~8-15 seconds), response contains "Paris"

- [ ] **Step 3: Run all server tests**

Run: `cd server && uv run pytest -v`

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/tests/test_integration.py
git commit -m "test(server): add integration test with real claude -p"
```

---

## Task 6: Obsidian Plugin Scaffold

**Files:**
- Create: `plugin/package.json`
- Create: `plugin/tsconfig.json`
- Create: `plugin/esbuild.config.mjs`
- Create: `plugin/manifest.json`
- Create: `plugin/main.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "ask-between-the-lines",
  "version": "0.1.0",
  "description": "Inline Claude for markdown in Obsidian",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "esbuild": "^0.24.0",
    "obsidian": "latest",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2022",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES2022"]
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 3: Create esbuild.config.mjs**

```javascript
import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab",
    "@codemirror/commands", "@codemirror/language", "@codemirror/lint",
    "@codemirror/search", "@codemirror/state", "@codemirror/view",
    "@lezer/common", "@lezer/highlight", "@lezer/lr"],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

- [ ] **Step 4: Create manifest.json**

```json
{
  "id": "ask-between-the-lines",
  "name": "Ask Between the Lines",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "Inline Claude for markdown — ask questions with ;; and get AI responses as callout blocks",
  "author": "Aviral Vaid",
  "isDesktopOnly": true
}
```

- [ ] **Step 5: Create minimal main.ts**

```typescript
import { Plugin } from "obsidian";

export default class AskBetweenTheLines extends Plugin {
  async onload() {
    console.log("Ask Between the Lines loaded");
  }

  async onunload() {
    console.log("Ask Between the Lines unloaded");
  }
}
```

- [ ] **Step 6: Install dependencies and verify build**

Run: `cd plugin && npm install && npm run build`

Expected: `main.js` created without errors

- [ ] **Step 7: Commit**

```bash
git add plugin/
git commit -m "feat(plugin): scaffold Obsidian plugin"
```

---

## Task 7: Plugin — Trigger Detection

**Files:**
- Create: `plugin/trigger.ts`
- Modify: `plugin/main.ts`

- [ ] **Step 1: Create trigger.ts with query extraction logic**

```typescript
import { Editor } from "obsidian";

export interface TriggerResult {
  query: string;
  lineNumber: number;
}

export function findTrigger(editor: Editor): TriggerResult | null {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const trimmed = line.trimStart();

  if (!trimmed.startsWith(";;")) {
    return null;
  }

  const query = trimmed.slice(2).trim();
  if (query.length === 0) {
    return null;
  }

  return {
    query,
    lineNumber: cursor.line,
  };
}

export function getDocumentWithoutTriggerLine(editor: Editor, triggerLine: number): string {
  const totalLines = editor.lineCount();
  const lines: string[] = [];

  for (let i = 0; i < totalLines; i++) {
    if (i !== triggerLine) {
      lines.push(editor.getLine(i));
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 2: Wire trigger into main.ts as a command**

```typescript
import { Plugin } from "obsidian";
import { findTrigger, getDocumentWithoutTriggerLine } from "./trigger";

export default class AskBetweenTheLines extends Plugin {
  async onload() {
    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => {
        const trigger = findTrigger(editor);
        if (!trigger) {
          return;
        }

        const document = getDocumentWithoutTriggerLine(editor, trigger.lineNumber);
        console.log("Trigger found:", trigger.query);
        console.log("Document length:", document.length);
      },
      hotkeys: [
        { modifiers: ["Mod"], key: "Enter" },
      ],
    });
  }

  async onunload() {
    console.log("Ask Between the Lines unloaded");
  }
}
```

- [ ] **Step 3: Build and verify**

Run: `cd plugin && npm run build`

Expected: Builds without errors

- [ ] **Step 4: Commit**

```bash
git add plugin/trigger.ts plugin/main.ts
git commit -m "feat(plugin): add ;; trigger detection and query extraction"
```

---

## Task 8: Plugin — HTTP Client with Auto-Start

**Files:**
- Create: `plugin/client.ts`

- [ ] **Step 1: Create client.ts**

```typescript
import { requestUrl, Notice } from "obsidian";

const HEALTH_RETRY_INTERVAL_MS = 2000;
const HEALTH_MAX_RETRIES = 5;

export interface AskResponse {
  ok: boolean;
  text: string;
}

export class AbtlClient {
  private serverUrl: string;
  private startCommand: string;
  private serverConfirmedHealthy = false;

  constructor(serverUrl: string, startCommand: string) {
    this.serverUrl = serverUrl;
    this.startCommand = startCommand;
  }

  async ensureServer(): Promise<boolean> {
    if (this.serverConfirmedHealthy) {
      return true;
    }

    if (await this.healthCheck()) {
      this.serverConfirmedHealthy = true;
      return true;
    }

    new Notice("Starting Ask Between the Lines server...");
    this.spawnServer();

    for (let i = 0; i < HEALTH_MAX_RETRIES; i++) {
      await this.sleep(HEALTH_RETRY_INTERVAL_MS);
      if (await this.healthCheck()) {
        this.serverConfirmedHealthy = true;
        new Notice("Server started successfully");
        return true;
      }
    }

    new Notice(
      "Couldn't start the server. Run `" + this.startCommand + "` manually and check for errors.",
      10000
    );
    return false;
  }

  async ask(document: string, query: string): Promise<AskResponse> {
    try {
      const response = await requestUrl({
        url: this.serverUrl + "/ask",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, query }),
      });

      return { ok: true, text: response.text };
    } catch (err) {
      this.serverConfirmedHealthy = false;
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, text: message };
    }
  }

  private async healthCheck(): Promise<boolean> {
    try {
      const response = await requestUrl({
        url: this.serverUrl + "/health",
        method: "GET",
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private spawnServer(): void {
    const { exec } = require("child_process");
    exec(this.startCommand, (err: Error | null) => {
      if (err) {
        console.error("Failed to start server:", err);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `cd plugin && npm run build`

Expected: Builds without errors

- [ ] **Step 3: Commit**

```bash
git add plugin/client.ts
git commit -m "feat(plugin): add HTTP client with health check and auto-start"
```

---

## Task 9: Plugin — Callout Formatting

**Files:**
- Create: `plugin/callout.ts`

- [ ] **Step 1: Create callout.ts**

```typescript
import { Editor } from "obsidian";

export function replaceLine(editor: Editor, lineNumber: number, text: string): void {
  const from = { line: lineNumber, ch: 0 };
  const lineLength = editor.getLine(lineNumber).length;
  const to = { line: lineNumber, ch: lineLength };
  editor.replaceRange(text, from, to);
}

export function formatThinkingCallout(): string {
  return "> [!ai] Thinking...";
}

export function formatResponseCallout(query: string, response: string): string {
  const responseLines = response
    .split("\n")
    .map((line) => "> " + line)
    .join("\n");
  return `> [!ai]- ${query}\n${responseLines}`;
}

export function formatErrorCallout(errorMessage: string): string {
  return `> [!error]- Ask failed\n> ${errorMessage}`;
}
```

- [ ] **Step 2: Build and verify**

Run: `cd plugin && npm run build`

Expected: Builds without errors

- [ ] **Step 3: Commit**

```bash
git add plugin/callout.ts
git commit -m "feat(plugin): add callout block formatting"
```

---

## Task 10: Plugin — Wire Everything Together

**Files:**
- Modify: `plugin/main.ts`

This task connects all the pieces: trigger detection → HTTP client → callout rendering.

- [ ] **Step 1: Update main.ts with full integration**

```typescript
import { Editor, Plugin, PluginSettingTab, Setting, App } from "obsidian";
import { findTrigger, getDocumentWithoutTriggerLine } from "./trigger";
import { AbtlClient } from "./client";
import {
  replaceLine,
  formatThinkingCallout,
  formatResponseCallout,
  formatErrorCallout,
} from "./callout";

interface AbtlSettings {
  serverUrl: string;
  startCommand: string;
}

const DEFAULT_SETTINGS: AbtlSettings = {
  serverUrl: "http://localhost:8765",
  startCommand: "abtl serve",
};

export default class AskBetweenTheLines extends Plugin {
  settings: AbtlSettings = DEFAULT_SETTINGS;
  client: AbtlClient | null = null;

  async onload() {
    await this.loadSettings();
    this.client = new AbtlClient(this.settings.serverUrl, this.settings.startCommand);

    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => this.handleAsk(editor),
      hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
    });

    this.addSettingTab(new AbtlSettingTab(this.app, this));
  }

  async onunload() {}

  async handleAsk(editor: Editor) {
    const trigger = findTrigger(editor);
    if (!trigger) {
      return;
    }

    if (!this.client) {
      return;
    }

    const document = getDocumentWithoutTriggerLine(editor, trigger.lineNumber);

    replaceLine(editor, trigger.lineNumber, formatThinkingCallout());

    const serverReady = await this.client.ensureServer();
    if (!serverReady) {
      replaceLine(editor, trigger.lineNumber, formatErrorCallout("Server not running"));
      return;
    }

    const result = await this.client.ask(document, trigger.query);

    if (result.ok) {
      replaceLine(editor, trigger.lineNumber, formatResponseCallout(trigger.query, result.text));
    } else {
      replaceLine(editor, trigger.lineNumber, formatErrorCallout(result.text));
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.client = new AbtlClient(this.settings.serverUrl, this.settings.startCommand);
  }
}

class AbtlSettingTab extends PluginSettingTab {
  plugin: AskBetweenTheLines;

  constructor(app: App, plugin: AskBetweenTheLines) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Server URL")
      .setDesc("URL of the Ask Between the Lines server")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:8765")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Start command")
      .setDesc("Shell command to start the server if not running")
      .addText((text) =>
        text
          .setPlaceholder("abtl serve")
          .setValue(this.plugin.settings.startCommand)
          .onChange(async (value) => {
            this.plugin.settings.startCommand = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `cd plugin && npm run build`

Expected: Builds without errors

- [ ] **Step 3: Commit**

```bash
git add plugin/main.ts
git commit -m "feat(plugin): wire trigger, client, and callout together"
```

---

## Task 11: Manual End-to-End Test

No automated test — this is a manual verification that everything works together in Obsidian.

- [ ] **Step 1: Install the server**

Run: `cd server && uv tool install -e .`

Verify: `abtl serve` starts the server, `curl http://localhost:8765/health` returns `{"status":"ok"}`

Kill the server.

- [ ] **Step 2: Build the plugin**

Run: `cd plugin && npm run build`

- [ ] **Step 3: Install plugin into Obsidian**

Copy (or symlink) the `plugin/` directory into your Obsidian vault's plugin folder. The path depends on your vault location:

```bash
ln -s $(pwd)/plugin <your-vault>/.obsidian/plugins/ask-between-the-lines
```

Enable the plugin in Obsidian Settings > Community plugins.

- [ ] **Step 4: Test the happy path**

1. Open a note in Obsidian
2. Type: `;; What is 2 + 2?`
3. Press `Cmd+Enter`
4. Verify: `> [!ai] Thinking...` appears
5. Verify: After ~8-15 seconds, the callout is replaced with the response
6. Verify: The response is collapsed by default

- [ ] **Step 5: Test auto-start**

1. Kill any running `abtl serve` process
2. Type a new `;;` query and press `Cmd+Enter`
3. Verify: Notice appears "Starting Ask Between the Lines server..."
4. Verify: After retries, the query succeeds

- [ ] **Step 6: Test conversational continuity**

1. In the same note, after the first response, type: `;; Explain that in more detail`
2. Press `Cmd+Enter`
3. Verify: Claude's response references the previous Q&A

- [ ] **Step 7: Test MCP tool access**

1. Type: `;; Search my Slack for recent messages about "standup"`
2. Press `Cmd+Enter`
3. Verify: Claude uses Slack MCP and returns relevant results

- [ ] **Step 8: Commit any fixes and final state**

```bash
git add -A
git commit -m "feat: complete ask-between-the-lines v0.1.0"
```
