import logging
import sys
from typing import Any, Dict, Optional, Union

from loguru import logger

from app.core.config import settings


class InterceptHandler(logging.Handler):
    """
    Default handler from examples in loguru documentation.
    
    This handler intercepts all log records sent from standard logging
    module and redirects them to loguru handlers.
    """

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging() -> None:
    """Configure logging for the application."""
    # Remove all existing handlers
    logging.root.handlers = []
    
    # Set loguru format
    fmt = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )
    
    # Configure loguru logger
    logger.configure(
        handlers=[
            {
                "sink": sys.stderr,
                "format": fmt,
                "level": settings.LOG_LEVEL,
                "enqueue": True,
            }
        ],
    )
    
    # Intercept standard library logging
    logging.basicConfig(handlers=[InterceptHandler()], level=0)
    
    # Update logging levels for specific modules
    for logger_name in ("uvicorn", "uvicorn.error", "fastapi"):
        logging_logger = logging.getLogger(logger_name)
        logging_logger.handlers = [InterceptHandler()]
        logging_logger.propagate = False
        
    # Set logging level for httpx
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    # Log when logging has been set up
    logger.info("Logging configured") 