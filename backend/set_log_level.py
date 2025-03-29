#!/usr/bin/env python3
"""
设置HeatSight日志级别和调试模式的工具脚本

使用方法:
    python set_log_level.py [info|debug] [--debug-mode on|off]
"""

import sys
import os
import re
from typing import Optional, Dict, Tuple


def update_env_file(env_file_path: str, updates: Dict[str, str]) -> Tuple[bool, str]:
    """更新.env文件中的环境变量
    
    Args:
        env_file_path: .env文件路径
        updates: 要更新的环境变量字典
        
    Returns:
        (成功与否, 消息)
    """
    # 检查文件是否存在
    if not os.path.exists(env_file_path):
        return False, f"错误: .env文件不存在: {env_file_path}"
    
    try:
        # 读取现有.env文件
        with open(env_file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # 确保文件以换行符结束
        if content and not content.endswith('\n'):
            content += '\n'
            
        # 将文件内容分割为行
        lines = content.splitlines(True)  # 保留换行符
        
        # 处理每个要更新的环境变量
        updated_vars = set()
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            for key, value in updates.items():
                # 匹配形如 KEY=value 的行
                pattern = re.compile(fr"^{key}=.*$")
                if pattern.match(line_stripped):
                    # 确保行以换行符结束
                    lines[i] = f"{key}={value}\n"
                    updated_vars.add(key)
                    break
        
        # 添加未找到的环境变量
        for key, value in updates.items():
            if key not in updated_vars:
                # 确保添加新行时包含换行符
                lines.append(f"{key}={value}\n")
        
        # 写回文件
        with open(env_file_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        
        return True, f"成功更新环境变量: {', '.join(updates.keys())}"
    
    except Exception as e:
        return False, f"更新环境变量失败: {str(e)}"


def set_log_level(level: str = "info", debug_mode: Optional[str] = None) -> Tuple[bool, str]:
    """设置日志级别和调试模式
    
    Args:
        level: 日志级别 (info 或 debug)
        debug_mode: 调试模式 (on 或 off)
        
    Returns:
        (成功与否, 消息)
    """
    # 验证参数
    if level.lower() not in ["info", "debug"]:
        return False, f"错误: 无效的日志级别 '{level}'. 使用 'info' 或 'debug'"
    
    if debug_mode is not None and debug_mode.lower() not in ["on", "off"]:
        return False, f"错误: 无效的调试模式 '{debug_mode}'. 使用 'on' 或 'off'"
    
    # 构建要更新的环境变量
    updates = {"LOG_LEVEL": level.upper()}
    
    if debug_mode is not None:
        debug_value = "1" if debug_mode.lower() == "on" else "0"
        updates["DEBUG"] = debug_value
    
    # 获取.env文件路径 (假设脚本在backend目录)
    env_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    
    # 更新.env文件
    success, message = update_env_file(env_file_path, updates)
    
    if success:
        settings_msg = f"日志级别设置为: {level.upper()}"
        if debug_mode is not None:
            debug_status = "启用" if debug_mode.lower() == "on" else "禁用"
            settings_msg += f", 调试模式: {debug_status}"
        
        return True, f"{settings_msg}\n重启应用后生效"
    else:
        return False, message


def print_help():
    """打印帮助信息"""
    print("设置HeatSight日志级别和调试模式")
    print("\n用法:")
    print("  python set_log_level.py [info|debug] [--debug-mode on|off]")
    print("\n选项:")
    print("  info|debug      设置日志级别 (默认: info)")
    print("  --debug-mode    设置调试模式 (on 或 off)")
    print("\n示例:")
    print("  python set_log_level.py debug --debug-mode on   # 启用详细日志和调试模式")
    print("  python set_log_level.py info --debug-mode off   # 恢复正常日志级别并关闭调试模式")
    print("  python set_log_level.py debug                   # 只更改日志级别为详细")


if __name__ == "__main__":
    # 解析命令行参数
    args = sys.argv[1:]
    
    if "--help" in args or "-h" in args:
        print_help()
        sys.exit(0)
    
    level = "info"  # 默认日志级别
    debug_mode = None
    
    # 处理位置参数和选项
    i = 0
    while i < len(args):
        if args[i] in ["info", "debug"]:
            level = args[i]
        elif args[i] == "--debug-mode" and i + 1 < len(args):
            debug_mode = args[i+1]
            i += 1  # 跳过下一个参数
        elif args[i].startswith("--debug-mode="):
            debug_mode = args[i].split("=", 1)[1]
        else:
            print(f"错误: 未知参数 '{args[i]}'")
            print_help()
            sys.exit(1)
        i += 1
    
    # 设置日志级别和调试模式
    success, message = set_log_level(level, debug_mode)
    
    if success:
        print(message)
        sys.exit(0)
    else:
        print(message)
        sys.exit(1) 