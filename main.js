var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AskBetweenTheLines
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// trigger.ts
function extractQuery(line, prefix) {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith(prefix)) {
    return null;
  }
  const query = trimmed.slice(prefix.length).trim();
  if (query.length === 0) {
    return null;
  }
  return query;
}
function findTrigger(editor, prefix = ";;") {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const query = extractQuery(line, prefix);
  if (query === null) {
    return null;
  }
  return {
    query,
    lineNumber: cursor.line
  };
}
function getDocumentWithoutTriggerLine(editor, triggerLine) {
  const totalLines = editor.lineCount();
  const lines = [];
  for (let i = 0; i < totalLines; i++) {
    if (i !== triggerLine) {
      lines.push(editor.getLine(i));
    }
  }
  return lines.join("\n");
}

// claude.ts
function parseClaudeOutput(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return {
      ok: true,
      text: parsed.result,
      inputTokens: parsed.usage?.input_tokens ?? 0,
      outputTokens: parsed.usage?.output_tokens ?? 0,
      durationMs: parsed.duration_ms ?? 0,
      sessionId: parsed.session_id ?? ""
    };
  } catch {
    return {
      ok: false,
      text: "Failed to parse Claude response: " + stdout.slice(0, 200),
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      sessionId: ""
    };
  }
}
function askClaude(opts) {
  return new Promise((resolve) => {
    const { spawn } = require("child_process");
    const args = [
      "-p",
      "--output-format",
      "json",
      "--permission-mode",
      "bypassPermissions",
      "--system-prompt",
      opts.systemPrompt
    ];
    if (opts.disallowedTools.length > 0) {
      args.push("--disallowedTools", opts.disallowedTools.join(" "));
    }
    if (opts.resumeSessionId) {
      args.push("--resume", opts.resumeSessionId);
    }
    const child = spawn(opts.claudePath, args, {
      cwd: opts.vaultPath,
      timeout: opts.timeoutSeconds * 1e3,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        text: error.message,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        sessionId: ""
      });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({
          ok: false,
          text: stderr || `claude exited with code ${code}`,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          sessionId: ""
        });
        return;
      }
      resolve(parseClaudeOutput(stdout));
    });
    child.stdin.write(opts.userMessage);
    child.stdin.end();
  });
}

// prompt.ts
var SYSTEM_INSTRUCTION = "You are an inline assistant embedded in the user's document. The user asked a question while writing. Answer concisely \u2014 a few sentences, not paragraphs. Match the tone of the document. If the question is simple, the answer should be short.";
var DOCUMENT_PREFIX = "\n\n--- DOCUMENT ---\n";
var DOCUMENT_SUFFIX = "\n--- END DOCUMENT ---\n\n";
function stripAiCallouts(document) {
  const lines = document.split("\n");
  const result = [];
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
function getSystemPrompt() {
  return SYSTEM_INSTRUCTION;
}
function buildUserMessage(document, query) {
  return DOCUMENT_PREFIX + document + DOCUMENT_SUFFIX + query;
}

// callout.ts
function replaceLine(editor, lineNumber, text) {
  const from = { line: lineNumber, ch: 0 };
  const lineLength = editor.getLine(lineNumber).length;
  const to = { line: lineNumber, ch: lineLength };
  editor.replaceRange(text, from, to);
}
function findThinkingCallout(editor, query) {
  const totalLines = editor.lineCount();
  for (let i = 0; i < totalLines; i++) {
    const line = editor.getLine(i);
    if (line.startsWith("> [!ai] Thinking") && line.endsWith(`(${query})`)) {
      return i;
    }
  }
  return null;
}
function formatThinkingCallout(query, sessionStatus) {
  if (sessionStatus === "new") {
    return `> [!ai] Thinking (new)... (${query})`;
  }
  if (sessionStatus === "continued") {
    return `> [!ai] Thinking (cont'd)... (${query})`;
  }
  return `> [!ai] Thinking... (${query})`;
}
function formatResponseCallout(query, response, metadata, sessionStatus) {
  const responseLines = response.split("\n").map((line) => "> " + line).join("\n");
  let callout = `> [!ai]- ${query}
${responseLines}`;
  if (metadata) {
    const seconds = (metadata.durationMs / 1e3).toFixed(1);
    let footer = `${metadata.inputTokens} in \xB7 ${metadata.outputTokens} out \xB7 ${seconds}s`;
    if (sessionStatus === "new") {
      footer += " \xB7 new session";
    } else if (sessionStatus === "continued") {
      footer += " \xB7 continued";
    }
    callout += `
>
> *${footer}*`;
  }
  return callout;
}
function formatErrorCallout(errorMessage) {
  return `> [!error]- Ask failed
> ${errorMessage}`;
}

// main.ts
var DEFAULT_DISALLOWED_TOOLS = "Bash,Edit,Write,NotebookEdit,Agent,slack_send_message,slack_update_message,teams_send_message,outlook_create_draft,outlook_create_reply_draft,outlook_create_event,outlook_update_event,outlook_cancel_event,outlook_decline_event";
var DEFAULT_SETTINGS = {
  claudePath: "claude",
  timeoutSeconds: 120,
  triggerPrefix: ";;",
  disallowedTools: DEFAULT_DISALLOWED_TOOLS,
  includeAiCallouts: false
};
var AskBetweenTheLines = class extends import_obsidian.Plugin {
  settings = DEFAULT_SETTINGS;
  mode = "one-shot";
  sessions = /* @__PURE__ */ new Map();
  statusBarEl = null;
  async onload() {
    await this.loadSettings();
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.onClickEvent(() => this.toggleMode());
    this.updateStatusBar();
    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => this.handleAsk(editor),
      hotkeys: [{ modifiers: ["Shift"], key: "Enter" }]
    });
    this.addCommand({
      id: "toggle-mode",
      name: "Toggle ask mode (one-shot / session)",
      callback: () => this.toggleMode()
    });
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.clearCurrentSession();
      })
    );
    this.addSettingTab(new AbtlSettingTab(this.app, this));
  }
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
  }
  getActiveFilePath() {
    const file = this.app.workspace.getActiveFile();
    return file?.path ?? null;
  }
  clearCurrentSession() {
    const filePath = this.getActiveFilePath();
    if (filePath) {
      this.sessions.delete(filePath);
    }
  }
  async handleAsk(editor) {
    const trigger = findTrigger(editor, this.settings.triggerPrefix);
    if (!trigger) {
      return;
    }
    const vaultPath = this.app.vault.adapter.basePath;
    let document = getDocumentWithoutTriggerLine(editor, trigger.lineNumber);
    if (!this.settings.includeAiCallouts) {
      document = stripAiCallouts(document);
    }
    const userMessage = buildUserMessage(document, trigger.query);
    const filePath = this.getActiveFilePath();
    const isSessionMode = this.mode === "session";
    const existingSession = filePath ? this.sessions.get(filePath) : void 0;
    let sessionStatus;
    if (isSessionMode) {
      sessionStatus = existingSession ? "continued" : "new";
    }
    replaceLine(editor, trigger.lineNumber, formatThinkingCallout(trigger.query, sessionStatus));
    const disallowedTools = this.settings.disallowedTools.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
    const result = await askClaude({
      userMessage,
      systemPrompt: getSystemPrompt(),
      vaultPath,
      claudePath: this.settings.claudePath,
      timeoutSeconds: this.settings.timeoutSeconds,
      disallowedTools,
      resumeSessionId: existingSession?.sessionId
    });
    let finalResult = result;
    let finalSessionStatus = sessionStatus;
    if (!result.ok && existingSession && isSessionMode) {
      this.sessions.delete(filePath);
      finalSessionStatus = "new";
      finalResult = await askClaude({
        userMessage,
        systemPrompt: getSystemPrompt(),
        vaultPath,
        claudePath: this.settings.claudePath,
        timeoutSeconds: this.settings.timeoutSeconds,
        disallowedTools
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
          durationMs: finalResult.durationMs
        }, finalSessionStatus)
      );
    } else {
      replaceLine(editor, thinkingLine, formatErrorCallout(finalResult.text));
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var AbtlSettingTab = class extends import_obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Claude CLI path").setDesc("Path to the Claude CLI binary (e.g. /usr/local/bin/claude)").addText(
      (text) => text.setPlaceholder("claude").setValue(this.plugin.settings.claudePath).onChange(async (value) => {
        this.plugin.settings.claudePath = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Timeout (seconds)").setDesc("Maximum time to wait for a response").addText(
      (text) => text.setPlaceholder("120").setValue(String(this.plugin.settings.timeoutSeconds)).onChange(async (value) => {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.plugin.settings.timeoutSeconds = parsed;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Trigger prefix").setDesc("Characters that trigger an inline query (default: ;;)").addText(
      (text) => text.setPlaceholder(";;").setValue(this.plugin.settings.triggerPrefix).onChange(async (value) => {
        if (value.length > 0) {
          this.plugin.settings.triggerPrefix = value;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Disallowed tools").setDesc("Comma-separated list of tools Claude cannot use. Blocks dangerous write/execute tools by default.").addTextArea(
      (text) => text.setPlaceholder(DEFAULT_DISALLOWED_TOOLS).setValue(this.plugin.settings.disallowedTools).onChange(async (value) => {
        this.plugin.settings.disallowedTools = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Include AI responses in context").setDesc("When enabled, previous AI callout blocks are included in the document context sent to Claude. When disabled (default), they are stripped.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeAiCallouts).onChange(async (value) => {
        this.plugin.settings.includeAiCallouts = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
