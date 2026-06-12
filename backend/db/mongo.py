from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings

settings = get_settings()

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    """Connect to MongoDB Atlas"""
    global client, db
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.database_name]
    # Ping to confirm connection
    await client.admin.command("ping")
    print(f"✅ Connected to MongoDB Atlas: {settings.database_name}")


async def close_db():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()
        print("❌ MongoDB connection closed")


def get_db():
    """Get database instance"""
    return db
