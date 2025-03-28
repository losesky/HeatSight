#!/bin/bash

# 依赖修复脚本
# 用途: 修复HeatSight项目的依赖问题

# 彩色输出配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}          HeatSight Dependency Fixer             ${NC}"
echo -e "${BLUE}=================================================${NC}"

# 修复后端依赖
fix_backend_deps() {
    echo -e "${BLUE}修复后端依赖...${NC}"
    
    # 检查虚拟环境是否存在
    if [ ! -d "backend/venv" ]; then
        echo -e "${YELLOW}创建新的虚拟环境...${NC}"
        cd backend || exit
        python3 -m venv venv
        cd ..
    fi
    
    # 激活虚拟环境
    cd backend || exit
    source venv/bin/activate
    
    # 升级pip
    echo -e "${BLUE}升级pip...${NC}"
    pip install --upgrade pip
    
    # 安装和更新关键依赖
    echo -e "${BLUE}安装关键依赖...${NC}"
    pip install --upgrade pydantic pydantic-settings fastapi uvicorn 
    
    # 特别重点：安装异步数据库驱动
    echo -e "${YELLOW}安装并更新异步数据库驱动...${NC}"
    pip install --upgrade asyncpg
    pip install --upgrade sqlalchemy[asyncio]
    
    # 重新安装全部依赖
    echo -e "${BLUE}重新安装全部依赖...${NC}"
    pip install -r requirements.txt --upgrade
    
    # 检查特定依赖
    echo -e "${BLUE}检查关键依赖...${NC}"
    pip list | grep -E "pydantic|fastapi|uvicorn|sqlalchemy|asyncpg"
    
    # 修复数据库URL配置
    echo -e "${YELLOW}检查并修复数据库URL配置...${NC}"
    if [ -f ".env" ]; then
        # 备份原始.env文件
        cp .env .env.backup.$(date +%Y%m%d%H%M%S)
        
        # 使用sed替换数据库URL
        if grep -q "DATABASE_URL=postgresql://" .env && ! grep -q "DATABASE_URL=postgresql+asyncpg://" .env; then
            echo -e "${GREEN}将数据库URL从postgresql://更新为postgresql+asyncpg://...${NC}"
            sed -i 's|DATABASE_URL=postgresql://|DATABASE_URL=postgresql+asyncpg://|g' .env
        fi
        
        if grep -q "TEST_DATABASE_URL=postgresql://" .env && ! grep -q "TEST_DATABASE_URL=postgresql+asyncpg://" .env; then
            echo -e "${GREEN}将测试数据库URL从postgresql://更新为postgresql+asyncpg://...${NC}"
            sed -i 's|TEST_DATABASE_URL=postgresql://|TEST_DATABASE_URL=postgresql+asyncpg://|g' .env
        fi
        
        echo -e "${GREEN}数据库URL配置已更新${NC}"
    else
        echo -e "${RED}警告: 未找到.env文件，请手动创建并配置数据库URL${NC}"
    fi
    
    echo -e "${GREEN}后端依赖修复完成${NC}"
    deactivate
    cd ..
}

# 修复前端依赖
fix_frontend_deps() {
    echo -e "${BLUE}修复前端依赖...${NC}"
    
    # 加载NVM
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # 确保使用合适的Node.js版本
    if command -v nvm &> /dev/null; then
        echo -e "${BLUE}切换到Node.js v20.19.0...${NC}"
        nvm use 20.19.0 || nvm install 20.19.0
    fi
    
    cd frontend || exit
    
    # 修复package-lock.json和node_modules冲突
    if [ -f "package-lock.json" ] && [ -d "node_modules" ]; then
        echo -e "${YELLOW}检测到潜在的依赖冲突，进行修复...${NC}"
        rm -rf node_modules
        npm cache clean --force
    fi
    
    # 安装依赖
    echo -e "${BLUE}安装前端依赖...${NC}"
    npm install
    
    # 更新http-proxy-middleware
    if npm list http-proxy-middleware | grep -q "UNMET"; then
        echo -e "${YELLOW}修复http-proxy-middleware...${NC}"
        npm uninstall http-proxy-middleware
        npm install http-proxy-middleware@3.0.3 --save
    fi
    
    echo -e "${GREEN}前端依赖修复完成${NC}"
    cd ..
}

# 测试数据库连接
test_database_connection() {
    echo -e "${BLUE}测试数据库连接...${NC}"
    cd backend || exit
    source venv/bin/activate
    
    # 创建测试脚本
    cat > test_db_connection.py << 'EOF'
#!/usr/bin/env python3
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

from app.core.config import settings

async def test_connection():
    try:
        print(f"测试连接到: {settings.DATABASE_URL}")
        # 创建异步引擎
        engine = create_async_engine(settings.DATABASE_URL)
        # 测试连接
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print("数据库连接成功!")
            return True
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)
EOF
    
    # 运行测试脚本
    python3 test_db_connection.py
    result=$?
    
    # 清理测试脚本
    rm test_db_connection.py
    
    deactivate
    cd ..
    
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}数据库连接测试成功${NC}"
    else
        echo -e "${RED}数据库连接测试失败，请检查配置${NC}"
    fi
    
    return $result
}

# 修复HeatLink API客户端URL错误
fix_heatlink_api_url() {
    echo -e "${BLUE}检查HeatLink API客户端URL处理方式...${NC}"
    
    # 确保我们在正确的目录中
    cd "$(dirname "$0")" || exit
    
    # 使用绝对路径
    BACKEND_DIR="$(pwd)/backend"
    if [ ! -d "$BACKEND_DIR" ]; then
        echo -e "${RED}错误：找不到backend目录: $BACKEND_DIR${NC}"
        return 1
    fi
    
    cd "$BACKEND_DIR" || exit
    
    # 查找HeatLink客户端实现文件
    HEATLINK_CLIENT_FILE=$(find . -type f -path "*/app/services/heatlink_client.py")
    
    if [ -n "$HEATLINK_CLIENT_FILE" ]; then
        echo -e "${GREEN}找到HeatLink客户端文件: $HEATLINK_CLIENT_FILE${NC}"
        
        # 备份原始文件
        cp "$HEATLINK_CLIENT_FILE" "${HEATLINK_CLIENT_FILE}.backup.$(date +%Y%m%d%H%M%S)"
        
        # 检查是否已有URL重复检测代码
        if grep -q "'/api/api/'" "$HEATLINK_CLIENT_FILE" && grep -q "replace.*'/api/'" "$HEATLINK_CLIENT_FILE"; then
            echo -e "${GREEN}HeatLink客户端已包含URL重复检测代码，无需修改${NC}"
        else
            echo -e "${YELLOW}添加URL重复检测代码...${NC}"
            
            # 使用sed查找_make_request方法中构建URL的行并在其后添加URL重复检测代码
            URL_LINE=$(grep -n "url = f\"{self.base_url}" "$HEATLINK_CLIENT_FILE" | head -1 | cut -d: -f1)
            
            if [ -n "$URL_LINE" ]; then
                URL_LINE=$((URL_LINE + 1))
                sed -i "${URL_LINE}i\\        # 检测并修复潜在的URL路径重复问题\\n        if '/api/api/' in url:\\n            # 去除重复的'/api/'\\n            url = url.replace('/api/api/', '/api/')\\n            logger.warning(f\"Detected and fixed duplicated API path in URL: {url}\")" "$HEATLINK_CLIENT_FILE"
                echo -e "${GREEN}成功添加URL重复检测代码${NC}"
            else
                echo -e "${RED}无法找到URL构建行，请手动检查文件${NC}"
            fi
        fi
        
        echo -e "${GREEN}HeatLink API客户端URL处理修复完成${NC}"
        echo -e "${YELLOW}注意：.env中的HEATLINK_API_URL配置保持不变${NC}"
    else
        echo -e "${RED}未找到HeatLink客户端实现文件${NC}"
    fi
    
    # 返回原始目录
    cd "$(dirname "$0")" || exit
}

# 修复数据生成脚本
fix_data_generation() {
    echo -e "${BLUE}修复数据生成脚本...${NC}"
    cd backend || exit
    
    # 1. 确保安装了asyncpg
    echo -e "${YELLOW}确保安装了异步数据库驱动...${NC}"
    pip install asyncpg
    
    # 2. 检查数据库URL配置
    if [ -f ".env" ]; then
        if grep -q "DATABASE_URL=postgresql://" .env && ! grep -q "DATABASE_URL=postgresql+asyncpg://" .env; then
            echo -e "${GREEN}修复数据库URL配置...${NC}"
            sed -i 's|DATABASE_URL=postgresql://|DATABASE_URL=postgresql+asyncpg://|g' .env
            sed -i 's|TEST_DATABASE_URL=postgresql://|TEST_DATABASE_URL=postgresql+asyncpg://|g' .env
        fi
    fi
    
    # 3. 修复HeatLink API URL问题
    fix_heatlink_api_url
    
    # 4. 创建一个包装脚本来运行test_generate_data.py
    echo -e "${YELLOW}创建包装脚本来运行数据生成...${NC}"
    cat > run_data_generation.py << 'EOF'
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
EOF
    
    # 4. 运行包装脚本
    echo -e "${GREEN}运行数据生成包装脚本...${NC}"
    python3 run_data_generation.py
    result=$?
    
    # 5. 保留包装脚本
    chmod +x run_data_generation.py
    echo -e "${BLUE}已创建便捷脚本 run_data_generation.py 用于后续数据生成${NC}"
    
    cd ..
    
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}数据生成测试成功${NC}"
    else
        echo -e "${RED}数据生成测试失败，请检查脚本输出${NC}"
    fi
    
    return $result
}

# 提供选项
echo -e "${YELLOW}选择要修复的部分:${NC}"
echo -e "1) ${GREEN}修复后端依赖${NC}"
echo -e "2) ${GREEN}修复前端依赖${NC}"
echo -e "3) ${GREEN}修复全部依赖${NC} (推荐)"
echo -e "4) ${GREEN}只修复数据库连接问题${NC}"
echo -e "5) ${GREEN}修复数据生成脚本和API URL${NC}"
echo -ne "${YELLOW}请选择 [1-5] (默认: 3): ${NC}"

read -r choice

case $choice in
    1)
        fix_backend_deps
        ;;
    2)
        fix_frontend_deps
        ;;
    4)
        cd backend || exit
        echo -e "${YELLOW}仅修复数据库连接问题...${NC}"
        
        # 检查并安装asyncpg
        if ! pip list | grep -q "asyncpg"; then
            echo -e "${BLUE}安装asyncpg...${NC}"
            pip install asyncpg
        fi
        
        # 检查并更新SQLAlchemy
        echo -e "${BLUE}更新SQLAlchemy...${NC}"
        pip install --upgrade sqlalchemy[asyncio]
        
        # 修复数据库URL
        if [ -f ".env" ]; then
            if grep -q "DATABASE_URL=postgresql://" .env && ! grep -q "DATABASE_URL=postgresql+asyncpg://" .env; then
                echo -e "${GREEN}更新数据库URL...${NC}"
                sed -i 's|DATABASE_URL=postgresql://|DATABASE_URL=postgresql+asyncpg://|g' .env
                sed -i 's|TEST_DATABASE_URL=postgresql://|TEST_DATABASE_URL=postgresql+asyncpg://|g' .env
            fi
        fi
        
        cd ..
        test_database_connection
        ;;
    5)
        fix_data_generation
        ;;
    *)
        fix_backend_deps
        fix_frontend_deps
        test_database_connection
        ;;
esac

# 设置执行权限
chmod +x start-backend.sh start-frontend.sh start-heatsight.sh stop-heatsight.sh

echo -e "${GREEN}依赖修复完成！你现在可以使用 ./start-heatsight.sh 启动应用。${NC}" 