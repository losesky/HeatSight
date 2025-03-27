from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.redis import redis_manager
from app.db.session import get_db
from app.services.heatlink_client import heatlink_client

router = APIRouter()


@router.get("")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint.
    
    Checks the health of the application and its dependencies.
    """
    # Check database connection
    db_status = "ok"
    try:
        # Execute a simple query to check DB connection
        db.execute(text("SELECT 1")).fetchone()
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # Check Redis connection
    redis_status = "ok" if redis_manager.is_connected else "not connected"
    
    # Check HeatLink API connection
    heatlink_status = "ok"
    try:
        # Try to call a simple HeatLink API endpoint
        await heatlink_client.get("health")
    except Exception as e:
        heatlink_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "db": db_status,
        "redis": redis_status,
        "heatlink_api": heatlink_status,
    } 