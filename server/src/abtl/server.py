from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from abtl.claude_adapter import ask_claude, ClaudeError
from abtl.prompt import build_prompt

app = FastAPI(title="Ask Between the Lines")


class AskRequest(BaseModel):
    document: str
    query: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ask", response_class=PlainTextResponse)
async def ask(request: AskRequest):
    prompt = build_prompt(document=request.document, query=request.query)
    try:
        response = ask_claude(prompt)
    except ClaudeError as e:
        error_msg = str(e)
        if "timed out" in error_msg.lower():
            return PlainTextResponse(error_msg, status_code=504)
        return PlainTextResponse(error_msg, status_code=500)
    return response
