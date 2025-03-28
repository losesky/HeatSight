from fastapi import APIRouter

from app.api.v1 import health, topics, content, heatlink, heat_score

# Create main API router
api_router = APIRouter()

# Include routers from specific API versions
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(topics.router, prefix="/topics", tags=["topics"])
api_router.include_router(content.router, prefix="/content", tags=["content"])
api_router.include_router(heatlink.router, prefix="/heatlink", tags=["heatlink"])
api_router.include_router(heat_score.router, prefix="/heat-score", tags=["heat-score"]) 