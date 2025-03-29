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
    
    # 添加控制台处理器，使用更简洁的格式
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        level="INFO",
        colorize=True,
    )
    
    # 添加文件处理器
    log_file = os.path.join(settings.LOG_DIR, f"{settings.APP_NAME.lower()}.log")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    logger.add(
        log_file,
        rotation="10 MB",
        retention="1 week",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
        level="INFO",
    )
    
    # 为任务模块设置单独的日志级别（确保任务执行信息始终可见）
    # 添加任务专用的日志处理器，即使在非调试模式也显示任务执行情况
    if not settings.DEBUG:
        logger.add(
            sys.stderr,
            format="<yellow>任务</yellow> | <green>{time:HH:mm:ss}</green> | <level>{message}</level>",
            level="INFO",
            colorize=True,
            filter=lambda record: (
                record["name"].startswith("app.core.tasks") or 
                record["name"].startswith("app.core.scheduler") or
                "定时任务" in record["message"]
            )
        )
    
    # 配置SQLAlchemy的日志过滤
    sql_logger = logging.getLogger("sqlalchemy.engine")
    
    # 移除所有现有处理器
    for handler in sql_logger.handlers[:]:
        sql_logger.removeHandler(handler)
    
    # 添加自定义过滤器
    sql_filter = AdvancedSQLAlchemyFilter()
    
    # 设置SQLAlchemy日志级别
    if settings.DEBUG:
        # 在调试模式下显示SQL语句，但使用增强的过滤
        sql_logger.setLevel(logging.INFO)
        
        # 配置SQL日志处理器
        sql_handler = logging.StreamHandler()
        sql_handler.setFormatter(logging.Formatter("SQL | {levelname} | {message}", style="{"))
        sql_handler.addFilter(sql_filter)
        sql_logger.addHandler(sql_handler)
    else:
        # 在非调试模式下，只记录警告和错误
        sql_logger.setLevel(logging.WARNING)
    
    # 配置其他库的日志级别
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"]:
        logging_logger = logging.getLogger(logger_name)
        # 移除所有现有处理器
        for handler in logging_logger.handlers[:]:
            logging_logger.removeHandler(handler)
        # 添加拦截处理器
        logging_logger.addHandler(InterceptHandler())
        logging_logger.propagate = False
    
    # 配置第三方库的日志级别
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    # Log when logging has been set up
    logger.info("日志系统已配置完成") 