SYSTEM_TEMPLATE = """You are an AI assistant embedded in the user's document. The user is writing \
in markdown and has asked you a question inline. Answer based on the document \
context and any tools available to you.

--- DOCUMENT ---
{document}
--- END DOCUMENT ---

User asks: {query}"""


def build_prompt(document: str, query: str) -> str:
    return SYSTEM_TEMPLATE.format(document=document, query=query)
