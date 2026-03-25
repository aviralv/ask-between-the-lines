# 2026-03-25 — v0.1.0 Implementation

**Duration:** ~2 hours
**Previous session:** [Project Kickoff](2026-03-25-kickoff.md)

## What happened

Built the full v0.1.0 from spec through working prototype in Obsidian.

### Process

- Used subagent-driven development: fresh subagent per task, two-stage review (spec compliance + code quality) after each
- 11 tasks executed: 5 server, 5 plugin, 1 E2E test
- Parallelized heavily: independent tasks and reviews dispatched concurrently

### Server (Tasks 1-5)

- FastAPI on localhost:8765 with `/health` and `/ask` endpoints
- `claude -p --permission-mode bypassPermissions` spawned per request via subprocess
- Prompt template wraps document + query with `--- DOCUMENT ---` framing
- 12 tests: 4 adapter (mocked), 2 prompt, 5 endpoint (mocked), 1 integration (real claude -p)

### Plugin (Tasks 6-10)

- Standard Obsidian plugin: esbuild bundling, TypeScript
- `trigger.ts` — detects `;;` at line start, extracts query
- `client.ts` — HTTP client with health check, 5-retry auto-start (2s intervals)
- `callout.ts` — formats thinking/response/error as Obsidian callout blocks
- `main.ts` — wires everything together with settings tab (server URL, start command)

### E2E Test (Task 11)

- Server installed via `uv tool install -e ./server`
- Plugin symlinked into the-product-kitchen vault
- Tested: basic query, MCP tool access (Slack search worked inline)

## Bugs found and fixed

1. **`.format()` crash on curly braces** — documents containing `{}` (code blocks, JSON) would crash the prompt builder. Fixed: string concatenation instead of `.format()`
2. **Blocking async route** — `async def ask()` blocked the event loop during the ~8s subprocess call. Fixed: `def ask()` so FastAPI runs it in thread pool
3. **Hotkey conflict** — `Cmd+Enter` taken by "Open link under cursor in new tab". Changed default to `Shift+Enter`
4. **Concurrent query clobbering** — two `;;` queries would resolve to same line number. Fixed: thinking callout includes query text, response finds its placeholder by content search

## Decisions

- Shift+Enter as default hotkey (user's choice)
- No streaming (claude -p doesn't support token streaming — validated during kickoff)
- String concat for prompt template (safer than `.format()` with user content)

## What's next

- Test conversational continuity (follow-up questions referencing previous callouts)
- Test edge cases: long documents, empty queries, server crash mid-request
- Consider: auto-kill server on Obsidian close? (currently harmless — lightweight localhost process)
