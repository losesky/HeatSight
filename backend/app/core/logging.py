import logging
import sys
import os
import re
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


class AdvancedSQLAlchemyFilter(logging.Filter):
    """增强的SQLAlchemy日志过滤器，彻底解决无意义参数显示问题"""
    
    def __init__(self):
        super().__init__()
        # 保存上一条SQL语句，用于判断是否为参数日志
        self.last_sql = None
        # 用于匹配含有大量参数的SQL语句的正则表达式
        self.param_sql_pattern = re.compile(r'.*\([^)]+(\,\s*[^)]+){10,}\).*')
        # 用于匹配SQL参数日志的模式
        self.params_pattern = re.compile(r'^\(.*\)$')
        # 用于匹配cached日志的模式
        self.cached_pattern = re.compile(r'.*\[cached since.*\].*')
    
    def filter(self, record):
        if not hasattr(record, 'msg') or not isinstance(record.msg, str):
            return True
            
        msg = record.msg.strip()
        
        # 1. 完全过滤掉参数日志
        if self.params_pattern.match(msg) or "[cached" in msg:
            return False
            
        # 2. 处理SQL语句 - 简化长SQL
        if msg.startswith('SELECT') or msg.startswith('INSERT') or msg.startswith('UPDATE') or msg.startswith('DELETE'):
            # 保存当前SQL用于后续判断
            self.last_sql = msg
            
            # 检测是否为含有大量参数的SQL
            if self.param_sql_pattern.match(msg):
                # 只显示SQL的操作类型和表名部分
                parts = msg.split(' ')
                if len(parts) > 3:
                    # 找到FROM或INTO关键词的位置
                    from_index = -1
                    for i, part in enumerate(parts):
                        if part.upper() in ('FROM', 'INTO', 'UPDATE'):
                            from_index = i
                            break
                    
                    if from_index > 0 and from_index + 1 < len(parts):
                        table_name = parts[from_index + 1].strip(',;()')
                        record.msg = f"{parts[0]} ... {parts[from_index]} {table_name} ... [查询包含大量参数，已简化显示]"
                    else:
                        record.msg = f"{parts[0]} ... [查询包含大量参数，已简化显示]"
                else:
                    record.msg = f"{parts[0]} ... [查询包含大量参数，已简化显示]"
            elif len(msg) > 100:  # 简化长SQL但不是参数SQL
                parts = msg.split(' ')
                action = parts[0]
                record.msg = f"{action} ... [SQL语句已简化，长度{len(msg)}字符]"
        
        # 3. 简化处理COMMIT和ROLLBACK日志
        elif msg in ('COMMIT', 'ROLLBACK', 'BEGIN'):
            record.msg = f"数据库事务: {msg}"
        
        return True


def setup_logging() -> None:
    """设置日志配置"""
    # 配置loguru
    logger.remove()  # 移除默认处理器
    
    # 创建日志目录
    os.makedirs(settings.LOG_DIR, exist_ok=True)
    
    # 定义统一的日志格式
    CONSOLE_FORMAT = "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>"
    FILE_FORMAT = "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}"
    
    # 添加控制台处理器，使用更简洁的格式，只显示重要信息
    logger.add(
        sys.stderr,
        format=CONSOLE_FORMAT,
        level="INFO",  # 控制台使用INFO级别
        colorize=True,
        filter=lambda record: (
            # 排除详细的过程日志
            not any(keyword in record["message"].lower() for keyword in [
                "request was redirected",
                "making request",
                "processing batch",
                "created database session",
                "prefix dict",
                "loading model",
                "building prefix dict",
                "loading model from cache",
                "loading model cost",
                "prefix dict has been built",
                "taskscheduler initialized"
            ]) and
            # 保留重要的系统状态和任务信息
            (record["level"].no >= logger.level("INFO").no and
             (any(keyword in record["message"] for keyword in [
                 "启动",
                 "停止",
                 "错误",
                 "失败",
                 "完成",
                 "初始化完成",
                 "计划任务",
                 "注册任务"
             ]) or
              # 显示任务调度器的重要信息
              (record["name"].startswith("app.core.scheduler") and
               any(keyword in record["message"].lower() for keyword in [
                   "task scheduler",
                   "registered",
                   "started",
                   "completed"
               ])) or
              # 显示任务执行的重要信息
              (record["name"].startswith("app.core.tasks") and
               any(keyword in record["message"] for keyword in [
                   "开始执行",
                   "完成",
                   "更新完成",
                   "已更新"
               ]))
             ))
        )
    )
    
    # 主应用日志文件 - 包含所有日志
    app_log_file = os.path.join(settings.LOG_DIR, "app.log")
    logger.add(
        app_log_file,
        rotation="10 MB",
        retention="1 week",
        format=FILE_FORMAT,
        level="INFO"
    )
    
    # API请求日志文件
    api_log_file = os.path.join(settings.LOG_DIR, "api.log")
    logger.add(
        api_log_file,
        rotation="10 MB",
        retention="1 week",
        format=FILE_FORMAT,
        level="DEBUG",
        filter=lambda record: (
            record["name"].startswith("app.services.heatlink_client") or
            "request" in record["message"].lower()
        )
    )
    
    # 调度器日志文件
    scheduler_log_file = os.path.join(settings.LOG_DIR, "scheduler.log")
    logger.add(
        scheduler_log_file,
        rotation="10 MB",
        retention="1 week",
        format=FILE_FORMAT,
        level="DEBUG",
        filter=lambda record: (
            record["name"].startswith("app.core.scheduler") or
            record["name"].startswith("app.core.tasks") or
            "计划任务" in record["message"] or
            "task scheduler" in record["message"].lower()
        )
    )
    
    # 任务执行日志文件
    task_log_file = os.path.join(settings.LOG_DIR, "tasks.log")
    logger.add(
        task_log_file,
        rotation="10 MB",
        retention="1 week",
        format=FILE_FORMAT,
        level="INFO",
        filter=lambda record: (
            "计划任务" in record["message"] or
            record["extra"].get("task", False) or
            record["name"].startswith("app.services.news_heat_score_service")
        )
    )
    
    # 错误日志文件
    error_log_file = os.path.join(settings.LOG_DIR, "error.log")
    logger.add(
        error_log_file,
        rotation="10 MB",
        retention="1 month",  # 错误日志保留更长时间
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | ERROR | {message}\n{exception}",
        level="ERROR",
        backtrace=True,
        diagnose=True
    )
    
    logger.info("日志系统已配置完成") 