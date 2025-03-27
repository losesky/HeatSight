#!/bin/bash

# 前端启动脚本
# 用途: 启动HeatSight前端应用服务

# 彩色输出配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}            HeatSight Frontend Starter           ${NC}"
echo -e "${BLUE}=================================================${NC}"

# 环境变量设置
ENV_FILE=".env.local"

# 检查是否存在环境参数
if [ "$1" = "dev" ] || [ "$1" = "development" ]; then
    ENVIRONMENT="development"
    echo -e "${GREEN}使用开发环境配置${NC}"
elif [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    ENVIRONMENT="production"
    echo -e "${GREEN}使用生产环境配置${NC}"
else
    ENVIRONMENT="development"
    echo -e "${YELLOW}未指定环境，默认使用开发环境配置${NC}"
fi

# 检查自定义API地址
if [ -n "$2" ]; then
    CUSTOM_API_URL=$2
    echo -e "${GREEN}使用自定义API地址: ${CUSTOM_API_URL}${NC}"
    
    # 创建或更新本地环境变量文件
    echo "REACT_APP_API_BASE_URL=${CUSTOM_API_URL}" > ${ENV_FILE}
    echo -e "${GREEN}已创建本地环境变量文件: ${ENV_FILE}${NC}"
fi

# 加载NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 检查Node.js版本
NODE_VERSION=$(node -v 2>/dev/null)
REQUIRED_VERSION="v16.0.0"

if [ -z "$NODE_VERSION" ]; then
    echo -e "${RED}错误: Node.js未安装或未找到${NC}"
    echo -e "${YELLOW}尝试使用NVM安装Node.js...${NC}"
    
    if command -v nvm &> /dev/null; then
        nvm install 20.19.0
        nvm use 20.19.0
    else
        echo -e "${RED}NVM未安装，请手动安装Node.js v20.19.0或更高版本${NC}"
        exit 1
    fi
else
    # 简单版本比较，只检查主版本号
    CURRENT_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    REQUIRED_MAJOR=$(echo $REQUIRED_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    if [ "$CURRENT_MAJOR" -lt "$REQUIRED_MAJOR" ]; then
        echo -e "${YELLOW}Node.js版本 $NODE_VERSION 过低, 建议使用 $REQUIRED_VERSION 或更高版本${NC}"
        
        if command -v nvm &> /dev/null; then
            echo -e "${YELLOW}正在使用NVM切换到推荐的Node.js版本...${NC}"
            nvm install 20.19.0
            nvm use 20.19.0
        else
            echo -e "${YELLOW}继续使用当前版本，但可能存在兼容性问题${NC}"
        fi
    else
        echo -e "${GREEN}Node.js版本 $NODE_VERSION 符合要求${NC}"
    fi
fi

# 进入前端目录
cd frontend || exit

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}未检测到node_modules，正在安装依赖...${NC}"
    npm install
    echo -e "${GREEN}依赖安装完成!${NC}"
else
    echo -e "${GREEN}依赖已安装${NC}"
fi

# 获取当前环境变量
API_BASE_URL=$(grep REACT_APP_API_BASE_URL .env.${ENVIRONMENT} 2>/dev/null | cut -d '=' -f2)
if [ -z "$API_BASE_URL" ]; then
    API_BASE_URL=$(grep REACT_APP_API_BASE_URL .env 2>/dev/null | cut -d '=' -f2)
fi
if [ -z "$API_BASE_URL" ]; then
    API_BASE_URL="http://localhost:8080/api"
fi

# 显示配置信息
echo -e "${BLUE}配置信息:${NC}"
echo -e "环境: ${GREEN}${ENVIRONMENT}${NC}"
echo -e "前端地址: ${GREEN}http://localhost:3000${NC}"
echo -e "API地址: ${GREEN}${API_BASE_URL}${NC}"

# 提供启动选项
echo -e "${YELLOW}选择启动模式:${NC}"
echo -e "1) ${GREEN}开发模式${NC} (react-scripts start, 热重载)"
echo -e "2) ${GREEN}服务器模式${NC} (自定义Express服务器)"
echo -e "3) ${GREEN}构建并启动${NC} (构建生产版本并运行)"
echo -ne "${YELLOW}请选择 [1-3] (默认: 1): ${NC}"

read -r choice

case $choice in
    2)
        echo -e "${BLUE}以服务器模式启动...${NC}"
        npm run serve
        ;;
    3)
        echo -e "${BLUE}构建并启动应用...${NC}"
        # 设置生产环境变量
        export NODE_ENV=production
        npm run build:serve
        ;;
    *)
        echo -e "${BLUE}以开发模式启动...${NC}"
        # 设置开发环境变量
        export NODE_ENV=development
        npm run start
        ;;
esac

# 脚本不应该执行到这里，因为上面的命令会持续运行
echo -e "${RED}前端服务已停止${NC}" 