import asyncio
from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.scheduler import scheduler
from app.core.tasks import register_tasks
from app.db.redis import redis_manager

# Get the static directory path
STATIC_DIR = Path(__file__).parent / "static"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    setup_logging()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    
    # Connect to Redis
    await redis_manager.connect()
    
    # Setup task scheduler
    logger.info("Setting up task scheduler...")
    scheduler.setup(app)
    register_tasks()
    
    # Start the scheduler
    logger.info("Starting task scheduler...")
    await scheduler.start()
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}")
    
    # Stop the scheduler
    logger.info("Stopping task scheduler...")
    await scheduler.stop()
    
    # Disconnect from Redis
    await redis_manager.disconnect()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="面向内容创作者的热点灵感挖掘平台",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include API router
    app.include_router(api_router, prefix="/api")
    
    # Mount static files
    if os.path.exists(STATIC_DIR):
        app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")
    
    return app


app = create_app() 