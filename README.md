# Ask Between the Lines

Jupyter-style inline Claude for markdown. Write prose, trigger AI inline, get responses as callout blocks — with full document context and tool access preserved.

## Why

Switching between a document and an AI chat window is a context switch. This removes it. You stay in the document, the AI comes to you.

## How It Works

```
You write markdown → trigger (;;) → ask a question → response appears as callout block
```

The entire document is sent as context. One-shot queries, no conversation history needed.

## Architecture

```
Any Frontend → Local HTTP Server (localhost) → CLI (claude -p / gemini / etc.) → Response
```

Model-agnostic: the server wraps whatever CLI you have access to. Default is `claude -p` which preserves MCP tool access.

## Status

🌱 Prototype — just started.

## Reference

- [inline-claude](https://github.com/bawakul/inline-claude) by Bawa — Obsidian plugin, inspiration for this project
