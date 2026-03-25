import { requestUrl, Notice } from "obsidian";

const HEALTH_RETRY_INTERVAL_MS = 2000;
const HEALTH_MAX_RETRIES = 5;

export interface AskResponse {
  ok: boolean;
  text: string;
}

export class AbtlClient {
  private serverUrl: string;
  private startCommand: string;
  private serverConfirmedHealthy = false;

  constructor(serverUrl: string, startCommand: string) {
    this.serverUrl = serverUrl;
    this.startCommand = startCommand;
  }

  async ensureServer(): Promise<boolean> {
    if (this.serverConfirmedHealthy) {
      return true;
    }

    if (await this.healthCheck()) {
      this.serverConfirmedHealthy = true;
      return true;
    }

    new Notice("Starting Ask Between the Lines server...");
    this.spawnServer();

    for (let i = 0; i < HEALTH_MAX_RETRIES; i++) {
      await this.sleep(HEALTH_RETRY_INTERVAL_MS);
      if (await this.healthCheck()) {
        this.serverConfirmedHealthy = true;
        new Notice("Server started successfully");
        return true;
      }
    }

    new Notice(
      "Couldn't start the server. Run `" + this.startCommand + "` manually and check for errors.",
      10000
    );
    return false;
  }

  async ask(document: string, query: string): Promise<AskResponse> {
    try {
      const response = await requestUrl({
        url: this.serverUrl + "/ask",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, query }),
      });

      return { ok: true, text: response.text };
    } catch (err) {
      this.serverConfirmedHealthy = false;
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, text: message };
    }
  }

  private async healthCheck(): Promise<boolean> {
    try {
      const response = await requestUrl({
        url: this.serverUrl + "/health",
        method: "GET",
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private spawnServer(): void {
    const { exec } = require("child_process");
    exec(this.startCommand, (err: Error | null) => {
      if (err) {
        console.error("Failed to start server:", err);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
