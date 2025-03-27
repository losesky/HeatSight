from fastapi import APIRouter

from app.api.v1 import health, topics, content

# Create main API router
api_router = APIRouter()

# Include routers from specific API versions
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(topics.router, prefix="/topics", tags=["topics"])
api_router.include_router(content.router, prefix="/content", tags=["content"]) 