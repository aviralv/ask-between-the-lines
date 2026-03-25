import subprocess
from unittest.mock import patch, MagicMock

from abtl.claude_adapter import ask_claude, ClaudeError


def test_ask_claude_returns_stdout():
    mock_result = MagicMock()
    mock_result.stdout = "The answer is 42"
    mock_result.returncode = 0

    with patch("abtl.claude_adapter.subprocess.run", return_value=mock_result) as mock_run:
        result = ask_claude("prompt text")

    assert result == "The answer is 42"
    mock_run.assert_called_once()
    call_args = mock_run.call_args
    assert "claude" in call_args.args[0]
    assert "-p" in call_args.args[0]
    assert "--permission-mode" in call_args.args[0]
    assert "bypassPermissions" in call_args.args[0]


def test_ask_claude_passes_prompt_as_input():
    mock_result = MagicMock()
    mock_result.stdout = "response"
    mock_result.returncode = 0

    with patch("abtl.claude_adapter.subprocess.run", return_value=mock_result) as mock_run:
        ask_claude("my prompt")

    assert mock_run.call_args.kwargs["input"] == "my prompt"


def test_ask_claude_raises_on_timeout():
    with patch("abtl.claude_adapter.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="claude", timeout=120)):
        try:
            ask_claude("prompt")
            assert False, "Should have raised ClaudeError"
        except ClaudeError as e:
            assert "timed out" in str(e).lower()


def test_ask_claude_raises_on_nonzero_exit():
    mock_result = MagicMock()
    mock_result.stdout = ""
    mock_result.stderr = "Something went wrong"
    mock_result.returncode = 1

    with patch("abtl.claude_adapter.subprocess.run", return_value=mock_result):
        try:
            ask_claude("prompt")
            assert False, "Should have raised ClaudeError"
        except ClaudeError as e:
            assert "Something went wrong" in str(e)
