#!/bin/bash

# HeatSight停止脚本
# 用途: 终止所有HeatSight相关进程

# 彩色输出配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${RED}             HeatSight Process Killer              ${NC}"
echo -e "${BLUE}=================================================${NC}"

echo -e "${YELLOW}正在查找并终止HeatSight相关进程...${NC}"

# 停止前端进程
NODE_PIDS=$(ps aux | grep -E 'node.*simple-server.js|node.*start' | grep -v grep | awk '{print $2}')
if [ -n "$NODE_PIDS" ]; then
    echo -e "${BLUE}找到前端进程:${NC}"
    ps aux | grep -E 'node.*simple-server.js|node.*start' | grep -v grep
    echo -e "${RED}正在终止前端进程...${NC}"
    for pid in $NODE_PIDS; do
        kill -9 $pid 2>/dev/null
        echo -e "已终止进程: $pid"
    done
    echo -e "${GREEN}前端服务已停止${NC}"
else
    echo -e "${YELLOW}未发现运行中的前端服务${NC}"
fi

# 停止后端进程
PYTHON_PIDS=$(ps aux | grep -E 'python.*run.py|uvicorn' | grep -v grep | awk '{print $2}')
if [ -n "$PYTHON_PIDS" ]; then
    echo -e "${BLUE}找到后端进程:${NC}"
    ps aux | grep -E 'python.*run.py|uvicorn' | grep -v grep
    echo -e "${RED}正在终止后端进程...${NC}"
    for pid in $PYTHON_PIDS; do
        kill -9 $pid 2>/dev/null
        echo -e "已终止进程: $pid"
    done
    echo -e "${GREEN}后端服务已停止${NC}"
else
    echo -e "${YELLOW}未发现运行中的后端服务${NC}"
fi

# 检查并终止tmux会话
if command -v tmux &> /dev/null; then
    if tmux has-session -t heatsight 2>/dev/null; then
        echo -e "${RED}终止tmux会话: heatsight${NC}"
        tmux kill-session -t heatsight
        echo -e "${GREEN}tmux会话已终止${NC}"
    fi
fi

echo -e "${GREEN}所有HeatSight服务已停止${NC}" 