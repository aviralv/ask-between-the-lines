export interface ClaudeResponse {
  ok: boolean;
  text: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  sessionId: string;
}

interface ClaudeJsonOutput {
  type: string;
  result: string;
  session_id?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  duration_ms?: number;
}

export function parseClaudeOutput(stdout: string): ClaudeResponse {
  try {
    const parsed: ClaudeJsonOutput = JSON.parse(stdout);
    return {
      ok: true,
      text: parsed.result,
      inputTokens: parsed.usage?.input_tokens ?? 0,
      outputTokens: parsed.usage?.output_tokens ?? 0,
      durationMs: parsed.duration_ms ?? 0,
      sessionId: parsed.session_id ?? "",
    };
  } catch {
    return {
      ok: false,
      text: "Failed to parse Claude response: " + stdout.slice(0, 200),
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      sessionId: "",
    };
  }
}

export interface AskClaudeOptions {
  userMessage: string;
  systemPrompt: string;
  vaultPath: string;
  claudePath: string;
  timeoutSeconds: number;
  disallowedTools: string[];
  resumeSessionId?: string;
}

export function askClaude(opts: AskClaudeOptions): Promise<ClaudeResponse> {
  return new Promise((resolve) => {
    const { spawn } = require("child_process") as typeof import("child_process");
    const args = ["-p", "--output-format", "json", "--permission-mode", "bypassPermissions",
      "--system-prompt", opts.systemPrompt];
    if (opts.disallowedTools.length > 0) {
      args.push("--disallowedTools", opts.disallowedTools.join(" "));
    }
    if (opts.resumeSessionId) {
      args.push("--resume", opts.resumeSessionId);
    }

    const child = spawn(opts.claudePath, args, {
      cwd: opts.vaultPath,
      timeout: opts.timeoutSeconds * 1000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (error: Error) => {
      resolve({
        ok: false,
        text: error.message,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        sessionId: "",
      });
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        resolve({
          ok: false,
          text: stderr || `claude exited with code ${code}`,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          sessionId: "",
        });
        return;
      }

      resolve(parseClaudeOutput(stdout));
    });

    child.stdin.write(opts.userMessage);
    child.stdin.end();
  });
}
