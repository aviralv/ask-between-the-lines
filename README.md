# Ask Between the Lines

Inline Claude for Obsidian. Write in markdown, ask questions with `;;`, get AI responses as callout blocks — with full document context and MCP tool access.

## How It Works

Type `;;` followed by your question on any line, then press `Shift+Enter`:

```
;;What are the key themes in this document?
```

The question is replaced with a collapsible callout containing Claude's response:

```markdown
> [!ai]- What are the key themes in this document?
> The document focuses on three themes: team velocity, technical debt prioritization,
> and the shift from quarterly to continuous planning.
>
> *523 in · 47 out · 3.2s*
```

The entire document is sent as context. Each query is one-shot — no conversation history needed.

## Prerequisites

- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Obsidian 1.4.0+

## Install via BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian community plugins
2. Open command palette → `BRAT: Add a beta plugin for testing`
3. Paste: `https://github.com/aviralv/ask-between-the-lines`
4. Enable "Ask Between the Lines" in Settings → Community Plugins

## Install Manually

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/aviralv/ask-between-the-lines/releases)
2. Create `.obsidian/plugins/ask-between-the-lines/` in your vault
3. Copy both files into that folder
4. Enable the plugin in Settings → Community Plugins

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Claude CLI path | `claude` | Full path to the Claude binary. Set this if Obsidian can't find `claude` on your PATH (common on macOS). |
| Timeout | `120` | Seconds to wait for a response before timing out. |
| Trigger prefix | `;;` | Characters that trigger an inline query. |

## How It Works Under the Hood

The plugin spawns `claude -p` as a subprocess with your vault as the working directory. This means:
- Any `.mcp.json` in your vault is picked up — Slack, Microsoft 365, and other MCP tools work inline
- Claude sees your vault's project context

## Known Limitations

- **No streaming** — responses appear all at once after Claude finishes
- **Cold-start latency** — first query takes ~8 seconds; subsequent queries are faster
- **Desktop only** — requires `child_process` (not available on mobile)

## Credits

Inspired by [inline-claude](https://github.com/bawakul/inline-claude) by Bawa.

## License

MIT
