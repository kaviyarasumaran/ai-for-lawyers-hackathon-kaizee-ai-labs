from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import close_database, get_database

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = get_database()
    try:
        await db.command("ping")
    except Exception:
        print("MongoDB is not reachable yet. The API will still start.")
    yield
    close_database()


app = FastAPI(title=settings.app_name, lifespan=lifespan)


@app.get("/")
async def root() -> dict:
    return {"message": f"{settings.app_name} is running"}


@app.get("/health")
async def healthcheck() -> dict:
    try:
        db = get_database()
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "disconnected", "error": str(exc)},
        )


@app.get("/mongo-status")
async def mongo_status() -> dict:
    try:
        db = get_database()
        await db.command("ping")
        return {"status": "connected", "database": settings.mongodb_db}
    except Exception as exc:
        return {"status": "disconnected", "database": settings.mongodb_db, "error": str(exc)}
