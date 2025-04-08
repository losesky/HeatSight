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
        
        logger.info("⚡ 任务调度器设置完成")
    
    async def start(self):
        """Start the scheduler."""
        if self.is_running:
            return
        
        self.is_running = True
        logger.info("🚀 启动任务调度器")
        
        # Start all registered tasks
        task_count = len(self.tasks)
        if task_count > 0:
            logger.info(f"📋 发现 {task_count} 个待启动任务")
        
        for task_id, task_info in self.tasks.items():
            try:
                self._start_task(task_id, task_info)
                logger.info(f"✅ 任务启动成功: {task_id}")
            except Exception as e:
                logger.error(f"❌ 任务启动失败 [{task_id}]: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
    
    async def stop(self):
        """Stop the scheduler."""
        if not self.is_running:
            return
        
        self.is_running = False
        logger.info("🛑 停止任务调度器")
        
        # Cancel all running tasks
        task_count = len(self.tasks)
        if task_count > 0:
            logger.info(f"📋 发现 {task_count} 个运行中的任务")
        
        for task_id, task_info in self.tasks.items():
            if "task" in task_info and task_info["task"] is not None:
                try:
                    task_info["task"].cancel()
                    logger.info(f"✅ 任务已停止: {task_id}")
                except Exception as e:
                    logger.error(f"❌ 任务停止失败 [{task_id}]: {str(e)}")
    
    def _start_task(self, task_id: str, task_info: Dict[str, Any]):
        """Start a single task."""
        async def task_wrapper():
            while self.is_running:
                try:
                    start_time = time.time()
                    logger.info(f"▶️ 开始执行任务: {task_id}")
                    
                    success = True
                    error_msg = None
                    
                    # 创建一个任务保护，避免任务执行时间过长
                    async def protected_task_execution():
                        # Create a database session for the task
                        async with SessionLocal() as session:
                            try:
                                # Call the task function with session
                                if task_info.get("with_session", True):
                                    await task_info["func"](session)
                                else:
                                    await task_info["func"]()
                                    
                                # 如果任务成功执行而没有显式提交事务，我们在这里提交
                                if task_info.get("auto_commit", True) and task_info.get("with_session", True):
                                    if not session.is_active:
                                        logger.debug(f"会话已关闭，跳过提交 [{task_id}]")
                                    else:
                                        await session.commit()
                            except Exception as e:
                                # 在出现异常时回滚会话
                                if task_info.get("with_session", True) and session.is_active:
                                    await session.rollback()
                                    logger.warning(f"❌ 任务执行出错，已回滚事务 [{task_id}]")
                                raise
                                
                    try:
                        # 设置任务执行的最大时间，防止任务无限期执行
                        max_execution_time = task_info.get("max_execution_time", 300)  # 默认5分钟
                        await asyncio.wait_for(protected_task_execution(), timeout=max_execution_time)
                    except asyncio.TimeoutError:
                        success = False
                        error_msg = f"任务执行超过最大允许时间 {max_execution_time} 秒"
                        logger.error(f"⏱️ {error_msg} [{task_id}]")
                    except Exception as e:
                        success = False
                        error_msg = str(e)
                        raise
                    
                    # 任务完成后记录
                    duration = time.time() - start_time
                    if success:
                        logger.info(f"✅ 任务执行完成 [{task_id}] - 耗时: {duration:.2f}秒")
                    else:
                        logger.error(f"❌ 任务执行失败 [{task_id}] - {error_msg}")
                        
                except asyncio.CancelledError:
                    logger.info(f"🛑 任务已取消: {task_id}")
                    break
                except Exception as e:
                    logger.error(f"❌ 任务执行出错 [{task_id}]: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                # Sleep until next execution
                next_run = datetime.now() + timedelta(seconds=task_info["interval"])
                logger.info(f"⏰ 下次执行时间 [{task_id}]: {next_run.strftime('%Y-%m-%d %H:%M:%S')}")
                try:
                    await asyncio.sleep(task_info["interval"])
                except asyncio.CancelledError:
                    logger.debug(f"任务休眠被中断 [{task_id}]")
                    break
        
        # Create and store the task
        loop = asyncio.get_event_loop()
        task = loop.create_task(task_wrapper())
        self.tasks[task_id]["task"] = task
    
    def add_task(
        self, 
        task_id: str, 
        func: Callable[..., Awaitable[Any]], 
        interval: int, 
        with_session: bool = True,
        auto_commit: bool = True,
        max_execution_time: Optional[int] = 300  # 添加参数，默认5分钟
    ):
        """Add a new task to the scheduler."""
        if task_id in self.tasks:
            if self.is_running and "task" in self.tasks[task_id]:
                self.tasks[task_id]["task"].cancel()
        
        self.tasks[task_id] = {
            "func": func,
            "interval": interval,
            "with_session": with_session,
            "auto_commit": auto_commit,
            "max_execution_time": max_execution_time,
            "task": None,
        }
        
        logger.info(f"📝 任务已注册 [{task_id}] - 执行间隔: {interval}秒, 最大执行时间: {max_execution_time}秒")
        
        # If scheduler is already running, start the task immediately
        if self.is_running:
            self._start_task(task_id, self.tasks[task_id])


# Create global scheduler instance
scheduler = TaskScheduler() 