#!/bin/bash

# HeatSight Manager - 综合管理脚本
# 用途: 提供所有HeatSight维护和管理操作的统一入口

# 彩色输出配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 设置变量
PROJECT_ROOT="$(pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
ENV_FILE="$PROJECT_ROOT/backend/.env"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 通用函数
print_title() {
    clear
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${CYAN}             HeatSight 管理工具                 ${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${YELLOW}工作目录: ${PROJECT_ROOT}${NC}\n"
}

wait_key() {
    echo -e "\n${YELLOW}按任意键继续...${NC}"
    read -r
}

confirm_action() {
    local message=$1
    echo -e "\n${RED}警告: $message${NC}"
    echo -e "${YELLOW}确认继续? (y/n)${NC}"
    read -r CONFIRM
    [[ $CONFIRM =~ ^[Yy]$ ]]
}

# 系统检查函数
check_system_requirements() {
    local all_ok=true
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker未安装${NC}"
        all_ok=false
    else
        echo -e "${GREEN}✓ Docker已安装${NC}"
    fi
    
    # 检查Docker Compose
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}✗ Docker Compose不可用${NC}"
        all_ok=false
    else
        echo -e "${GREEN}✓ Docker Compose可用${NC}"
    fi
    
    # 检查Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}✗ Python3未安装${NC}"
        all_ok=false
    else
        echo -e "${GREEN}✓ Python3已安装${NC}"
    fi
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js未安装${NC}"
        all_ok=false
    else
        echo -e "${GREEN}✓ Node.js已安装${NC}"
    fi
    
    return $all_ok
}

check_project_files() {
    local all_ok=true
    
    # 检查关键文件
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        echo -e "${RED}✗ docker-compose.yml不存在${NC}"
        all_ok=false
    else
        echo -e "${GREEN}✓ docker-compose.yml存在${NC}"
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}✗ .env配置文件不存在${NC}"
        all_ok=false
    else
        echo -e "${GREEN}✓ .env配置文件存在${NC}"
    fi
    
    if [ ! -d "$BACKEND_DIR" ]; then
        echo -e "${RED}✗ backend目录不存在${NC}"
        all_ok=false
    else
        echo -e "${GREEN}✓ backend目录存在${NC}"
    fi
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        echo -e "${RED}✗ frontend目录不存在${NC}"
        all_ok=false
    else
        echo -e "${GREEN}✓ frontend目录存在${NC}"
    fi
    
    return $all_ok
}

# 服务管理函数
start_service() {
    local service_type=$1
    case $service_type in
        "database")
            echo -e "\n${YELLOW}启动数据库服务...${NC}"
            bash "$PROJECT_ROOT/db-manager.sh" start
            ;;
        "backend")
            echo -e "\n${YELLOW}启动后端服务...${NC}"
            bash "$PROJECT_ROOT/start-backend.sh"
            ;;
        "frontend")
            echo -e "\n${YELLOW}启动前端服务...${NC}"
            bash "$PROJECT_ROOT/start-frontend.sh"
            ;;
        "all")
            echo -e "\n${YELLOW}启动全部服务...${NC}"
            bash "$PROJECT_ROOT/db-manager.sh" start
            bash "$PROJECT_ROOT/start-backend.sh" &
            bash "$PROJECT_ROOT/start-frontend.sh"
            ;;
    esac
}

stop_service() {
    local service_type=$1
    case $service_type in
        "database")
            echo -e "\n${YELLOW}停止数据库服务...${NC}"
            bash "$PROJECT_ROOT/db-manager.sh" stop
            ;;
        "all")
            echo -e "\n${YELLOW}停止所有服务...${NC}"
            bash "$PROJECT_ROOT/stop-heatsight.sh"
            ;;
    esac
}

check_service_status() {
    echo -e "\n${YELLOW}服务状态:${NC}"
    
    echo -e "${CYAN}数据库服务:${NC}"
    docker compose ps
    
    echo -e "\n${CYAN}后端服务:${NC}"
    ps aux | grep -E 'uvicorn.*app.main:app' | grep -v grep || echo "未运行"
    
    echo -e "\n${CYAN}前端服务:${NC}"
    ps aux | grep -E 'node.*start' | grep -v grep || echo "未运行"
    
    wait_key
}

# 数据库管理函数
manage_database() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}数据库管理${NC}\n"
        echo -e "1) ${GREEN}启动数据库${NC}"
        echo -e "2) ${RED}停止数据库${NC}"
        echo -e "3) ${YELLOW}备份数据库${NC}"
        echo -e "4) ${YELLOW}恢复数据库${NC}"
        echo -e "5) ${RED}重置数据库${NC}"
        echo -e "6) ${CYAN}查看数据库状态${NC}"
        echo -e "7) ${YELLOW}修复数据库问题${NC}"
        echo -e "8) ${RED}返回主菜单${NC}"
        echo
        read -p "请选择操作 [1-8]: " choice
        
        case $choice in
            1) start_service "database" ;;
            2) stop_service "database" ;;
            3) bash "$PROJECT_ROOT/db-manager.sh" backup ;;
            4) bash "$PROJECT_ROOT/db-manager.sh" restore ;;
            5)
                if confirm_action "即将重置数据库，所有数据将被删除!"; then
                    bash "$PROJECT_ROOT/db-manager.sh" reset
                fi
                ;;
            6) bash "$PROJECT_ROOT/db-manager.sh" status; wait_key ;;
            7) bash "$PROJECT_ROOT/fix-dependencies.sh" 4 ;;
            8) return ;;
            *) echo -e "${RED}无效选择${NC}"; sleep 1 ;;
        esac
    done
}

# 应用服务管理函数
manage_services() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}应用服务管理${NC}\n"
        echo -e "1) ${GREEN}启动所有服务${NC}"
        echo -e "2) ${GREEN}启动后端服务${NC}"
        echo -e "3) ${GREEN}启动前端服务${NC}"
        echo -e "4) ${RED}停止所有服务${NC}"
        echo -e "5) ${YELLOW}重启所有服务${NC}"
        echo -e "6) ${CYAN}查看服务状态${NC}"
        echo -e "7) ${RED}返回主菜单${NC}"
        echo
        read -p "请选择操作 [1-7]: " choice
        
        case $choice in
            1) start_service "all" ;;
            2) start_service "backend" ;;
            3) start_service "frontend" ;;
            4) stop_service "all" ;;
            5)
                stop_service "all"
                sleep 2
                start_service "all"
                ;;
            6) check_service_status ;;
            7) return ;;
            *) echo -e "${RED}无效选择${NC}"; sleep 1 ;;
        esac
    done
}

# 配置管理函数
manage_config() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}配置管理${NC}\n"
        echo -e "1) ${GREEN}查看配置${NC}"
        echo -e "2) ${GREEN}编辑配置${NC}"
        echo -e "3) ${YELLOW}备份配置${NC}"
        echo -e "4) ${YELLOW}恢复配置${NC}"
        echo -e "5) ${CYAN}验证配置${NC}"
        echo -e "6) ${RED}返回主菜单${NC}"
        echo
        read -p "请选择操作 [1-6]: " choice
        
        case $choice in
            1)
                echo -e "\n${YELLOW}当前配置:${NC}"
                if [ -f "$ENV_FILE" ]; then
                    echo -e "${CYAN}=== 应用设置 ===${NC}"
                    grep -E "^(APP_|DEBUG|ENVIRONMENT|LOG_LEVEL)" "$ENV_FILE" | sort
                    echo -e "\n${CYAN}=== 服务器设置 ===${NC}"
                    grep -E "^(HOST|PORT)" "$ENV_FILE" | sort
                    echo -e "\n${CYAN}=== 数据库设置 ===${NC}"
                    grep -E "^(DATABASE_URL|TEST_DATABASE_URL)" "$ENV_FILE" | sort
                    echo -e "\n${CYAN}=== Redis设置 ===${NC}"
                    grep -E "^(CELERY_|REDIS_URL)" "$ENV_FILE" | sort
                    echo -e "\n${CYAN}=== 安全设置 ===${NC}"
                    grep -E "^(SECRET_KEY|JWT_|ACCESS_TOKEN)" "$ENV_FILE" | sort
                    echo -e "\n${CYAN}=== CORS设置 ===${NC}"
                    grep "^ALLOWED_ORIGINS" "$ENV_FILE"
                    echo -e "\n${CYAN}=== HeatLink API设置 ===${NC}"
                    grep "^HEATLINK_" "$ENV_FILE" | sort
                else
                    echo -e "${RED}错误: 配置文件不存在${NC}"
                fi
                wait_key
                ;;
            2)
                if [ -f "$ENV_FILE" ]; then
                    if command -v nano &> /dev/null; then
                        nano "$ENV_FILE"
                    else
                        vim "$ENV_FILE"
                    fi
                else
                    if confirm_action "配置文件不存在，是否创建新配置文件?"; then
                        cat > "$ENV_FILE" << 'EOF'
# App settings
APP_NAME=HeatSight
APP_VERSION=0.1.0
DEBUG=false
ENVIRONMENT=development
LOG_LEVEL=INFO

# Server settings
HOST=0.0.0.0
PORT=8080

# Database settings
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/heatsight_dev
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/heatsight_test

# Redis settings
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
REDIS_URL=redis://localhost:6379/0

# JWT settings
SECRET_KEY=changeme
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440  # 24 hours

# CORS settings
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# HeatLink API settings
HEATLINK_API_URL=http://localhost:8000/api
HEATLINK_API_TIMEOUT=60
EOF
                        echo -e "${GREEN}已创建新配置文件${NC}"
                    fi
                fi
                ;;
            3)
                if [ -f "$ENV_FILE" ]; then
                    BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d%H%M%S)"
                    cp "$ENV_FILE" "$BACKUP_FILE"
                    echo -e "${GREEN}配置已备份到: $BACKUP_FILE${NC}"
                else
                    echo -e "${RED}错误: 配置文件不存在${NC}"
                fi
                wait_key
                ;;
            4)
                BACKUPS=($(ls -t "${ENV_FILE}.backup"* 2>/dev/null))
                if [ ${#BACKUPS[@]} -eq 0 ]; then
                    echo -e "${RED}错误: 未找到备份文件${NC}"
                else
                    echo -e "${CYAN}可用的备份文件:${NC}"
                    for i in "${!BACKUPS[@]}"; do
                        echo "$((i+1))) ${BACKUPS[$i]}"
                    done
                    echo -e "\n${YELLOW}选择要恢复的备份 [1-${#BACKUPS[@]}]: ${NC}"
                    read -r BACKUP_CHOICE
                    if [[ "$BACKUP_CHOICE" =~ ^[0-9]+$ ]] && [ "$BACKUP_CHOICE" -le "${#BACKUPS[@]}" ]; then
                        SELECTED_BACKUP="${BACKUPS[$((BACKUP_CHOICE-1))]}"
                        cp "$ENV_FILE" "${ENV_FILE}.before_restore.$(date +%Y%m%d%H%M%S)"
                        cp "$SELECTED_BACKUP" "$ENV_FILE"
                        echo -e "${GREEN}配置已恢复${NC}"
                    else
                        echo -e "${RED}无效选择${NC}"
                    fi
                fi
                wait_key
                ;;
            5)
                if [ -f "$ENV_FILE" ]; then
                    echo -e "\n${YELLOW}验证配置...${NC}"
                    # 检查必需的配置项
                    REQUIRED_VARS=("DATABASE_URL" "REDIS_URL" "SECRET_KEY" "ALLOWED_ORIGINS")
                    MISSING_VARS=()
                    
                    for var in "${REQUIRED_VARS[@]}"; do
                        if ! grep -q "^$var=" "$ENV_FILE"; then
                            MISSING_VARS+=("$var")
                        fi
                    done
                    
                    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
                        echo -e "${GREEN}✓ 所有必需的配置项都存在${NC}"
                    else
                        echo -e "${RED}✗ 缺少以下配置项:${NC}"
                        printf '%s\n' "${MISSING_VARS[@]}"
                    fi
                    
                    # 检查数据库URL格式
                    if grep -q "DATABASE_URL=postgresql://" "$ENV_FILE" && ! grep -q "DATABASE_URL=postgresql+asyncpg://" "$ENV_FILE"; then
                        echo -e "${RED}✗ 数据库URL格式不正确，应使用postgresql+asyncpg://${NC}"
                    else
                        echo -e "${GREEN}✓ 数据库URL格式正确${NC}"
                    fi
                    
                    # 检查端口配置
                    if grep -q "PORT=8080" "$ENV_FILE"; then
                        echo -e "${GREEN}✓ 后端端口配置正确${NC}"
                    else
                        echo -e "${YELLOW}! 后端端口不是默认的8080${NC}"
                    fi
                    
                    # 检查环境设置
                    if grep -q "ENVIRONMENT=development" "$ENV_FILE"; then
                        echo -e "${GREEN}✓ 环境设置为开发模式${NC}"
                    elif grep -q "ENVIRONMENT=production" "$ENV_FILE"; then
                        echo -e "${YELLOW}! 环境设置为生产模式${NC}"
                    fi
                else
                    echo -e "${RED}错误: 配置文件不存在${NC}"
                fi
                wait_key
                ;;
            6) return ;;
            *) echo -e "${RED}无效选择${NC}"; sleep 1 ;;
        esac
    done
}

# 系统维护函数
manage_maintenance() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}系统维护${NC}\n"
        echo -e "1) ${YELLOW}修复后端依赖${NC}"
        echo -e "2) ${YELLOW}修复前端依赖${NC}"
        echo -e "3) ${YELLOW}修复全部依赖${NC}"
        echo -e "4) ${GREEN}重建前端资源${NC}"
        echo -e "5) ${RED}清理Docker资源${NC}"
        echo -e "6) ${CYAN}系统状态检查${NC}"
        echo -e "7) ${RED}返回主菜单${NC}"
        echo
        read -p "请选择操作 [1-7]: " choice
        
        case $choice in
            1) bash "$PROJECT_ROOT/fix-dependencies.sh" 1 ;;
            2) bash "$PROJECT_ROOT/fix-dependencies.sh" 2 ;;
            3) bash "$PROJECT_ROOT/fix-dependencies.sh" 3 ;;
            4)
                cd "$FRONTEND_DIR" && npm run build
                echo -e "${GREEN}前端资源重建完成${NC}"
                wait_key
                ;;
            5)
                if confirm_action "即将清理所有Docker资源，包括容器、镜像和数据卷!"; then
                    docker compose down
                    docker compose down --rmi all -v
                    docker volume rm heatsight_postgres_data heatsight_redis_data 2>/dev/null || true
                    echo -e "${GREEN}Docker资源已清理${NC}"
                fi
                wait_key
                ;;
            6)
                echo -e "\n${CYAN}系统状态检查${NC}"
                echo -e "\n${YELLOW}1. 检查系统要求...${NC}"
                check_system_requirements
                
                echo -e "\n${YELLOW}2. 检查项目文件...${NC}"
                check_project_files
                
                echo -e "\n${YELLOW}3. 检查服务状态...${NC}"
                check_service_status
                ;;
            7) return ;;
            *) echo -e "${RED}无效选择${NC}"; sleep 1 ;;
        esac
    done
}

# 主菜单
main_menu() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}主菜单${NC}\n"
        echo -e "1) ${CYAN}数据库管理${NC}"
        echo -e "2) ${CYAN}应用服务管理${NC}"
        echo -e "3) ${CYAN}配置管理${NC}"
        echo -e "4) ${CYAN}系统维护${NC}"
        echo -e "5) ${RED}退出程序${NC}"
        echo
        read -p "请选择操作 [1-5]: " choice
        
        case $choice in
            1) manage_database ;;
            2) manage_services ;;
            3) manage_config ;;
            4) manage_maintenance ;;
            5) 
                echo -e "\n${GREEN}感谢使用HeatSight管理工具，再见！${NC}"
                exit 0
                ;;
            *) echo -e "${RED}无效选择${NC}"; sleep 1 ;;
        esac
    done
}

# 主程序入口
main() {
    # 确保所有脚本有执行权限
    for script in *.sh; do
        if [ -f "$script" ]; then
            chmod +x "$script"
        fi
    done
    
    # 运行主菜单
    main_menu
}

main 