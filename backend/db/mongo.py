from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    """Connect to MongoDB Atlas using Motor (async driver)."""
    global client, db
    client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=30000,   # 30s — Atlas can be slow first connect
        connectTimeoutMS=30000,
        socketTimeoutMS=30000,
        tlsAllowInvalidCertificates=False,
    )
    db = client[settings.database_name]

    # Use the motor async command properly
    try:
        # Motor's async ping — this correctly awaits the async wrapper
        result = await client.admin.command("ping")
        logger.info(f"✅ Connected to MongoDB Atlas: {settings.database_name} (ping: {result})")
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        raise RuntimeError(
            f"Could not connect to MongoDB Atlas.\n"
            f"  URI starts with: {settings.mongodb_uri[:50]}...\n"
            f"  Error: {e}\n\n"
            f"  Fix checklist:\n"
            f"  1. Verify username/password in Atlas → Database Access\n"
            f"  2. Whitelist IP: Atlas → Network Access → Add 0.0.0.0/0\n"
            f"  3. Confirm cluster is not paused (free tier auto-pauses)\n"
        ) from e


async def close_db():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")


def get_db():
    """Get the database instance for dependency injection."""
    if db is None:
        raise RuntimeError("Database not connected. Was connect_db() called at startup?")
    return db
