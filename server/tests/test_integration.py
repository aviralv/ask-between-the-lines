import shutil
import pytest
from fastapi.testclient import TestClient

from abtl.server import app

client = TestClient(app)

requires_claude = pytest.mark.skipif(
    shutil.which("claude") is None,
    reason="claude CLI not found on PATH"
)


@requires_claude
def test_ask_real_claude():
    response = client.post("/ask", json={
        "document": "# Test Document\n\nThe capital of France is Paris.",
        "query": "What is the capital of France according to this document?"
    })
    assert response.status_code == 200
    assert "Paris" in response.text
