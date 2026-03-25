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
var import_obsidian2 = require("obsidian");

// trigger.ts
function findTrigger(editor) {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const trimmed = line.trimStart();
  if (!trimmed.startsWith(";;")) {
    return null;
  }
  const query = trimmed.slice(2).trim();
  if (query.length === 0) {
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

// client.ts
var import_obsidian = require("obsidian");
var HEALTH_RETRY_INTERVAL_MS = 2e3;
var HEALTH_MAX_RETRIES = 5;
var AbtlClient = class {
  serverUrl;
  startCommand;
  serverConfirmedHealthy = false;
  constructor(serverUrl, startCommand) {
    this.serverUrl = serverUrl;
    this.startCommand = startCommand;
  }
  async ensureServer() {
    if (this.serverConfirmedHealthy) {
      return true;
    }
    if (await this.healthCheck()) {
      this.serverConfirmedHealthy = true;
      return true;
    }
    new import_obsidian.Notice("Starting Ask Between the Lines server...");
    this.spawnServer();
    for (let i = 0; i < HEALTH_MAX_RETRIES; i++) {
      await this.sleep(HEALTH_RETRY_INTERVAL_MS);
      if (await this.healthCheck()) {
        this.serverConfirmedHealthy = true;
        new import_obsidian.Notice("Server started successfully");
        return true;
      }
    }
    new import_obsidian.Notice(
      "Couldn't start the server. Run `" + this.startCommand + "` manually and check for errors.",
      1e4
    );
    return false;
  }
  async ask(document, query) {
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: this.serverUrl + "/ask",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, query })
      });
      return { ok: true, text: response.text };
    } catch (err) {
      this.serverConfirmedHealthy = false;
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, text: message };
    }
  }
  async healthCheck() {
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: this.serverUrl + "/health",
        method: "GET"
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
  spawnServer() {
    const { exec } = require("child_process");
    exec(this.startCommand, (err) => {
      if (err) {
        console.error("Failed to start server:", err);
      }
    });
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// callout.ts
function replaceLine(editor, lineNumber, text) {
  const from = { line: lineNumber, ch: 0 };
  const lineLength = editor.getLine(lineNumber).length;
  const to = { line: lineNumber, ch: lineLength };
  editor.replaceRange(text, from, to);
}
function findThinkingCallout(editor, query) {
  const marker = formatThinkingCalloutWithQuery(query);
  const totalLines = editor.lineCount();
  for (let i = 0; i < totalLines; i++) {
    if (editor.getLine(i) === marker) {
      return i;
    }
  }
  return null;
}
function formatThinkingCalloutWithQuery(query) {
  return `> [!ai] Thinking... (${query})`;
}
function formatResponseCallout(query, response) {
  const responseLines = response.split("\n").map((line) => "> " + line).join("\n");
  return `> [!ai]- ${query}
${responseLines}`;
}
function formatErrorCallout(errorMessage) {
  return `> [!error]- Ask failed
> ${errorMessage}`;
}

// main.ts
var DEFAULT_SETTINGS = {
  serverUrl: "http://localhost:8765",
  startCommand: "abtl serve"
};
var AskBetweenTheLines = class extends import_obsidian2.Plugin {
  settings = DEFAULT_SETTINGS;
  client = null;
  async onload() {
    await this.loadSettings();
    this.client = new AbtlClient(this.settings.serverUrl, this.settings.startCommand);
    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => this.handleAsk(editor),
      hotkeys: [{ modifiers: ["Shift"], key: "Enter" }]
    });
    this.addSettingTab(new AbtlSettingTab(this.app, this));
  }
  async onunload() {
  }
  async handleAsk(editor) {
    const trigger = findTrigger(editor);
    if (!trigger) {
      return;
    }
    if (!this.client) {
      return;
    }
    const document = getDocumentWithoutTriggerLine(editor, trigger.lineNumber);
    replaceLine(editor, trigger.lineNumber, formatThinkingCalloutWithQuery(trigger.query));
    const serverReady = await this.client.ensureServer();
    if (!serverReady) {
      const thinkingLine2 = findThinkingCallout(editor, trigger.query);
      if (thinkingLine2 !== null) {
        replaceLine(editor, thinkingLine2, formatErrorCallout("Server not running"));
      }
      return;
    }
    const result = await this.client.ask(document, trigger.query);
    const thinkingLine = findThinkingCallout(editor, trigger.query);
    if (thinkingLine === null) {
      return;
    }
    if (result.ok) {
      replaceLine(editor, thinkingLine, formatResponseCallout(trigger.query, result.text));
    } else {
      replaceLine(editor, thinkingLine, formatErrorCallout(result.text));
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.client = new AbtlClient(this.settings.serverUrl, this.settings.startCommand);
  }
};
var AbtlSettingTab = class extends import_obsidian2.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Server URL").setDesc("URL of the Ask Between the Lines server").addText(
      (text) => text.setPlaceholder("http://localhost:8765").setValue(this.plugin.settings.serverUrl).onChange(async (value) => {
        this.plugin.settings.serverUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Start command").setDesc("Shell command to start the server if not running").addText(
      (text) => text.setPlaceholder("abtl serve").setValue(this.plugin.settings.startCommand).onChange(async (value) => {
        this.plugin.settings.startCommand = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
