from unittest.mock import patch
from fastapi.testclient import TestClient

from abtl.server import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ask_returns_claude_response():
    with patch("abtl.server.ask_claude", return_value="The answer is 42"):
        response = client.post("/ask", json={
            "document": "# Doc\n\nContent",
            "query": "What is the answer?"
        })
    assert response.status_code == 200
    assert response.text == "The answer is 42"


def test_ask_returns_504_on_timeout():
    from abtl.claude_adapter import ClaudeError
    with patch("abtl.server.ask_claude", side_effect=ClaudeError("timed out after 120 seconds")):
        response = client.post("/ask", json={
            "document": "doc",
            "query": "q"
        })
    assert response.status_code == 504


def test_ask_returns_500_on_claude_error():
    from abtl.claude_adapter import ClaudeError
    with patch("abtl.server.ask_claude", side_effect=ClaudeError("CLI not found")):
        response = client.post("/ask", json={
            "document": "doc",
            "query": "q"
        })
    assert response.status_code == 500


def test_ask_returns_422_on_missing_fields():
    response = client.post("/ask", json={"document": "doc"})
    assert response.status_code == 422
