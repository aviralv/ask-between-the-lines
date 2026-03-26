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
| Disallowed tools | *(see below)* | Comma-separated list of tools Claude cannot use. See [Security](#security). |

## How It Works Under the Hood

The plugin spawns `claude -p` as a subprocess with your vault as the working directory. This means:
- Any `.mcp.json` in your vault is picked up — Slack, Microsoft 365, and other MCP tools work inline
- Claude sees your vault's project context

## Security

The entire document is sent as context with each query. If you open an untrusted document (e.g., pasted from the web or shared by someone else), its content could contain instructions that attempt to influence Claude's behavior (prompt injection).

**Mitigations built into the plugin:**

1. **System/user prompt separation** — The plugin's behavioral instructions are passed via `--system-prompt` (privileged position). Document content is sent as a user message. Claude is trained to prioritize system prompts over user content.

2. **Dangerous tools blocked by default** — Write and execute tools are denied via `--disallowedTools`. The default deny list:
   - Built-in: `Bash`, `Edit`, `Write`, `NotebookEdit`, `Agent`
   - MCP: `slack_send_message`, `slack_update_message`, `teams_send_message`, `outlook_create_draft`, `outlook_create_reply_draft`, `outlook_create_event`, `outlook_update_event`, `outlook_cancel_event`, `outlook_decline_event`

   Read-only tools (search, list, fetch) remain available so Claude can answer questions using your MCP-connected services.

3. **Customizable** — Edit the "Disallowed tools" setting to add or remove tools. If you trust your documents and want full write access, you can clear the list.

**What this does NOT protect against:**
- Claude reading sensitive content from your document and including it in responses (the document IS the context — that's the feature)
- A sufficiently crafted injection that works within read-only tools (e.g., searching Slack for sensitive messages)

**Rule of thumb:** Don't use `;;` queries in documents you wouldn't paste into a Claude conversation directly.

## Known Limitations

- **No streaming** — responses appear all at once after Claude finishes
- **Cold-start latency** — first query takes ~8 seconds; subsequent queries are faster
- **Desktop only** — requires `child_process` (not available on mobile)

## Credits

Inspired by [inline-claude](https://github.com/bawakul/inline-claude) by Bawa.

## License

MIT
