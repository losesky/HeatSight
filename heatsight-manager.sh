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

# 打印标题
print_title() {
    clear
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${CYAN}             HeatSight 管理工具                 ${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${YELLOW}工作目录: ${PROJECT_ROOT}${NC}\n"
}

# 检查Docker和Docker Compose是否安装
check_prerequisites() {
    local all_ok=true
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker未安装，请先安装Docker${NC}"
        all_ok=false
    fi
    
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}错误: Docker Compose不可用，请确保Docker Desktop正确安装${NC}"
        all_ok=false
    fi
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        echo -e "${RED}错误: docker-compose.yml文件不存在${NC}"
        all_ok=false
    fi
    
    if [ "$all_ok" = false ]; then
        echo -e "${YELLOW}按任意键返回主菜单...${NC}"
        read -r
        return 1
    fi
    
    return 0
}

# 数据库服务菜单
database_menu() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}数据库服务管理${NC}\n"
        echo -e "1) ${GREEN}启动数据库管理工具${NC}"
        echo -e "2) ${GREEN}快速初始化数据库${NC}"
        echo -e "3) ${CYAN}查看数据库状态${NC}"
        echo -e "4) ${RED}返回主菜单${NC}"
        echo
        read -p "请选择操作 [1-4]: " choice
        
        case $choice in
            1) 
                echo -e "\n${YELLOW}启动数据库管理工具...${NC}"
                if [ -f "$PROJECT_ROOT/db-manager.sh" ]; then
                    bash "$PROJECT_ROOT/db-manager.sh"
                else
                    echo -e "${RED}错误: db-manager.sh脚本不存在${NC}"
                    echo -e "${YELLOW}按任意键继续...${NC}"
                    read -r
                fi
                ;;
            2) 
                echo -e "\n${YELLOW}快速初始化数据库...${NC}"
                if [ -f "$PROJECT_ROOT/db-manager.sh" ]; then
                    bash "$PROJECT_ROOT/db-manager.sh" --quick
                else
                    echo -e "${RED}错误: db-manager.sh脚本不存在${NC}"
                    echo -e "${YELLOW}按任意键继续...${NC}"
                    read -r
                fi
                ;;
            3) 
                echo -e "\n${YELLOW}数据库服务状态:${NC}"
                if check_prerequisites; then
                    docker compose ps
                    echo -e "\n${YELLOW}主题-内容建议关联:${NC}"
                    docker compose exec postgres psql -U postgres -d heatsight_dev -c "SELECT t.title, COUNT(cs.id) AS suggestion_count FROM topics t LEFT JOIN content_suggestions cs ON t.id = cs.topic_id GROUP BY t.id, t.title ORDER BY suggestion_count DESC;"
                    echo
                    echo -e "${YELLOW}按任意键继续...${NC}"
                    read -r
                fi
                ;;
            4) 
                return
                ;;
            *)
                echo -e "${RED}无效选择，请重新输入${NC}"
                sleep 1
                ;;
        esac
    done
}

# 应用服务菜单
app_menu() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}应用服务管理${NC}\n"
        echo -e "1) ${GREEN}启动后端服务${NC}"
        echo -e "2) ${GREEN}启动前端服务${NC}"
        echo -e "3) ${GREEN}启动全部服务${NC}"
        echo -e "4) ${RED}停止所有服务${NC}"
        echo -e "5) ${CYAN}查看所有进程${NC}"
        echo -e "6) ${RED}返回主菜单${NC}"
        echo
        read -p "请选择操作 [1-6]: " choice
        
        case $choice in
            1) 
                echo -e "\n${YELLOW}启动后端服务...${NC}"
                if [ -f "$PROJECT_ROOT/start-backend.sh" ]; then
                    bash "$PROJECT_ROOT/start-backend.sh"
                else
                    echo -e "${RED}错误: start-backend.sh脚本不存在${NC}"
                fi
                ;;
            2) 
                echo -e "\n${YELLOW}启动前端服务...${NC}"
                if [ -f "$PROJECT_ROOT/start-frontend.sh" ]; then
                    bash "$PROJECT_ROOT/start-frontend.sh"
                else
                    echo -e "${RED}错误: start-frontend.sh脚本不存在${NC}"
                fi
                ;;
            3) 
                echo -e "\n${YELLOW}启动全部服务...${NC}"
                if [ -f "$PROJECT_ROOT/start-heatsight.sh" ]; then
                    bash "$PROJECT_ROOT/start-heatsight.sh"
                else
                    echo -e "${RED}错误: start-heatsight.sh脚本不存在${NC}"
                fi
                ;;
            4) 
                echo -e "\n${YELLOW}停止所有服务...${NC}"
                if [ -f "$PROJECT_ROOT/stop-heatsight.sh" ]; then
                    bash "$PROJECT_ROOT/stop-heatsight.sh"
                else
                    echo -e "${RED}错误: stop-heatsight.sh脚本不存在${NC}"
                fi
                ;;
            5) 
                echo -e "\n${YELLOW}所有服务进程:${NC}"
                echo -e "${CYAN}数据库服务:${NC}"
                docker compose ps
                echo
                echo -e "${CYAN}Node服务:${NC}"
                ps aux | grep -E 'node.*simple-server.js|node.*start' | grep -v grep
                echo
                echo -e "${CYAN}Python服务:${NC}"
                ps aux | grep -E 'python.*run.py|uvicorn' | grep -v grep
                echo
                echo -e "${YELLOW}按任意键继续...${NC}"
                read -r
                ;;
            6) 
                return
                ;;
            *)
                echo -e "${RED}无效选择，请重新输入${NC}"
                sleep 1
                ;;
        esac
    done
}

# 维护工具菜单
maintenance_menu() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}系统维护工具${NC}\n"
        echo -e "1) ${YELLOW}修复数据库依赖${NC}"
        echo -e "2) ${YELLOW}修复前端依赖${NC}"
        echo -e "3) ${GREEN}重建前端资源${NC}"
        echo -e "4) ${RED}清理Docker卷${NC}"
        echo -e "5) ${YELLOW}管理主题内容建议${NC}"
        echo -e "6) ${RED}返回主菜单${NC}"
        echo
        read -p "请选择操作 [1-6]: " choice
        
        case $choice in
            1) 
                echo -e "\n${YELLOW}修复数据库依赖...${NC}"
                if [ -f "$PROJECT_ROOT/fix-db-issue.sh" ]; then
                    bash "$PROJECT_ROOT/fix-db-issue.sh"
                else
                    echo -e "${RED}错误: fix-db-issue.sh脚本不存在${NC}"
                fi
                ;;
            2) 
                echo -e "\n${YELLOW}修复前端依赖...${NC}"
                cd "$PROJECT_ROOT/frontend" && npm install
                echo -e "${GREEN}前端依赖安装完成${NC}"
                echo -e "${YELLOW}按任意键继续...${NC}"
                read -r
                ;;
            3) 
                echo -e "\n${YELLOW}重建前端资源...${NC}"
                cd "$PROJECT_ROOT/frontend" && npm run build
                echo -e "${GREEN}前端资源重建完成${NC}"
                echo -e "${YELLOW}按任意键继续...${NC}"
                read -r
                ;;
            4) 
                echo -e "\n${RED}警告: 即将清理所有Docker卷!${NC}"
                echo -e "${YELLOW}这将删除所有数据库数据!${NC}"
                echo -e "${YELLOW}确认清理? (y/n)${NC}"
                read -r CONFIRM
                
                if [[ $CONFIRM =~ ^[Yy]$ ]]; then
                    echo -e "${YELLOW}停止所有服务...${NC}"
                    docker compose down
                    echo -e "${YELLOW}删除容器、镜像和数据卷...${NC}"
                    docker compose down --rmi all -v
                    docker volume rm heatsight_postgres_data heatsight_redis_data
                    echo -e "${GREEN}Docker卷已清理${NC}"
                else
                    echo -e "${YELLOW}已取消操作${NC}"
                fi
                echo -e "${YELLOW}按任意键继续...${NC}"
                read -r
                ;;
            5) 
                echo -e "\n${YELLOW}管理主题内容建议...${NC}"
                if [ -f "$PROJECT_ROOT/manage-topic-content.sh" ]; then
                    bash "$PROJECT_ROOT/manage-topic-content.sh"
                    echo -e "${YELLOW}按任意键继续...${NC}"
                    read -r
                else
                    echo -e "${RED}错误: manage-topic-content.sh脚本不存在${NC}"
                    echo -e "${YELLOW}按任意键继续...${NC}"
                    read -r
                fi
                ;;
            6) 
                return
                ;;
            *)
                echo -e "${RED}无效选择，请重新输入${NC}"
                sleep 1
                ;;
        esac
    done
}

# 主菜单
main_menu() {
    local choice
    
    while true; do
        print_title
        echo -e "${PURPLE}主菜单${NC}\n"
        echo -e "1) ${CYAN}数据库服务管理${NC}"
        echo -e "2) ${CYAN}应用服务管理${NC}"
        echo -e "3) ${CYAN}系统维护工具${NC}"
        echo -e "4) ${RED}退出程序${NC}"
        echo
        read -p "请选择操作 [1-4]: " choice
        
        case $choice in
            1) database_menu ;;
            2) app_menu ;;
            3) maintenance_menu ;;
            4) 
                echo -e "\n${GREEN}感谢使用HeatSight管理工具，再见！${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}无效选择，请重新输入${NC}"
                sleep 1
                ;;
        esac
    done
}

# 确保脚本拥有执行权限
ensure_script_permissions() {
    echo -e "${YELLOW}确保所有脚本拥有执行权限...${NC}"
    
    for script in *.sh; do
        if [ -f "$script" ]; then
            chmod +x "$script"
        fi
    done
    
    echo -e "${GREEN}权限设置完成${NC}"
}

# 主程序入口
main() {
    ensure_script_permissions
    main_menu
}

main 