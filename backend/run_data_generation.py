#!/usr/bin/env python3
"""
包装脚本，确保使用正确的依赖运行数据生成
"""
import sys
import subprocess
import importlib.util
import os

def check_asyncpg():
    """检查是否已安装asyncpg"""
    try:
        import asyncpg
        print(f"✓ asyncpg已安装 (版本: {asyncpg.__version__})")
        return True
    except ImportError:
        print("✗ asyncpg未安装，正在安装...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "asyncpg"])
        return False

def check_sqlalchemy():
    """检查SQLAlchemy版本"""
    try:
        import sqlalchemy
        from sqlalchemy.ext.asyncio import AsyncSession
        print(f"✓ SQLAlchemy已安装 (版本: {sqlalchemy.__version__})")
        return True
    except (ImportError, AttributeError):
        print("✗ SQLAlchemy版本不兼容，正在更新...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "sqlalchemy[asyncio]"])
        return False

def verify_env_file():
    """验证.env文件中的数据库URL配置"""
    env_file = ".env"
    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            content = f.read()
        
        if "postgresql://" in content and "postgresql+asyncpg://" not in content:
            print("✗ 发现不兼容的数据库URL配置，正在修复...")
            content = content.replace("postgresql://", "postgresql+asyncpg://")
            with open(env_file, "w") as f:
                f.write(content)
            print("✓ 数据库URL已更新")
        else:
            print("✓ 数据库URL配置正确")
    else:
        print("! 找不到.env文件，请确保数据库配置正确")

def run_data_generator():
    """运行数据生成器"""
    print("\n运行数据生成器...")
    try:
        result = subprocess.run([sys.executable, "test_generate_data.py"], 
                               check=True, capture_output=True, text=True)
        print(result.stdout)
        print("✓ 数据生成成功!")
        return True
    except subprocess.CalledProcessError as e:
        print("✗ 数据生成失败!")
        print("错误输出:")
        print(e.stdout)
        print(e.stderr)
        return False

if __name__ == "__main__":
    print("=== HeatSight数据生成修复工具 ===")
    
    # 检查依赖
    check_asyncpg()
    check_sqlalchemy()
    verify_env_file()
    
    # 运行数据生成器
    success = run_data_generator()
    sys.exit(0 if success else 1)
