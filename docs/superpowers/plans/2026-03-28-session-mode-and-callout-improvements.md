# Session Mode & Callout Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add custom AI callout icon, context filtering for AI callouts, and session mode with status bar toggle to the Obsidian plugin.

**Architecture:** Three independent features touching shared plugin infrastructure. Feature 1 (CSS) is standalone. Feature 2 (callout stripping) adds a pure function to `prompt.ts`. Feature 3 (session mode) is the largest — adds state management to `main.ts`, `--resume` support to `claude.ts`, and mode indicators to `callout.ts`. All use existing Obsidian APIs and `claude -p` CLI flags. No new dependencies.

**Tech Stack:** TypeScript, Obsidian Plugin API, Vitest, esbuild

**Spec:** `docs/superpowers/specs/2026-03-28-session-mode-and-callout-improvements-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `styles.css` | Create | Callout icon and theme-aware color for `[!ai]` blocks |
| `prompt.ts` | Modify | Add `stripAiCallouts()` function |
| `prompt.test.ts` | Modify | Add tests for `stripAiCallouts()` |
| `claude.ts` | Modify | Add `resumeSessionId` param, return `sessionId`, handle resume failure |
| `claude.test.ts` | Modify | Add tests for `sessionId` extraction and resume args |
| `callout.ts` | Modify | Add session indicators to thinking callouts and response footers |
| `callout.test.ts` | Modify | Add tests for session indicators |
| `main.ts` | Modify | Status bar, mode toggle, session map, `active-leaf-change` handler, `includeAiCallouts` setting, updated `handleAsk` flow |
| `manifest.json` | Modify | Version bump to 1.2.0 |
| `package.json` | Modify | Version bump to 1.2.0 |

---

## Task 1: Custom AI Callout Icon (styles.css)

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Create `styles.css` with lightbulb icon and theme-aware color**

```css
.callout[data-callout="ai"] {
  --callout-icon: lucide-lightbulb;
  --callout-color: var(--interactive-accent-rgb);
}
```

Obsidian auto-loads `styles.css` from the plugin root when the plugin is enabled. `--interactive-accent-rgb` is an RGB triplet variable present in all Obsidian themes — it adapts to dark/light/custom themes automatically.

- [ ] **Step 2: Manual test in Obsidian**

1. Run `npm run build` to rebuild the plugin
2. Reload Obsidian (Cmd+R or disable/re-enable plugin)
3. Create a note with: `> [!ai]- Test callout\n> Some content`
4. Verify: lightbulb icon appears, color matches the theme accent
5. Switch between dark/light theme — verify color adapts

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: add custom lightbulb icon for AI callouts via styles.css"
```

---

## Task 2: Strip AI Callouts from Context (prompt.ts)

**Files:**
- Modify: `prompt.ts`
- Modify: `prompt.test.ts`

- [ ] **Step 1: Write failing tests for `stripAiCallouts`**

Add to `prompt.test.ts`:

```typescript
import { buildPrompt, getSystemPrompt, buildUserMessage, stripAiCallouts } from "./prompt";

describe("stripAiCallouts", () => {
  it("strips a single [!ai] callout block", () => {
    const doc = "Line before\n> [!ai]- Some query\n> Response line 1\n> Response line 2\nLine after";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Line before\nLine after");
  });

  it("strips [!ai] callout without collapsible marker", () => {
    const doc = "Before\n> [!ai] Thinking... (query)\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Before\nAfter");
  });

  it("strips [!error] callout blocks", () => {
    const doc = "Before\n> [!error]- Ask failed\n> Some error message\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Before\nAfter");
  });

  it("preserves other callout types", () => {
    const doc = "Before\n> [!note] Important\n> Keep this content\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Before\n> [!note] Important\n> Keep this content\nAfter");
  });

  it("strips multiple AI callouts in one document", () => {
    const doc = "Intro\n> [!ai]- Q1\n> A1\nMiddle\n> [!ai]- Q2\n> A2\nEnd";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Intro\nMiddle\nEnd");
  });

  it("handles back-to-back AI callouts", () => {
    const doc = "> [!ai]- Q1\n> A1\n> [!ai]- Q2\n> A2\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("After");
  });

  it("handles callout with metadata footer", () => {
    const doc = "Before\n> [!ai]- Query\n> Answer text\n>\n> *523 in · 47 out · 3.2s*\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Before\nAfter");
  });

  it("returns document unchanged when no AI callouts present", () => {
    const doc = "Just normal text\nWith multiple lines";
    const result = stripAiCallouts(doc);
    expect(result).toBe(doc);
  });

  it("handles empty document", () => {
    expect(stripAiCallouts("")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run prompt.test.ts`
Expected: FAIL — `stripAiCallouts` is not exported from `./prompt`

- [ ] **Step 3: Implement `stripAiCallouts` in `prompt.ts`**

Add to `prompt.ts` before the `getSystemPrompt` function:

```typescript
export function stripAiCallouts(document: string): string {
  const lines = document.split("\n");
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (/^> \[!(ai|error)\]/.test(line)) {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (line.startsWith("> ") || line === ">") {
        continue;
      }
      skipping = false;
    }

    result.push(line);
  }

  return result.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run prompt.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add prompt.ts prompt.test.ts
git commit -m "feat: add stripAiCallouts to filter AI responses from document context"
```

---

## Task 3: Session Indicators in Callouts (callout.ts)

**Files:**
- Modify: `callout.ts`
- Modify: `callout.test.ts`

- [ ] **Step 1: Write failing tests for session-aware callout formatting**

Add to `callout.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  formatResponseCallout,
  formatThinkingCallout,
} from "./callout";

describe("formatThinkingCallout", () => {
  it("formats one-shot thinking callout (no session info)", () => {
    const result = formatThinkingCallout("What is this?");
    expect(result).toBe("> [!ai] Thinking... (What is this?)");
  });

  it("formats new session thinking callout", () => {
    const result = formatThinkingCallout("What is this?", "new");
    expect(result).toBe("> [!ai] Thinking (new)... (What is this?)");
  });

  it("formats continued session thinking callout", () => {
    const result = formatThinkingCallout("What is this?", "continued");
    expect(result).toBe("> [!ai] Thinking (cont'd)... (What is this?)");
  });
});

describe("formatResponseCallout with session info", () => {
  it("appends 'new session' to footer", () => {
    const result = formatResponseCallout("Q", "A", {
      inputTokens: 100,
      outputTokens: 20,
      durationMs: 1000,
    }, "new");
    expect(result).toContain("*100 in · 20 out · 1.0s · new session*");
  });

  it("appends 'continued' to footer", () => {
    const result = formatResponseCallout("Q", "A", {
      inputTokens: 100,
      outputTokens: 20,
      durationMs: 1000,
    }, "continued");
    expect(result).toContain("*100 in · 20 out · 1.0s · continued*");
  });

  it("no session suffix for one-shot (undefined)", () => {
    const result = formatResponseCallout("Q", "A", {
      inputTokens: 100,
      outputTokens: 20,
      durationMs: 1000,
    });
    expect(result).toContain("*100 in · 20 out · 1.0s*");
    expect(result).not.toContain("session");
    expect(result).not.toContain("continued");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run callout.test.ts`
Expected: FAIL — `formatThinkingCallout` is not exported (only `formatThinkingCalloutWithQuery` exists), and `formatResponseCallout` doesn't accept a 4th parameter

- [ ] **Step 3: Implement session-aware callout functions**

Replace the contents of `callout.ts`:

```typescript
import { Editor } from "obsidian";

export type SessionStatus = "new" | "continued";

export function replaceLine(editor: Editor, lineNumber: number, text: string): void {
  const from = { line: lineNumber, ch: 0 };
  const lineLength = editor.getLine(lineNumber).length;
  const to = { line: lineNumber, ch: lineLength };
  editor.replaceRange(text, from, to);
}

export function findThinkingCallout(editor: Editor, query: string): number | null {
  const totalLines = editor.lineCount();
  for (let i = 0; i < totalLines; i++) {
    const line = editor.getLine(i);
    if (line.startsWith("> [!ai] Thinking") && line.endsWith(`(${query})`)) {
      return i;
    }
  }
  return null;
}

export function formatThinkingCallout(
  query: string,
  sessionStatus?: SessionStatus,
): string {
  if (sessionStatus === "new") {
    return `> [!ai] Thinking (new)... (${query})`;
  }
  if (sessionStatus === "continued") {
    return `> [!ai] Thinking (cont'd)... (${query})`;
  }
  return `> [!ai] Thinking... (${query})`;
}

/** @deprecated Use formatThinkingCallout instead */
export function formatThinkingCalloutWithQuery(query: string): string {
  return formatThinkingCallout(query);
}

export interface ResponseMetadata {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export function formatResponseCallout(
  query: string,
  response: string,
  metadata?: ResponseMetadata,
  sessionStatus?: SessionStatus,
): string {
  const responseLines = response
    .split("\n")
    .map((line) => "> " + line)
    .join("\n");

  let callout = `> [!ai]- ${query}\n${responseLines}`;

  if (metadata) {
    const seconds = (metadata.durationMs / 1000).toFixed(1);
    let footer = `${metadata.inputTokens} in · ${metadata.outputTokens} out · ${seconds}s`;
    if (sessionStatus === "new") {
      footer += " · new session";
    } else if (sessionStatus === "continued") {
      footer += " · continued";
    }
    callout += `\n>\n> *${footer}*`;
  }

  return callout;
}

export function formatErrorCallout(errorMessage: string): string {
  return `> [!error]- Ask failed\n> ${errorMessage}`;
}
```

Key changes:
- New `SessionStatus` type: `"new" | "continued"` (or `undefined` for one-shot)
- `formatThinkingCalloutWithQuery` → `formatThinkingCallout` (old name kept as deprecated alias)
- `findThinkingCallout` updated: matches any `> [!ai] Thinking` line ending with `(query)` — handles all three variants (plain, `(new)...`, `(cont'd)...`)
- `formatResponseCallout` gains optional 4th param `sessionStatus` — appends to footer

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run callout.test.ts`
Expected: All tests PASS (including existing tests — the signature changes are backwards-compatible)

- [ ] **Step 5: Commit**

```bash
git add callout.ts callout.test.ts
git commit -m "feat: add session indicators to thinking callouts and response footers"
```

---

## Task 4: Session Support in Claude CLI Adapter (claude.ts)

**Files:**
- Modify: `claude.ts`
- Modify: `claude.test.ts`

- [ ] **Step 1: Write failing tests for `sessionId` extraction**

Add to `claude.test.ts`:

```typescript
describe("parseClaudeOutput with sessionId", () => {
  it("extracts session_id from JSON response", () => {
    const json = JSON.stringify({
      type: "result",
      result: "The answer",
      session_id: "ABC-123-DEF",
      usage: { input_tokens: 100, output_tokens: 20 },
      duration_ms: 2000,
    });

    const result = parseClaudeOutput(json);
    expect(result.ok).toBe(true);
    expect(result.sessionId).toBe("ABC-123-DEF");
  });

  it("returns empty sessionId when not present", () => {
    const json = JSON.stringify({
      type: "result",
      result: "response",
    });

    const result = parseClaudeOutput(json);
    expect(result.sessionId).toBe("");
  });

  it("returns empty sessionId on parse failure", () => {
    const result = parseClaudeOutput("not json");
    expect(result.sessionId).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run claude.test.ts`
Expected: FAIL — `sessionId` property does not exist on `ClaudeResponse`

- [ ] **Step 3: Update `ClaudeResponse` and `parseClaudeOutput` to include `sessionId`**

Update interfaces and function in `claude.ts`:

Add `sessionId: string` to `ClaudeResponse`:

```typescript
export interface ClaudeResponse {
  ok: boolean;
  text: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  sessionId: string;
}
```

Add `session_id` to `ClaudeJsonOutput`:

```typescript
interface ClaudeJsonOutput {
  type: string;
  result: string;
  session_id?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  duration_ms?: number;
}
```

Update `parseClaudeOutput` to extract `sessionId`:

```typescript
export function parseClaudeOutput(stdout: string): ClaudeResponse {
  try {
    const parsed: ClaudeJsonOutput = JSON.parse(stdout);
    return {
      ok: true,
      text: parsed.result,
      inputTokens: parsed.usage?.input_tokens ?? 0,
      outputTokens: parsed.usage?.output_tokens ?? 0,
      durationMs: parsed.duration_ms ?? 0,
      sessionId: parsed.session_id ?? "",
    };
  } catch {
    return {
      ok: false,
      text: "Failed to parse Claude response: " + stdout.slice(0, 200),
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      sessionId: "",
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run claude.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Add `resumeSessionId` parameter to `AskClaudeOptions` and `askClaude`**

Add to `AskClaudeOptions`:

```typescript
export interface AskClaudeOptions {
  userMessage: string;
  systemPrompt: string;
  vaultPath: string;
  claudePath: string;
  timeoutSeconds: number;
  disallowedTools: string[];
  resumeSessionId?: string;
}
```

Update `askClaude` — add `--resume` to args when `resumeSessionId` is provided. Insert after the `disallowedTools` block:

```typescript
    if (opts.resumeSessionId) {
      args.push("--resume", opts.resumeSessionId);
    }
```

Also update all error paths in `askClaude` to include `sessionId: ""`:

In the `child.on("error")` handler:

```typescript
    child.on("error", (error: Error) => {
      resolve({
        ok: false,
        text: error.message,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        sessionId: "",
      });
    });
```

In the `child.on("close")` handler's error branch:

```typescript
      if (code !== 0) {
        resolve({
          ok: false,
          text: stderr || `claude exited with code ${code}`,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          sessionId: "",
        });
        return;
      }
```

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (including prompt and callout tests)

- [ ] **Step 7: Commit**

```bash
git add claude.ts claude.test.ts
git commit -m "feat: add session ID extraction and --resume support to claude adapter"
```

---

## Task 5: Session Mode in Main Plugin (main.ts)

**Files:**
- Modify: `main.ts`

This task wires everything together: status bar, mode toggle, session state management, `includeAiCallouts` setting, and the updated `handleAsk` flow.

- [ ] **Step 1: Update `AbtlSettings` interface and defaults**

Add `includeAiCallouts` to the settings interface and defaults:

```typescript
interface AbtlSettings {
  claudePath: string;
  timeoutSeconds: number;
  triggerPrefix: string;
  disallowedTools: string;
  includeAiCallouts: boolean;
}

const DEFAULT_SETTINGS: AbtlSettings = {
  claudePath: "claude",
  timeoutSeconds: 120,
  triggerPrefix: ";;",
  disallowedTools: DEFAULT_DISALLOWED_TOOLS,
  includeAiCallouts: false,
};
```

- [ ] **Step 2: Update imports in `main.ts`**

Replace the import block at the top of `main.ts`:

```typescript
import { Editor, Plugin, PluginSettingTab, Setting, App } from "obsidian";
import { findTrigger, getDocumentWithoutTriggerLine } from "./trigger";
import { askClaude, ClaudeResponse } from "./claude";
import { getSystemPrompt, buildUserMessage, stripAiCallouts } from "./prompt";
import {
  replaceLine,
  findThinkingCallout,
  formatThinkingCallout,
  formatResponseCallout,
  formatErrorCallout,
  SessionStatus,
} from "./callout";
```

- [ ] **Step 3: Add session state and mode to the plugin class**

Add properties after `settings`:

```typescript
export default class AskBetweenTheLines extends Plugin {
  settings: AbtlSettings = DEFAULT_SETTINGS;
  mode: "one-shot" | "session" = "one-shot";
  sessions: Map<string, { sessionId: string }> = new Map();
  statusBarEl: HTMLElement | null = null;
```

- [ ] **Step 4: Add status bar and mode toggle command in `onload`**

Replace the `onload` method:

```typescript
  async onload() {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();

    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => this.handleAsk(editor),
      hotkeys: [{ modifiers: ["Shift"], key: "Enter" }],
    });

    this.addCommand({
      id: "toggle-mode",
      name: "Toggle ask mode (one-shot / session)",
      callback: () => this.toggleMode(),
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.clearCurrentSession();
      })
    );

    this.addSettingTab(new AbtlSettingTab(this.app, this));
  }
```

- [ ] **Step 5: Add helper methods for mode toggle, status bar, and session management**

Add after `onload`:

```typescript
  toggleMode() {
    if (this.mode === "one-shot") {
      this.mode = "session";
    } else {
      this.clearCurrentSession();
      this.mode = "one-shot";
    }
    this.updateStatusBar();
  }

  updateStatusBar() {
    if (!this.statusBarEl) return;
    this.statusBarEl.setText(this.mode === "one-shot" ? "One-shot" : "Session");
    this.statusBarEl.onClickEvent(() => this.toggleMode());
  }

  private getActiveFilePath(): string | null {
    const file = this.app.workspace.getActiveFile();
    return file?.path ?? null;
  }

  private clearCurrentSession() {
    const filePath = this.getActiveFilePath();
    if (filePath) {
      this.sessions.delete(filePath);
    }
  }
```

- [ ] **Step 6: Rewrite `handleAsk` with session support and callout stripping**

Replace the `handleAsk` method:

```typescript
  async handleAsk(editor: Editor) {
    const trigger = findTrigger(editor, this.settings.triggerPrefix);
    if (!trigger) {
      return;
    }

    const vaultPath = (this.app.vault.adapter as any).basePath as string;
    let document = getDocumentWithoutTriggerLine(editor, trigger.lineNumber);
    if (!this.settings.includeAiCallouts) {
      document = stripAiCallouts(document);
    }
    const userMessage = buildUserMessage(document, trigger.query);

    const filePath = this.getActiveFilePath();
    const isSessionMode = this.mode === "session";
    const existingSession = filePath ? this.sessions.get(filePath) : undefined;

    let sessionStatus: SessionStatus | undefined;
    if (isSessionMode) {
      sessionStatus = existingSession ? "continued" : "new";
    }

    replaceLine(editor, trigger.lineNumber, formatThinkingCallout(trigger.query, sessionStatus));

    const result = await askClaude({
      userMessage,
      systemPrompt: getSystemPrompt(),
      vaultPath,
      claudePath: this.settings.claudePath,
      timeoutSeconds: this.settings.timeoutSeconds,
      disallowedTools: this.settings.disallowedTools
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0),
      resumeSessionId: existingSession?.sessionId,
    });

    let finalResult = result;
    let finalSessionStatus = sessionStatus;

    if (!result.ok && existingSession && isSessionMode) {
      this.sessions.delete(filePath!);
      finalSessionStatus = "new";
      finalResult = await askClaude({
        userMessage,
        systemPrompt: getSystemPrompt(),
        vaultPath,
        claudePath: this.settings.claudePath,
        timeoutSeconds: this.settings.timeoutSeconds,
        disallowedTools: this.settings.disallowedTools
          .split(",")
          .map(t => t.trim())
          .filter(t => t.length > 0),
      });
    }

    if (isSessionMode && filePath && finalResult.ok && finalResult.sessionId) {
      this.sessions.set(filePath, { sessionId: finalResult.sessionId });
    }

    const thinkingLine = findThinkingCallout(editor, trigger.query);
    if (thinkingLine === null) {
      return;
    }

    if (finalResult.ok) {
      replaceLine(
        editor,
        thinkingLine,
        formatResponseCallout(trigger.query, finalResult.text, {
          inputTokens: finalResult.inputTokens,
          outputTokens: finalResult.outputTokens,
          durationMs: finalResult.durationMs,
        }, finalSessionStatus)
      );
    } else {
      replaceLine(editor, thinkingLine, formatErrorCallout(finalResult.text));
    }
  }
```

- [ ] **Step 7: Add `includeAiCallouts` setting to the settings tab**

Add after the "Disallowed tools" setting in the `display()` method of `AbtlSettingTab`:

```typescript
    new Setting(containerEl)
      .setName("Include AI responses in context")
      .setDesc("When enabled, previous AI callout blocks are included in the document context sent to Claude. When disabled (default), they are stripped.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeAiCallouts)
          .onChange(async (value) => {
            this.plugin.settings.includeAiCallouts = value;
            await this.plugin.saveSettings();
          })
      );
```

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add main.ts
git commit -m "feat: add session mode with status bar toggle and callout stripping setting"
```

---

## Task 6: Version Bump and Final Verification

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`

- [ ] **Step 1: Bump version in `manifest.json`**

Change `"version": "1.1.0"` to `"version": "1.2.0"` in `manifest.json`.

- [ ] **Step 2: Bump version in `package.json`**

Change `"version": "1.1.0"` to `"version": "1.2.0"` in `package.json`.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Build the plugin**

Run: `npm run build`
Expected: Clean build, `main.js` updated with no errors

- [ ] **Step 5: Manual end-to-end test in Obsidian**

1. Reload Obsidian (Cmd+R)
2. **Test callout icon**: Create `> [!ai]- Test\n> Content` — verify lightbulb icon and theme color
3. **Test one-shot mode**: Verify status bar shows "One-shot". Type `;;What is 2+2?`, press Shift+Enter. Verify response appears without session indicators in thinking callout or footer.
4. **Test callout stripping**: Ask a second question on same note. Verify the first AI callout is NOT in the model's context (ask "What questions have I asked you?" — should not know the first question).
5. **Test session mode**: Click status bar to toggle to "Session". Ask `;;What is 2+2?`. Verify thinking callout shows `(new)` and footer shows `· new session`.
6. **Test session continuity**: Ask another question `;;What did I just ask you?`. Verify thinking shows `(cont'd)`, footer shows `· continued`, and response references the previous question.
7. **Test session clear on navigation**: Switch to another note and back. Ask a question — should show `(new)` again.
8. **Test session clear on mode switch**: Toggle back to "One-shot". Toggle to "Session" again. Should start fresh.

- [ ] **Step 6: Commit**

```bash
git add manifest.json package.json
git commit -m "chore: bump version to 1.2.0"
```

---

## Verification

1. **Unit tests**: `npx vitest run` — all pass
2. **Build**: `npm run build` — clean output
3. **Manual tests**: Follow the end-to-end checklist in Task 6, Step 5
4. **Regression**: Existing one-shot behavior unchanged when mode is "One-shot" (the default)
