from fastapi import FastAPI


app = FastAPI(title="Groupher Document Converter")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/convert")
def convert() -> dict[str, str]:
    return {
        "status": "ready",
        "markdown": "",
    }
