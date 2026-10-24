from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings


settings = get_settings()

client: AsyncIOMotorClient | None = None


def get_database() -> AsyncIOMotorDatabase:
    global client
    if client is None:
        client = AsyncIOMotorClient(settings.mongodb_uri)
    return client[settings.mongodb_db]


def close_database() -> None:
    global client
    if client is not None:
        client.close()
        client = None
