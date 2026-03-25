from abtl.prompt import build_prompt


def test_build_prompt_includes_document_and_query():
    result = build_prompt(document="# My Doc\n\nContent here", query="Summarize this")
    assert "# My Doc" in result
    assert "Content here" in result
    assert "Summarize this" in result


def test_build_prompt_has_system_framing():
    result = build_prompt(document="doc", query="q")
    assert "--- DOCUMENT ---" in result
    assert "--- END DOCUMENT ---" in result
