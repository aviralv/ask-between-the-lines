import { Editor, Plugin, PluginSettingTab, Setting, App } from "obsidian";
import { findTrigger, getDocumentContext } from "./trigger";
import { askClaude } from "./claude";
import { getSystemPrompt, buildUserMessage, stripAiCallouts } from "./prompt";
import {
  replaceLine,
  findThinkingCallout,
  formatThinkingCallout,
  formatResponseCallout,
  formatErrorCallout,
  SessionStatus,
} from "./callout";

interface AbtlSettings {
  claudePath: string;
  timeoutSeconds: number;
  triggerPrefix: string;
  disallowedTools: string;
  includeAiCallouts: boolean;
}

const DEFAULT_DISALLOWED_TOOLS = "Bash,Edit,Write,NotebookEdit,Agent,slack_send_message,slack_update_message,teams_send_message,outlook_create_draft,outlook_create_reply_draft,outlook_create_event,outlook_update_event,outlook_cancel_event,outlook_decline_event";

const DEFAULT_SETTINGS: AbtlSettings = {
  claudePath: "claude",
  timeoutSeconds: 120,
  triggerPrefix: ";;",
  disallowedTools: DEFAULT_DISALLOWED_TOOLS,
  includeAiCallouts: false,
};

export default class AskBetweenTheLines extends Plugin {
  settings: AbtlSettings = DEFAULT_SETTINGS;
  mode: "one-shot" | "session" = "one-shot";
  sessions: Map<string, { sessionId: string }> = new Map();
  statusBarEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.onClickEvent(() => this.toggleMode());
    this.updateStatusBar();

    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => this.handleAsk(editor),
      hotkeys: [{ modifiers: ["Shift"], key: "Enter" }],
    });

    this.addCommand({
      id: "toggle-mode",
      name: "Toggle ask mode (one-shot / session)",
      callback: () => this.toggleMode(),
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

  private getActiveFilePath(): string | null {
    const file = this.app.workspace.getActiveFile();
    return file?.path ?? null;
  }

  private clearCurrentSession() {
    const filePath = this.getActiveFilePath();
    if (filePath) {
      this.sessions.delete(filePath);
    }
  }

  async handleAsk(editor: Editor) {
    const trigger = findTrigger(editor, this.settings.triggerPrefix);
    if (!trigger) {
      return;
    }

    const vaultPath = (this.app.vault.adapter as any).basePath as string;
    let document = getDocumentContext(editor, trigger.lineNumber);
    if (!this.settings.includeAiCallouts) {
      document = stripAiCallouts(document);
    }
    const userMessage = buildUserMessage(document, trigger.query);

    const filePath = this.getActiveFilePath();
    const isSessionMode = this.mode === "session";
    const existingSession = filePath ? this.sessions.get(filePath) : undefined;

    let sessionStatus: SessionStatus | undefined;
    if (isSessionMode) {
      sessionStatus = existingSession ? "continued" : "new";
    }

    replaceLine(editor, trigger.lineNumber, formatThinkingCallout(trigger.query, sessionStatus));

    const disallowedTools = this.settings.disallowedTools
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const result = await askClaude({
      userMessage,
      systemPrompt: getSystemPrompt(),
      vaultPath,
      claudePath: this.settings.claudePath,
      timeoutSeconds: this.settings.timeoutSeconds,
      disallowedTools,
      resumeSessionId: existingSession?.sessionId,
    });

    let finalResult = result;
    let finalSessionStatus = sessionStatus;

    if (!result.ok && existingSession && isSessionMode) {
      this.sessions.delete(filePath!);
      finalSessionStatus = "new";
      finalResult = await askClaude({
        userMessage,
        systemPrompt: getSystemPrompt(),
        vaultPath,
        claudePath: this.settings.claudePath,
        timeoutSeconds: this.settings.timeoutSeconds,
        disallowedTools,
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
          durationMs: finalResult.durationMs,
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
}

class AbtlSettingTab extends PluginSettingTab {
  plugin: AskBetweenTheLines;

  constructor(app: App, plugin: AskBetweenTheLines) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Claude CLI path")
      .setDesc("Path to the Claude CLI binary (e.g. /usr/local/bin/claude)")
      .addText((text) =>
        text
          .setPlaceholder("claude")
          .setValue(this.plugin.settings.claudePath)
          .onChange(async (value) => {
            this.plugin.settings.claudePath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Timeout (seconds)")
      .setDesc("Maximum time to wait for a response")
      .addText((text) =>
        text
          .setPlaceholder("120")
          .setValue(String(this.plugin.settings.timeoutSeconds))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed > 0) {
              this.plugin.settings.timeoutSeconds = parsed;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Trigger prefix")
      .setDesc("Characters that trigger an inline query (default: ;;)")
      .addText((text) =>
        text
          .setPlaceholder(";;")
          .setValue(this.plugin.settings.triggerPrefix)
          .onChange(async (value) => {
            if (value.length > 0) {
              this.plugin.settings.triggerPrefix = value;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Disallowed tools")
      .setDesc("Comma-separated list of tools Claude cannot use. Blocks dangerous write/execute tools by default.")
      .addTextArea((text) =>
        text
          .setPlaceholder(DEFAULT_DISALLOWED_TOOLS)
          .setValue(this.plugin.settings.disallowedTools)
          .onChange(async (value) => {
            this.plugin.settings.disallowedTools = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Include AI responses in context")
      .setDesc("When enabled, previous AI callout blocks are included in the document context sent to Claude. When disabled (default), they are stripped.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeAiCallouts)
          .onChange(async (value) => {
            this.plugin.settings.includeAiCallouts = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
