import { Editor, Plugin, PluginSettingTab, Setting, App, Notice } from "obsidian";
import { findTrigger, getDocumentWithoutTriggerLine } from "./trigger";
import { askClaude } from "./claude";
import { buildPrompt } from "./prompt";
import {
  replaceLine,
  findThinkingCallout,
  formatThinkingCalloutWithQuery,
  formatResponseCallout,
  formatErrorCallout,
} from "./callout";

interface AbtlSettings {
  claudePath: string;
  timeoutSeconds: number;
  triggerPrefix: string;
}

const DEFAULT_SETTINGS: AbtlSettings = {
  claudePath: "claude",
  timeoutSeconds: 120,
  triggerPrefix: ";;",
};

export default class AskBetweenTheLines extends Plugin {
  settings: AbtlSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => this.handleAsk(editor),
      hotkeys: [{ modifiers: ["Shift"], key: "Enter" }],
    });

    this.addSettingTab(new AbtlSettingTab(this.app, this));
  }

  async handleAsk(editor: Editor) {
    const trigger = findTrigger(editor, this.settings.triggerPrefix);
    if (!trigger) {
      return;
    }

    const vaultPath = (this.app.vault.adapter as any).basePath as string;
    const document = getDocumentWithoutTriggerLine(editor, trigger.lineNumber);
    const prompt = buildPrompt(document, trigger.query);

    replaceLine(editor, trigger.lineNumber, formatThinkingCalloutWithQuery(trigger.query));

    const result = await askClaude(
      prompt,
      vaultPath,
      this.settings.claudePath,
      this.settings.timeoutSeconds
    );

    const thinkingLine = findThinkingCallout(editor, trigger.query);
    if (thinkingLine === null) {
      return;
    }

    if (result.ok) {
      replaceLine(
        editor,
        thinkingLine,
        formatResponseCallout(trigger.query, result.text, {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: result.durationMs,
        })
      );
    } else {
      replaceLine(editor, thinkingLine, formatErrorCallout(result.text));
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
  }
}
