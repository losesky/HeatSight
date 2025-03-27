import argparse
import os
import sys
import uvicorn

from app.core.config import settings


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Run the HeatSight API server")
    
    parser.add_argument(
        "--host",
        type=str,
        default=settings.HOST,
        help=f"Host to bind the server to (default: {settings.HOST})",
    )
    
    parser.add_argument(
        "--port",
        type=int,
        default=settings.PORT,
        help=f"Port to bind the server to (default: {settings.PORT})",
    )
    
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development",
    )
    
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1)",
    )
    
    return parser.parse_args()


if __name__ == "__main__":
    # Make sure the backend directory is in the Python path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    # Parse command line arguments
    args = parse_args()
    
    # Run the server
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers,
    ) 