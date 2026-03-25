from fastapi import FastAPI

app = FastAPI(title="Ask Between the Lines")


@app.get("/health")
async def health():
    return {"status": "ok"}
