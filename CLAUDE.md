# Ask Between the Lines

Jupyter-style inline Claude for markdown. Write prose, ask Claude inline, get responses as callout blocks — with full document context and all MCP tools available.

## What This Is

A local HTTP server wrapping `claude -p` that any frontend can talk to. The document IS the context — no separate chat window, no copy-pasting.

```
Frontend (Obsidian/VS Code/browser) → Local HTTP Server → claude -p (with MCP tools) → Response back
```

## Architecture

- **Backend**: Thin HTTP server (FastAPI or Bun) on localhost
- **AI**: Model-agnostic. Default: `claude -p` (inherits MCP servers from `.mcp.json`). But the server is just a wrapper around a CLI call — swap in `gemini`, Codex CLI, `ollama`, or any API endpoint.
- **Auth**: Whatever the underlying CLI uses. If you can run it in your terminal, it works here.
- **Statefulness**: One-shot queries. Document context sent with each request. No conversation continuity.

## Design Principles

- **Model-agnostic**: The frontend and server don't know or care which model is behind the CLI. The backend adapter is a single function that takes (context, query) and returns a string.
- **MCP tools preserved**: When using `claude -p`, MCP servers from the project config are available — Slack, Atlassian, Microsoft 365, etc.
- **Response format**: Collapsible callout blocks in markdown
- **Trigger pattern**: `;;` or fenced code block (TBD)

## Frontends (independent, same backend)

| Surface | Approach | Priority |
|---------|----------|----------|
| Obsidian | Adapt Bawa's [inline-claude](https://github.com/bawakul/inline-claude) | First |
| VS Code | Extension | Later |
| Browser/Confluence | Browser extension | Later |

## User Preferences

- Simple, conversational, direct
- Build fast, iterate — this is a personal tool
- Reference: Bawa's inline-claude for Obsidian patterns
- Python (FastAPI + uvicorn) preferred for backend unless Bun is simpler

## Privacy

- Server binds to localhost only
- No data leaves the machine except through `claude -p` (which goes through proxy)
- No telemetry, no logging of document content
