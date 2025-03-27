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
    
    # 重新安装全部依赖
    echo -e "${BLUE}重新安装全部依赖...${NC}"
    pip install -r requirements.txt --upgrade
    
    # 检查特定依赖
    echo -e "${BLUE}检查关键依赖...${NC}"
    pip list | grep -E "pydantic|fastapi|uvicorn|sqlalchemy"
    
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

# 提供选项
echo -e "${YELLOW}选择要修复的部分:${NC}"
echo -e "1) ${GREEN}修复后端依赖${NC}"
echo -e "2) ${GREEN}修复前端依赖${NC}"
echo -e "3) ${GREEN}修复全部依赖${NC} (推荐)"
echo -ne "${YELLOW}请选择 [1-3] (默认: 3): ${NC}"

read -r choice

case $choice in
    1)
        fix_backend_deps
        ;;
    2)
        fix_frontend_deps
        ;;
    *)
        fix_backend_deps
        fix_frontend_deps
        ;;
esac

# 设置执行权限
chmod +x start-backend.sh start-frontend.sh start-heatsight.sh stop-heatsight.sh

echo -e "${GREEN}依赖修复完成！你现在可以使用 ./start-heatsight.sh 启动应用。${NC}" 