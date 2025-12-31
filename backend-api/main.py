from fastapi import FastAPI

app = FastAPI(title="PowerTunePro Calculators - Backend")


@app.get("/health")
def health():
    return {"status": "ok"}
