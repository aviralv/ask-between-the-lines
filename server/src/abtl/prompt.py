SYSTEM_TEMPLATE_PREFIX = """You are an AI assistant embedded in the user's document. The user is writing \
in markdown and has asked you a question inline. Answer based on the document \
context and any tools available to you.

--- DOCUMENT ---
"""

SYSTEM_TEMPLATE_SUFFIX = """
--- END DOCUMENT ---

User asks: """


def build_prompt(document: str, query: str) -> str:
    return SYSTEM_TEMPLATE_PREFIX + document + SYSTEM_TEMPLATE_SUFFIX + query
