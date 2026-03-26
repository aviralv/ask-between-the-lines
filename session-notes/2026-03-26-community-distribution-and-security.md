# 2026-03-26 — Community Distribution & Security Hardening

**Previous session:** [v0.1.0 Implementation](2026-03-25-v01-implementation.md)

## What happened

Two-phase session: first made the plugin distributable, then hardened it against prompt injection.

### Phase 1: Community Distribution (v1.0.0)

Eliminated the Python server dependency — plugin now calls `claude -p` directly via `child_process.spawn`. This makes installation zero-setup for anyone with Claude Code.

- **Subprocess adapter** (`claude.ts`): Spawns `claude -p --output-format json` with vault as cwd. Parses JSON response for token usage and duration.
- **Plugin files moved to repo root**: BRAT requires `manifest.json` at root.
- **README rewritten** for end-user installation (BRAT + manual).
- **v1.0.0 released** on GitHub, repo made public.
- **Installed in InnerStudio vault** for dogfooding.

### Phase 2: Security Hardening (v1.1.0)

Audit identified that `--permission-mode bypassPermissions` + full document as context = prompt injection risk. A malicious document could instruct Claude to run Bash, send Slack messages, etc.

Three mitigations:

1. **System/user prompt separation** — `prompt.ts` split into `getSystemPrompt()` (passed via `--system-prompt` flag) and `buildUserMessage()` (piped to stdin). System prompt sits in privileged position.

2. **Dangerous tools blocked by default** — `--disallowedTools` denies: Bash, Edit, Write, NotebookEdit, Agent, slack_send_message, slack_update_message, teams_send_message, outlook_create_draft, outlook_create_reply_draft, outlook_create_event, outlook_update_event, outlook_cancel_event, outlook_decline_event. Read-only tools remain available.

3. **Customizable deny list** — New settings field. Advanced users can remove tools from the list if they trust their documents.

### First External Install

Worked on first try (after setting Claude CLI path). macOS gotcha: Obsidian doesn't inherit shell PATH, so full path (`~/.local/bin/claude`) needed in settings.

## Decisions

- Default deny list is aggressive (block all write/execute) — users opt in to danger, not out
- Deny list stored as comma-separated string in settings (simple UI, no array editor needed)
- `buildPrompt()` kept as deprecated wrapper for backwards compat
- Repo made public for BRAT distribution

## What's next

- Test with more users — watch for PATH issues, timeout tuning
- Consider: auto-detect Claude CLI path on plugin load?
- Monitor for new MCP write tools that should be added to default deny list
- Streaming support blocked on `claude -p` not supporting token streaming
