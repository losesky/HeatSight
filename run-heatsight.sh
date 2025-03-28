#!/bin/bash
# HeatSight 一键启动脚本

# 设置颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======== HeatSight 一键启动 ========${NC}"
echo -e "${BLUE}这个脚本将：${NC}"
echo "1. 初始化数据库环境"
echo "2. 设置应用环境"
echo "3. 启动后端服务"
echo "4. 触发热度计算"
echo -e "${YELLOW}按Enter键继续...${NC}"
read -r

# 初始化数据库环境
echo -e "\n${BLUE}[1/4] 初始化数据库环境...${NC}"
# 使用已有的数据库管理器脚本进行初始化，避免重复造轮子
bash db-manager.sh --quick

# 等待Redis确认运行
echo -e "\n${BLUE}确认Redis是否运行...${NC}"
if redis-cli ping > /dev/null 2>&1; then
  echo -e "${GREEN}Redis运行正常${NC}"
else
  echo -e "${RED}Redis未运行，请手动启动Redis${NC}"
  echo -e "${YELLOW}尝试启动Redis...${NC}"
  sudo systemctl start redis || sudo service redis-server start
  sleep 2
  
  if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}Redis成功启动${NC}"
  else
    echo -e "${RED}无法启动Redis，请手动启动${NC}"
    exit 1
  fi
fi

# 设置环境
echo -e "\n${BLUE}[2/4] 设置应用环境...${NC}"

# 检查数据库配置
if [ ! -f "backend/.env" ]; then
  echo -e "${YELLOW}创建默认.env文件${NC}"
  cat > backend/.env << EOL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/heatsight_dev
HEATLINK_API_URL=http://localhost:8000/api
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_secret_key_here
JWT_ALGORITHM=HS256
EOL
  echo -e "${GREEN}已创建默认环境配置${NC}"
fi

# 安装必要依赖
echo -e "${BLUE}安装必要依赖...${NC}"
bash backend/setup_env.sh

# 启动后端服务
echo -e "\n${BLUE}[3/4] 启动后端服务...${NC}"

# 设置环境变量避免SQLAlchemy表重定义警告和错误
export SQLALCHEMY_SILENCE_UBER_WARNING=1

# 在models文件中强制启用extend_existing
echo -e "${BLUE}确保SQLAlchemy模型正确配置...${NC}"

# 为所有SQLAlchemy模型添加extend_existing
if grep -q "extend_existing=True" backend/app/models/news_heat_score.py; then
  echo -e "${GREEN}模型已正确配置${NC}"
else
  echo -e "${YELLOW}更新模型配置...${NC}"
  sed -i 's/__table_args__ = (/__table_args__ = (\n        {"extend_existing": True},/' backend/app/models/news_heat_score.py
fi

# 启动服务
bash start-backend.sh

# 等待后端服务完全启动
echo -e "\n${BLUE}等待后端服务就绪...${NC}"
sleep 10

# 触发热度计算
echo -e "\n${BLUE}[4/4] 触发热度计算...${NC}"
cd backend || { echo -e "${RED}无法进入backend目录${NC}"; exit 1; }
python3 trigger_heat_calculation.py

# 完成
echo -e "\n${GREEN}======== HeatSight 已成功启动 ========${NC}"
echo -e "${BLUE}后端API: ${NC}http://localhost:8080/api"
echo -e "${BLUE}API文档: ${NC}http://localhost:8080/api/docs"
echo -e "${BLUE}日志文件: ${NC}backend.log 和 heat_calculation.log"
echo ""
echo -e "${YELLOW}提示:${NC}"
echo "1. 要查看热度计算进度，运行: tail -f backend/heat_calculation.log"
echo "2. 要停止后端服务，运行: pkill -f \"uvicorn app.main:app\""
echo "3. 热度计算可能需要几分钟完成"
echo "" 