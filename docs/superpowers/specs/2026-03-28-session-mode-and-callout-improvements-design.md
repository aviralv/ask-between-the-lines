# Session Mode & Callout Improvements — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Three features for ask-between-the-lines v1.2.0

---

## Overview

Three interconnected improvements to the Obsidian plugin:

1. **Custom AI callout icon** — Ship `styles.css` with a Lucide lightbulb icon for `[!ai]` callouts
2. **Strip AI callouts from context** — Filter out previous AI responses before sending document to model
3. **Session mode** — Conversational continuity via `claude -p --resume`, with status bar toggle

---

## Feature 1: Custom AI Callout Icon

### What

Ship a `styles.css` file in the plugin root. Obsidian automatically loads this when the plugin is enabled.

### Implementation

- Target `.callout[data-callout="ai"]` — Obsidian's native selector for `[!ai]` callouts
- Set `--callout-icon` to `lucide-lightbulb`
- Color inherits from user's active theme via Obsidian CSS variables (e.g., `--text-accent`)
- No hardcoded colors — works with any theme (dark, light, custom)

### Scope

Icon and color only. No other styling changes. Collapsible behavior (`[!ai]-`) already works natively.

---

## Feature 2: Strip AI Callouts from Context

### What

A filter function that removes `[!ai]` and `[!error]` callout blocks from the document text before sending it to the model. Controlled by a user setting.

### Setting

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `includeAiCallouts` | boolean | `false` | When false, AI and error callout blocks are stripped from document context before sending to model. When true, they're included as-is. |

### Parsing Logic

The filter walks the document line by line:

1. When it hits a line matching `> [!ai]` or `> [!error]` (with optional `-` for collapsible), enters skip mode
2. Continues skipping consecutive lines that start with `> ` (the callout body)
3. Resumes normal output when it hits a non-`> ` line

### Edge Cases

- **Other callout types** (e.g., `> [!note]`, `> [!warning]`) are never stripped — only `ai` and `error`
- **Back-to-back callouts** — each detected independently
- **Callout with no body** (just the header line) — stripped correctly
- **Blank lines between callouts** — a blank line ends the current callout block

### Where It Runs

In `prompt.ts`, as part of document preparation. Applied after `getDocumentWithoutTriggerLine` removes the trigger line, before building the user message. A new function `stripAiCallouts(document: string): string`.

---

## Feature 3: Session Mode

### 3a. Status Bar Item

- Adds a status bar item (bottom-right of Obsidian) showing current mode
- Two states displayed: `One-shot` and `Session`
- Click to toggle between modes
- Also togglable via command palette command (`Toggle ask mode`) so users can bind a custom hotkey
- Default mode on plugin load: **One-shot**

### 3b. Session State Management

- Plugin holds an in-memory `Map<string, { sessionId: string }>` keyed by file path
- **Not persisted to disk** — sessions are ephemeral, die with plugin reload
- **First query in session mode (no stored session ID):**
  - Omit `--resume` from spawn args
  - Capture `session_id` from the JSON response
  - Store it in the map for this note
- **Subsequent queries in session mode (session ID exists):**
  - Pass `--resume <sessionId>` to `claude -p`
  - Update stored session ID from response (in case it changes)
- **Resume failure (CLI can't find session):**
  - Silently drop the stored session ID
  - Retry as a fresh query (no `--resume`)
  - Store the new session ID from the response
  - This query is labeled "new session" in the callout (see 3d)

### 3c. Session Clearing Rules

Two triggers clear a note's session:

1. **Mode switch** — toggling to one-shot clears the current note's session
2. **Note navigation** — `active-leaf-change` event clears the previous note's session

No inactivity timeout. The session lives as long as the CLI can resume it. When the CLI can't (session expired on their end, process cache cleared), the resume failure handler (3b) starts a fresh session gracefully.

### 3d. Callout Indicators

**Thinking callouts (interim, while waiting for response):**

| Mode | Callout |
|------|---------|
| One-shot | `> [!ai] Thinking... (What are the key themes?)` |
| Session, new | `> [!ai] Thinking (new)... (What are the key themes?)` |
| Session, continued | `> [!ai] Thinking (cont'd)... (What are the key themes?)` |

**Response footers (permanent, in final callout):**

| Mode | Footer |
|------|--------|
| One-shot | `*523 in · 47 out · 3.2s*` |
| Session, new | `*523 in · 47 out · 3.2s · new session*` |
| Session, continued | `*523 in · 47 out · 3.2s · continued*` |

A query is "new" when:
- It's the first session-mode query for a note (no stored session ID)
- A resume attempt failed and a fresh session was started

A query is "continued" when:
- `--resume` succeeded (session ID was accepted by the CLI)

### 3e. Changes to `claude.ts`

- `askClaude()` accepts an optional `resumeSessionId?: string` parameter
- When present, adds `--resume` and the session ID to spawn args
- Return type extended: `ClaudeResponse` gains a `sessionId: string` field, extracted from the JSON response's `session_id`
- Resume failure detection: if the process exits with a non-zero exit code and `resumeSessionId` was provided, the caller treats it as a session failure and retries without `--resume`. The retry is a single attempt — if the retry also fails, surface the error normally via `[!error]` callout.

### 3f. Changes to `main.ts`

- New `statusBarItem` created in `onload()`
- New `mode: 'one-shot' | 'session'` state on the plugin instance
- New `sessions: Map<string, { sessionId: string }>` on the plugin instance
- `handleAsk` checks mode and session state to determine spawn args and callout labels
- Register `active-leaf-change` event to clear session on note navigation
- New command: `ask-between-the-lines:toggle-mode`

---

## Files Changed

| File | Change |
|------|--------|
| `styles.css` | **New** — Callout icon and theme-aware color |
| `prompt.ts` | Add `stripAiCallouts()` function |
| `claude.ts` | Add `resumeSessionId` param, return `sessionId`, handle resume failure |
| `callout.ts` | Add session indicators to thinking callouts and response footers |
| `main.ts` | Status bar, mode toggle, session map, `active-leaf-change` handler, updated `handleAsk` flow |
| `manifest.json` | Version bump to 1.2.0 |

## New Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `includeAiCallouts` | boolean | `false` | Include AI callout blocks in document context |

## No New Dependencies

All features use existing Obsidian APIs and `claude -p` CLI flags. No new npm packages.

---

## Technical Notes

### CLI Session Support (verified)

- `claude -p --output-format json` returns `session_id` in the JSON response
- `claude -p --resume <sessionId>` successfully resumes a prior conversation with full history
- Session state is managed entirely by the CLI — the plugin only stores the ID
- `--resume` can be combined with all existing flags (`--system-prompt`, `--output-format json`, `--permission-mode`, `--disallowedTools`)

### Graceful Degradation

- If `styles.css` fails to load: callouts render with Obsidian's default styling (no icon, default color). No functional impact.
- If callout stripping regex misses an edge case: slightly more context sent to model. No functional impact.
- If `--resume` fails: silently starts fresh session. User sees "new session" label. No error, no interruption.
