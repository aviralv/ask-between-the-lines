import { Editor, Plugin, PluginSettingTab, Setting, App } from "obsidian";
import { findTrigger, getDocumentWithoutTriggerLine } from "./trigger";
import { AbtlClient } from "./client";
import {
  replaceLine,
  formatThinkingCallout,
  formatResponseCallout,
  formatErrorCallout,
} from "./callout";

interface AbtlSettings {
  serverUrl: string;
  startCommand: string;
}

const DEFAULT_SETTINGS: AbtlSettings = {
  serverUrl: "http://localhost:8765",
  startCommand: "abtl serve",
};

export default class AskBetweenTheLines extends Plugin {
  settings: AbtlSettings = DEFAULT_SETTINGS;
  client: AbtlClient | null = null;

  async onload() {
    await this.loadSettings();
    this.client = new AbtlClient(this.settings.serverUrl, this.settings.startCommand);

    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => this.handleAsk(editor),
      hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
    });

    this.addSettingTab(new AbtlSettingTab(this.app, this));
  }

  async onunload() {}

  async handleAsk(editor: Editor) {
    const trigger = findTrigger(editor);
    if (!trigger) {
      return;
    }

    if (!this.client) {
      return;
    }

    const document = getDocumentWithoutTriggerLine(editor, trigger.lineNumber);

    replaceLine(editor, trigger.lineNumber, formatThinkingCallout());

    const serverReady = await this.client.ensureServer();
    if (!serverReady) {
      replaceLine(editor, trigger.lineNumber, formatErrorCallout("Server not running"));
      return;
    }

    const result = await this.client.ask(document, trigger.query);

    if (result.ok) {
      replaceLine(editor, trigger.lineNumber, formatResponseCallout(trigger.query, result.text));
    } else {
      replaceLine(editor, trigger.lineNumber, formatErrorCallout(result.text));
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.client = new AbtlClient(this.settings.serverUrl, this.settings.startCommand);
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
      .setName("Server URL")
      .setDesc("URL of the Ask Between the Lines server")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:8765")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Start command")
      .setDesc("Shell command to start the server if not running")
      .addText((text) =>
        text
          .setPlaceholder("abtl serve")
          .setValue(this.plugin.settings.startCommand)
          .onChange(async (value) => {
            this.plugin.settings.startCommand = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
