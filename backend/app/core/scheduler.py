import asyncio
from datetime import datetime, timedelta
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
                    start_time = time.time()
                    logger.info(f"[计划任务] 开始执行: {task_id}")
                    
                    success = True
                    error_msg = None
                    
                    # Create a database session for the task
                    async with SessionLocal() as session:
                        try:
                            # Call the task function with session
                            if task_info.get("with_session", True):
                                await task_info["func"](session)
                            else:
                                await task_info["func"]()
                                
                            # 如果任务成功执行而没有显式提交事务，我们在这里提交
                            # 这只是一个额外的保险，理想情况下任务应该自己管理事务
                            if task_info.get("auto_commit", True) and task_info.get("with_session", True):
                                if not session.is_active:
                                    logger.debug(f"任务 {task_id} 会话已关闭，无需提交")
                                else:
                                    logger.debug(f"为任务 {task_id} 自动提交事务")
                                    await session.commit()
                                    
                        except Exception as e:
                            success = False
                            error_msg = str(e)
                            # 在出现异常时回滚会话
                            if task_info.get("with_session", True) and session.is_active:
                                await session.rollback()
                                logger.warning(f"任务 {task_id} 出错，已回滚事务")
                            # 重新抛出异常以便记录
                            raise
                    
                    # 任务完成后记录
                    duration = time.time() - start_time
                    if success:
                        logger.info(f"[计划任务] 完成: {task_id} (耗时: {duration:.2f}秒)")
                    else:
                        logger.error(f"[计划任务] 失败: {task_id} - {error_msg}")
                        
                except asyncio.CancelledError:
                    logger.info(f"[计划任务] 已取消: {task_id}")
                    break
                except Exception as e:
                    logger.error(f"[计划任务] 执行出错 {task_id}: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                # Sleep until next execution
                next_run = datetime.now() + timedelta(seconds=task_info["interval"])
                logger.info(f"[计划任务] {task_id} 下次执行时间: {next_run.strftime('%Y-%m-%d %H:%M:%S')}")
                await asyncio.sleep(task_info["interval"])
        
        # Create and store the task
        task = asyncio.create_task(task_wrapper())
        self.tasks[task_id]["task"] = task
    
    def add_task(
        self, 
        task_id: str, 
        func: Callable[..., Awaitable[Any]], 
        interval: int, 
        with_session: bool = True,
        auto_commit: bool = True
    ):
        """Add a new task to the scheduler.
        
        Args:
            task_id: Unique identifier for the task
            func: Async function to call
            interval: Time between executions in seconds
            with_session: Whether to provide a DB session to the function
            auto_commit: Whether to automatically commit the session after task completes
        """
        if task_id in self.tasks:
            logger.warning(f"Task with ID {task_id} already exists, replacing")
            if self.is_running and "task" in self.tasks[task_id]:
                self.tasks[task_id]["task"].cancel()
        
        self.tasks[task_id] = {
            "func": func,
            "interval": interval,
            "with_session": with_session,
            "auto_commit": auto_commit,
            "task": None,
        }
        
        logger.info(f"Task added: {task_id} (interval: {interval}s, auto_commit: {auto_commit})")
        
        # If scheduler is already running, start the task immediately
        if self.is_running:
            self._start_task(task_id, self.tasks[task_id])


# Create global scheduler instance
scheduler = TaskScheduler() 