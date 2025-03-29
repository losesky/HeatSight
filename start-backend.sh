#!/bin/bash

# 后端启动脚本
# 用途: 启动HeatSight后端API服务

# 彩色输出配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}             HeatSight Backend Starter            ${NC}"
echo -e "${BLUE}=================================================${NC}"

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: Python3 未安装，请先安装Python3${NC}"
    exit 1
fi

# 检查数据库服务是否运行
echo -e "${YELLOW}检查数据库服务...${NC}"
POSTGRES_RUNNING=$(docker ps | grep postgres-local | wc -l)
REDIS_RUNNING=$(docker ps | grep redis-local | wc -l)

if [ "$POSTGRES_RUNNING" -eq 0 ] || [ "$REDIS_RUNNING" -eq 0 ]; then
    echo -e "${RED}警告: 数据库服务未完全启动${NC}"
    echo -e "${YELLOW}请先运行数据库服务:${NC}"
    echo -e "${BLUE}bash db-manager.sh${NC}"
    
    echo -e "\n${YELLOW}是否继续启动后端? (y/n)${NC}"
    read -r CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        echo -e "${RED}已取消后端启动${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}尝试继续启动后端，但可能会出现连接错误...${NC}"
else
    echo -e "${GREEN}数据库服务正在运行!${NC}"
fi

# 检查.env文件中的数据库配置
if [ -f ".env" ]; then
    # 提取数据库端口，使用更精确的匹配以避免匹配到TEST_DATABASE_URL
    DB_PORT=$(grep "^DATABASE_URL=" .env | grep -oE "localhost:[0-9]+" | cut -d: -f2 | head -1)
    REDIS_PORT=$(grep "^CELERY_BROKER_URL=" .env | grep -oE "localhost:[0-9]+" | cut -d: -f2 | head -1)
    
    # 确保端口变量不为空
    if [ -z "$DB_PORT" ]; then
        DB_PORT="未检测到"
    fi
    if [ -z "$REDIS_PORT" ]; then
        REDIS_PORT="未检测到"
    fi
    
    # 检查配置是否正确
    if [[ "$DB_PORT" != "5432" || "$REDIS_PORT" != "6379" ]]; then
        echo -e "${YELLOW}警告: .env文件中的数据库端口配置可能不正确${NC}"
        echo -e "当前配置: PostgreSQL端口=${BLUE}$DB_PORT${NC}, Redis端口=${BLUE}$REDIS_PORT${NC}"
        echo -e "期望配置: PostgreSQL端口=${GREEN}5432${NC}, Redis端口=${GREEN}6379${NC}"
        
        echo -e "\n${YELLOW}是否自动修复.env文件中的端口配置? (y/n)${NC}"
        read -r FIX_ENV
        if [[ $FIX_ENV =~ ^[Yy]$ ]]; then
            # 备份原始文件
            cp .env .env.backup
            
            # 更新端口信息
            sed -i 's/localhost:[0-9]\+/localhost:5432/g' .env
            sed -i 's/redis:\/\/localhost:[0-9]\+/redis:\/\/localhost:6379/g' .env
            
            echo -e "${GREEN}.env文件已更新${NC}"
        fi
    else
        echo -e "${GREEN}数据库配置正确!${NC}"
    fi
fi

# 检查虚拟环境是否存在
if [ ! -d "backend/venv" ]; then
    echo -e "${YELLOW}虚拟环境不存在，正在创建...${NC}"
    cd backend || exit
    python3 -m venv venv
    source venv/bin/activate
    
    # 升级pip
    echo -e "${BLUE}升级pip...${NC}"
    pip install --upgrade pip
    
    # 安装依赖
    echo -e "${BLUE}安装依赖...${NC}"
    pip install -r requirements.txt
    
    # 检查并安装pydantic_settings (如果缺少)
    if ! pip show pydantic-settings &> /dev/null; then
        echo -e "${YELLOW}安装pydantic-settings...${NC}"
        pip install pydantic-settings
    fi
    
    cd ..
    echo -e "${GREEN}虚拟环境创建并安装依赖成功!${NC}"
else
    echo -e "${GREEN}检测到虚拟环境${NC}"
    
    # 检查和更新关键依赖
    cd backend || exit
    source venv/bin/activate
    
    # 检查pydantic_settings是否已安装
    if ! pip show pydantic-settings &> /dev/null; then
        echo -e "${YELLOW}未检测到pydantic-settings，正在安装...${NC}"
        pip install pydantic-settings
    fi
    
    cd ..
fi

# 显示配置信息
echo -e "${BLUE}配置信息:${NC}"
echo -e "使用端口: ${GREEN}8080${NC}"
echo -e "API文档: ${GREEN}http://localhost:8080/api/docs${NC}"
echo -e "PostgreSQL: ${GREEN}localhost:5432${NC}"
echo -e "Redis: ${GREEN}localhost:6379${NC}"

# 激活虚拟环境并启动服务
echo -e "${YELLOW}启动后端服务...${NC}"
cd backend || exit
source venv/bin/activate

# 显示已安装的关键依赖版本
echo -e "${BLUE}已安装的关键依赖:${NC}"
pip list | grep -E "pydantic|fastapi|uvicorn"

# 启动服务
python main.py --reload --workers 1

# 脚本不应该执行到这里，因为上面的命令会持续运行
echo -e "${RED}后端服务已停止${NC}" 