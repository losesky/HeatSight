import asyncio
from datetime import datetime
import time
from typing import Dict, List, Callable, Any, Awaitable, Optional

from fastapi import FastAPI
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal


class TaskScheduler:
    """Task scheduler for running periodic background tasks."""
    
    def __init__(self):
        self.tasks = {}
        self.is_running = False
        self.app = None
    
    def setup(self, app: FastAPI):
        """Setup the scheduler with the FastAPI app."""
        self.app = app
        
        @app.on_event("startup")
        async def startup_scheduler():
            await self.start()
        
        @app.on_event("shutdown")
        async def shutdown_scheduler():
            await self.stop()
    
    async def start(self):
        """Start the scheduler."""
        if self.is_running:
            return
        
        self.is_running = True
        logger.info("Starting task scheduler")
        
        # Start all registered tasks
        for task_id, task_info in self.tasks.items():
            self._start_task(task_id, task_info)
    
    async def stop(self):
        """Stop the scheduler."""
        if not self.is_running:
            return
        
        self.is_running = False
        logger.info("Stopping task scheduler")
        
        # Cancel all running tasks
        for task_id, task_info in self.tasks.items():
            if "task" in task_info and task_info["task"] is not None:
                logger.debug(f"Cancelling task: {task_id}")
                task_info["task"].cancel()
    
    def _start_task(self, task_id: str, task_info: Dict[str, Any]):
        """Start a single task."""
        async def task_wrapper():
            while self.is_running:
                try:
                    logger.debug(f"Running scheduled task: {task_id}")
                    
                    # Create a database session for the task
                    async with SessionLocal() as session:
                        # Call the task function with session
                        if task_info.get("with_session", True):
                            await task_info["func"](session)
                        else:
                            await task_info["func"]()
                    
                    logger.debug(f"Task completed: {task_id}")
                except asyncio.CancelledError:
                    logger.debug(f"Task cancelled: {task_id}")
                    break
                except Exception as e:
                    logger.error(f"Error in scheduled task {task_id}: {e}")
                
                # Sleep until next execution
                await asyncio.sleep(task_info["interval"])
        
        # Create and store the task
        task = asyncio.create_task(task_wrapper())
        self.tasks[task_id]["task"] = task
    
    def add_task(
        self, 
        task_id: str, 
        func: Callable[..., Awaitable[Any]], 
        interval: int, 
        with_session: bool = True
    ):
        """Add a new task to the scheduler.
        
        Args:
            task_id: Unique identifier for the task
            func: Async function to call
            interval: Time between executions in seconds
            with_session: Whether to provide a DB session to the function
        """
        if task_id in self.tasks:
            logger.warning(f"Task with ID {task_id} already exists, replacing")
            if self.is_running and "task" in self.tasks[task_id]:
                self.tasks[task_id]["task"].cancel()
        
        self.tasks[task_id] = {
            "func": func,
            "interval": interval,
            "with_session": with_session,
            "task": None,
        }
        
        logger.info(f"Task added: {task_id} (interval: {interval}s)")
        
        # If scheduler is already running, start the task immediately
        if self.is_running:
            self._start_task(task_id, self.tasks[task_id])


# Create global scheduler instance
scheduler = TaskScheduler() 