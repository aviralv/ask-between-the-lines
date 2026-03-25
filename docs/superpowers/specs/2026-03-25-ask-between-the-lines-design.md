# Ask Between the Lines — Design Spec

**Date:** 2026-03-25
**Status:** Draft

## Overview

Jupyter-style inline AI for markdown. Write prose in Obsidian, ask Claude inline with `;;`, get responses as collapsible callout blocks — with full document context and all MCP tools available.

## Architecture

Two independent components connected by HTTP:

```
Obsidian Plugin                    Local Server (FastAPI)
┌─────────────────┐               ┌──────────────────────┐
│ Detects ;;      │  POST /ask    │ Receives request      │
│ Reads document  │──────────────→│ Spawns claude -p      │
│ Shows spinner   │               │   --permission-mode   │
│                 │  200 + body   │   bypassPermissions   │
│ Inserts callout │←──────────────│ Returns response text │
└─────────────────┘               └──────────────────────┘
```

### Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| AI backend | `claude -p` subprocess | Inherits user's full MCP tool config (Slack, M365, etc.) without any setup |
| Permission model | `--permission-mode bypassPermissions` | Non-interactive mode can't prompt for approval; safe because localhost-only |
| Communication | Synchronous HTTP | `claude -p` doesn't stream tokens incrementally, so SSE adds complexity with no UX benefit |
| Statefulness | None (one-shot) | Document IS the context — previous Q&A pairs are in the document when the next query is sent |
| Model config | None | Uses whatever `claude -p` defaults to |
| MCP tool config | None | Inherits from user scope (`~/.claude/.mcp.json`) and project scope (`.mcp.json`) |

### Validated Assumptions

Tested on 2026-03-25:

- `claude -p` inherits MCP servers from project/user config
- `--permission-mode bypassPermissions` allows all MCP tools without interactive approval
- `--output-format stream-json` does NOT stream tokens incrementally (full response in one chunk)
- Cold-start latency: ~8 seconds minimum for trivial prompts

## API Contract

### `POST /ask`

**Request:**
```json
{
  "document": "# Full markdown content of the note...",
  "query": "What are the key risks?"
}
```

**Response:** `200 OK` — plain text body (markdown string)
```
Based on your document, the three main risks are...
```

The server returns Claude's raw output. The plugin handles formatting into a callout block.

**Errors:**
- `504` — `claude -p` timed out
- `500` — `claude -p` failed to start
- `422` — missing/invalid fields (FastAPI default)

**Timeout:** 120 seconds default (MCP tool calls can be slow). Configurable.

### `GET /health`

**Response:** `200 OK` — server is running and ready.

Used by the plugin for auto-start detection.

## Obsidian Plugin

### Trigger Flow

1. User types `;;` in a note
2. User writes their query on the same/next line(s)
3. User presses `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
4. Plugin captures everything from `;;` to cursor position as the query
5. Plugin reads the full document content (excluding the `;;` query line)
6. Replaces `;;` block with placeholder:
   ```markdown
   > [!ai] Thinking...
   ```
7. POSTs `{ document, query }` to server
8. On success, replaces placeholder:
   ```markdown
   > [!ai]- What are the key risks?
   > Response content here...
   ```
9. On error, replaces placeholder:
   ```markdown
   > [!error]- Ask failed
   > Error message here...
   ```

The `-` after `[!ai]-` makes the callout collapsed by default, keeping the document scannable.

### Server Management: Lazy Auto-Start

The plugin does not manage the server lifecycle directly. Instead:

1. On first `;;` of a session, plugin hits `GET /health`
2. **If healthy** → proceed with the request
3. **If not reachable** → plugin runs the configured shell command (default: `abtl serve`), waits ~2 seconds, retries health check
4. **If still not reachable** → shows notice: "Couldn't start the server. Run `abtl serve` manually and check for errors."

The server stays running after Obsidian closes (harmless — it's a lightweight localhost process).

### Plugin Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Server URL | `http://localhost:8765` | Where to reach the backend |
| Start command | `abtl serve` | Shell command to start server if not running |

No model config, no tool config, no API keys.

### Conversational Continuity

The second query sends the current document content, which includes the callout block from the first response. Claude sees its own previous answers as part of the document context. Free follow-up capability without any state management.

```markdown
# My Document

Some content here...

;; What are the key risks?

> [!ai]- What are the key risks?
> 1. Token limits on long docs
> 2. Cold-start latency

;; How would you mitigate risk #1?

> [!ai]- How would you mitigate risk #1?
> Truncate from the middle, keeping the beginning
> (structure) and end (recent context)...
```

## Project Structure

```
ask-between-the-lines/
├── server/                    # Python package (FastAPI)
│   ├── pyproject.toml         # uv-managed, exposes `abtl` CLI
│   ├── src/
│   │   └── abtl/
│   │       ├── __init__.py
│   │       ├── server.py      # FastAPI app, /ask and /health
│   │       └── cli.py         # `abtl serve` entry point
│   └── tests/
│
├── plugin/                    # Obsidian plugin (TypeScript)
│   ├── package.json
│   ├── manifest.json          # Obsidian plugin manifest
│   ├── main.ts                # Trigger detection, HTTP client, callout rendering
│   └── styles.css             # Minimal styling (if needed)
│
├── CLAUDE.md
└── README.md
```

**Server** installable via `uv tool install ./server` — gives the `abtl serve` command. Cross-platform (Mac, Windows, Linux).

**Plugin** is a standard Obsidian plugin — drop into `.obsidian/plugins/ask-between-the-lines/`.

The two packages share nothing except the HTTP contract. Either can be swapped independently.

## Data Flow (End to End)

```
1. User types ;; query in Obsidian
2. Cmd+Enter triggers the plugin
3. Plugin replaces ;; with "> [!ai] Thinking..." placeholder
4. Plugin POSTs { document, query } to server
5. Server wraps document + query into a prompt
6. Server spawns: claude -p --permission-mode bypassPermissions
7. claude -p reads MCP config, uses tools if needed
   (e.g. searches Slack for related discussions)
8. Server captures stdout, returns response → 200 OK
9. Plugin replaces placeholder with callout block
```

**The prompt template** (step 5) is the one piece of intelligence in the server — wraps document + query for Claude. Easy to iterate on.

**MCP tool access** (step 7) is the killer feature. Inline queries can reach Slack, Microsoft 365, Confluence, etc. — whatever the user has configured.

## What This Design Does NOT Include

- Token/cost tracking
- Conversation history beyond document context
- Multi-model support (future: swap `claude -p` for `gemini`, `ollama`, etc.)
- Community plugin distribution (personal tool first)
- VS Code or browser extensions (Obsidian only for now)

## Future Considerations

- **Token streaming**: `claude -p` currently delivers full responses, not token-by-token. If this changes in a future CLI update, the backend can upgrade from sync HTTP to SSE without changing the plugin. Re-test periodically.
- **Model-agnostic backend**: The server wraps a CLI call. Swapping `claude -p` for another CLI is a one-line change in the adapter.
- **Context truncation**: Long documents will hit token limits. Future work: smart truncation (keep beginning + end, trim middle).
