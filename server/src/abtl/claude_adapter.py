import subprocess


class ClaudeError(Exception):
    pass


DEFAULT_TIMEOUT = 120


def ask_claude(prompt: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    try:
        result = subprocess.run(
            ["claude", "-p", "--permission-mode", "bypassPermissions"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise ClaudeError(f"claude -p timed out after {timeout} seconds")
    except FileNotFoundError:
        raise ClaudeError("claude CLI not found. Is it installed and on PATH?")

    if result.returncode != 0:
        raise ClaudeError(f"claude -p failed (exit {result.returncode}): {result.stderr}")

    return result.stdout.strip()
