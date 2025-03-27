#!/bin/bash

# HeatSight主启动脚本
# 用途: 同时启动数据库、前端和后端

# 彩色输出配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}              HeatSight Launcher                 ${NC}"
echo -e "${BLUE}=================================================${NC}"

# 确保脚本具有执行权限
chmod +x start-db-services.sh
chmod +x start-backend.sh
chmod +x start-frontend.sh
chmod +x fix-db-issue.sh
chmod +x init_db.sh

# 提供启动选项
echo -e "${YELLOW}选择启动模式:${NC}"
echo -e "1) ${GREEN}仅启动数据库服务${NC}"
echo -e "2) ${GREEN}仅启动后端${NC}"
echo -e "3) ${GREEN}仅启动前端${NC}"
echo -e "4) ${GREEN}同时启动数据库、前端和后端${NC} (推荐)"
echo -ne "${YELLOW}请选择 [1-4] (默认: 4): ${NC}"

read -r choice

case $choice in
    1)
        echo -e "${BLUE}启动数据库服务...${NC}"
        ./start-db-services.sh
        echo -e "${YELLOW}是否初始化数据库? (y/n)${NC}"
        read -r INIT_DB
        if [[ $INIT_DB =~ ^[Yy]$ ]]; then
            ./init_db.sh
        fi
        ;;
    2)
        echo -e "${BLUE}检查数据库服务状态后启动后端...${NC}"
        ./start-backend.sh
        ;;
    3)
        echo -e "${BLUE}启动前端服务...${NC}"
        ./start-frontend.sh
        ;;
    *)
        echo -e "${BLUE}完整启动所有服务...${NC}"
        
        # 先启动数据库服务
        echo -e "${YELLOW}第一步: 启动数据库服务...${NC}"
        ./start-db-services.sh
        
        echo -e "\n${YELLOW}第二步: 初始化数据库 (如果需要)...${NC}"
        echo -e "${YELLOW}是否初始化数据库? (y/n)${NC}"
        read -r INIT_DB
        if [[ $INIT_DB =~ ^[Yy]$ ]]; then
            ./init_db.sh
        fi
        
        echo -e "\n${BLUE}确认数据库服务已启动，按Enter继续...${NC}"
        read -r
        
        # 使用tmux在不同窗口启动服务
        if command -v tmux &> /dev/null; then
            # 创建新的tmux会话
            tmux new-session -d -s heatsight
            
            # 在第一个窗口启动后端
            echo -e "${YELLOW}第三步: 启动后端服务...${NC}"
            tmux send-keys -t heatsight:0 "./start-backend.sh" C-m
            
            # 创建并切换到新窗口来启动前端
            echo -e "${YELLOW}第四步: 启动前端服务...${NC}"
            tmux new-window -t heatsight:1
            tmux send-keys -t heatsight:1 "./start-frontend.sh" C-m
            
            # 附加到会话
            echo -e "${GREEN}所有服务已在tmux会话中启动，按CTRL+B和D组合键可以退出会话但保持服务运行${NC}"
            tmux attach-session -t heatsight
        else
            # 如果没有tmux，则使用后台进程
            echo -e "${YELLOW}推荐安装tmux以获得更好的体验，使用后台进程模式启动${NC}"
            echo -e "${BLUE}启动后端...${NC}"
            ./start-backend.sh &
            BACKEND_PID=$!
            
            echo -e "${BLUE}启动前端...${NC}"
            ./start-frontend.sh
            
            # 前端退出后，终止后端进程
            kill $BACKEND_PID
        fi
        ;;
esac

echo -e "${BLUE}启动程序已结束${NC}" 