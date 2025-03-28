#!/bin/bash

# HeatSight数据库管理脚本
# 用途: 提供简化的数据库管理功能

# 彩色输出配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印脚本标题
print_title() {
  clear
  echo -e "${BLUE}=================================================${NC}"
  echo -e "${CYAN}         HeatSight 数据库管理工具               ${NC}"
  echo -e "${BLUE}=================================================${NC}"
  echo -e "${YELLOW}工作目录: $(pwd)${NC}\n"
}

# 检查依赖
check_prerequisites() {
  # 检查Docker是否安装
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker未安装。请先安装Docker${NC}"
    return 1
  fi

  # 检查Docker Compose是否可用
  if ! docker compose version &> /dev/null; then
    echo -e "${RED}错误: Docker Compose不可用。请确保Docker安装正确${NC}"
    return 1
  fi

  # 检查docker-compose.yml文件
  if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}错误: docker-compose.yml文件不存在${NC}"
    return 1
  fi

  return 0
}

# 检查Python依赖
check_python_dependencies() {
  echo -e "${YELLOW}检查Python依赖...${NC}"
  
  # 检查Python命令
  if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
  elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
  else
    echo -e "${RED}错误: 找不到python或python3命令。请确保Python已安装。${NC}"
    return 1
  fi
  
  # 检查pip命令
  if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
  elif command -v pip &> /dev/null; then
    PIP_CMD="pip"
  else
    echo -e "${RED}错误: 找不到pip或pip3命令。请确保pip已安装。${NC}"
    return 1
  fi
  
  echo -e "${YELLOW}使用 ${PYTHON_CMD} 和 ${PIP_CMD}${NC}"
  
  # 检查SQLAlchemy是否已安装
  if ! $PYTHON_CMD -c "import sqlalchemy" &> /dev/null; then
    echo -e "${YELLOW}安装 SQLAlchemy...${NC}"
    $PIP_CMD install sqlalchemy
  fi
  
  # 检查psycopg2是否已安装
  if ! $PYTHON_CMD -c "import psycopg2" &> /dev/null; then
    echo -e "${YELLOW}安装 psycopg2-binary...${NC}"
    $PIP_CMD install psycopg2-binary
  fi
  
  echo -e "${GREEN}Python依赖检查完成!${NC}"
  return 0
}

# 检查Docker是否运行
check_docker_running() {
  echo -e "${YELLOW}检查Docker服务状态...${NC}"
  if ! docker info &> /dev/null; then
    echo -e "${RED}错误: Docker服务未运行，请先启动Docker服务。${NC}"
    return 1
  fi
  echo -e "${GREEN}Docker服务正在运行。${NC}"
  return 0
}

# 确保数据库存在
ensure_db_exists() {
  echo -e "${YELLOW}确保数据库存在...${NC}"
  
  # 检查PostgreSQL容器是否运行
  echo -e "${YELLOW}检查PostgreSQL容器...${NC}"
  POSTGRES_RUNNING=$(docker ps | grep "postgres-local" | wc -l)
  
  # 如果未检测到，尝试更宽松的匹配
  if [ "$POSTGRES_RUNNING" -eq 0 ]; then
    POSTGRES_RUNNING=$(docker ps | grep -e "postgres" | grep -v "pgadmin" | wc -l)
    echo -e "PostgreSQL宽松检测结果: ${BLUE}$POSTGRES_RUNNING${NC}"
  fi
  
  if [ "$POSTGRES_RUNNING" -eq 0 ]; then
    echo -e "${YELLOW}PostgreSQL容器未运行，正在启动...${NC}"
    docker compose up -d postgres
    
    # 等待容器启动
    echo -e "${YELLOW}等待PostgreSQL容器启动...${NC}"
    sleep 10
    
    # 检查容器是否成功启动
    POSTGRES_RUNNING=$(docker ps | grep "postgres-local" | wc -l)
    if [ "$POSTGRES_RUNNING" -eq 0 ]; then
      # 再次尝试更宽松的匹配
      POSTGRES_RUNNING=$(docker ps | grep -e "postgres" | grep -v "pgadmin" | wc -l)
    fi
    
    if [ "$POSTGRES_RUNNING" -eq 0 ]; then
      echo -e "${RED}错误: PostgreSQL容器启动失败${NC}"
      return 1
    fi
  else
    echo -e "${GREEN}PostgreSQL容器已运行${NC}"
  fi
  
  # 等待确保PostgreSQL服务可用
  echo -e "${YELLOW}等待PostgreSQL服务就绪...${NC}"
  for i in {1..10}; do
    if docker exec postgres-local pg_isready -q; then
      echo -e "${GREEN}PostgreSQL服务可用${NC}"
      break
    fi
    
    if [ $i -eq 10 ]; then
      echo -e "${RED}错误: PostgreSQL服务无法连接${NC}"
      return 1
    fi
    
    echo -e "${YELLOW}正在等待PostgreSQL服务启动... (尝试 $i/10)${NC}"
    sleep 2
  done
  
  # 检查数据库是否已存在方式
  echo -e "${YELLOW}检查数据库是否存在...${NC}"
  
  # 直接尝试连接到heatsight_dev数据库
  if docker exec postgres-local psql -U postgres -d heatsight_dev -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}数据库 'heatsight_dev' 已存在，跳过创建步骤。${NC}"
    return 0
  fi
  
  # 如果连接失败，尝试创建数据库
  echo -e "${YELLOW}创建 'heatsight_dev' 数据库...${NC}"
  CREATE_OUTPUT=$(docker exec postgres-local createdb -U postgres heatsight_dev 2>&1)
  CREATE_RESULT=$?
  
  # 检查创建结果
  if [ $CREATE_RESULT -eq 0 ]; then
    echo -e "${GREEN}数据库创建成功。${NC}"
    return 0
  else
    # 检查是否是因为数据库已存在而失败
    if echo "$CREATE_OUTPUT" | grep -q "already exists"; then
      echo -e "${GREEN}数据库 'heatsight_dev' 已存在，继续操作。${NC}"
      return 0
    else
      echo -e "${RED}错误: 创建数据库失败: $CREATE_OUTPUT${NC}"
      return 1
    fi
  fi
}

# 启动数据库服务
start_db_services() {
  # 获取实际使用的端口
  PGADMIN_PORT=$(docker ps | grep "pgadmin-local" | grep -o "0.0.0.0:[0-9]*->80/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "5050")
  REDIS_COMMANDER_PORT=$(docker ps | grep -e "redis-commander-local\|rediscommander" | grep -o "0.0.0.0:[0-9]*->8081/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "8081")
  POSTGRES_PORT=$(docker ps | grep "postgres-local" | grep -o "0.0.0.0:[0-9]*->5432/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "5432")
  REDIS_PORT=$(docker ps | grep "redis-local " | grep -o "0.0.0.0:[0-9]*->6379/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "6379")

  # 检查容器是否已经在运行
  echo -e "${YELLOW}正在检查容器...${NC}"
  echo -e "${BLUE}所有Docker容器:${NC}"
  docker ps | grep -e "redis\|postgres\|pgadmin"
  
  echo -e "\n${YELLOW}详细检查PostgreSQL服务状态...${NC}"
  POSTGRES_RUNNING=$(docker ps | grep "postgres-local" | wc -l)
  
  echo -e "PostgreSQL检测命令: ${BLUE}docker ps | grep \"postgres-local\" | wc -l${NC} 结果: ${BLUE}$POSTGRES_RUNNING${NC}"
  
  # 检查Redis、Redis Commander和PGAdmin状态（仅显示，不管理）
  REDIS_RUNNING=$(docker ps | grep "redis-local " | wc -l)  # 注意添加了空格，以避免匹配redis-commander
  REDIS_COMMANDER_RUNNING=$(docker ps | grep -e "redis-commander-local\|rediscommander" | wc -l)
  PGADMIN_RUNNING=$(docker ps | grep "pgadmin-local" | wc -l)
  
  echo -e "Redis检测结果: ${BLUE}$REDIS_RUNNING${NC} (仅信息展示，不进行管理)"
  echo -e "Redis Commander检测结果: ${BLUE}$REDIS_COMMANDER_RUNNING${NC} (仅信息展示，不进行管理)"
  echo -e "PGAdmin检测结果: ${BLUE}$PGADMIN_RUNNING${NC} (仅信息展示，不进行管理)"
  
  echo -e "\n${YELLOW}服务状态摘要:${NC}"
  echo -e "PostgreSQL: $([ "$POSTGRES_RUNNING" -ge 1 ] && echo "${GREEN}运行中${NC}" || echo "${RED}未运行${NC}")"
  echo -e "Redis、Redis Commander和PGAdmin状态仅供参考，本脚本不管理这些服务"
  
  if [ "$POSTGRES_RUNNING" -ge 1 ]; then
    echo -e "\n${GREEN}PostgreSQL服务已经在运行中!${NC}"
  else
    echo -e "\n${YELLOW}启动PostgreSQL服务...${NC}"
    # 只启动PostgreSQL服务，不启动Redis相关服务和PGAdmin
    # 使用docker-compose.yml中的服务名称'postgres'
    docker compose up -d postgres

    # 等待服务启动
    echo -e "${YELLOW}等待PostgreSQL服务启动完成...${NC}"
    sleep 5

    # 再次检查PostgreSQL服务状态
    POSTGRES_RUNNING=$(docker ps | grep "postgres-local" | wc -l)
    
    # 更新端口信息
    POSTGRES_PORT=$(docker ps | grep "postgres-local" | grep -o "0.0.0.0:[0-9]*->5432/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "5432")
    
    echo -e "${YELLOW}PostgreSQL服务启动后状态:${NC}"
    echo -e "PostgreSQL: $([ "$POSTGRES_RUNNING" -ge 1 ] && echo "${GREEN}运行中${NC}" || echo "${RED}未运行${NC}")"

    # 检查PostgreSQL服务是否成功启动
    if [ "$POSTGRES_RUNNING" -ge 1 ]; then
      echo -e "${GREEN}PostgreSQL服务启动成功!${NC}"
    else
      echo -e "${RED}PostgreSQL服务启动失败${NC}"
      echo -e "${YELLOW}请检查Docker状态和端口占用情况${NC}"
      docker compose ps postgres
      return 1
    fi
  fi
  
  # 显示服务信息（使用实际端口）
  echo -e "\n${BLUE}服务信息:${NC}"
  echo -e "PostgreSQL: ${GREEN}localhost:${POSTGRES_PORT}${NC}"
  echo -e "用户名: ${GREEN}postgres${NC}"
  echo -e "密码: ${GREEN}postgres${NC}"
  echo -e "数据库: ${GREEN}heatsight_dev${NC}"
  
  # 显示其他服务的信息（如果它们在运行）
  if [ "$REDIS_RUNNING" -ge 1 ] || [ "$REDIS_COMMANDER_RUNNING" -ge 1 ] || [ "$PGADMIN_RUNNING" -ge 1 ]; then
    echo -e "\n${YELLOW}其他相关服务信息 (仅供参考):${NC}"
    
    if [ "$REDIS_RUNNING" -ge 1 ]; then
      echo -e "Redis: ${GREEN}localhost:${REDIS_PORT}${NC}"
    fi
    
    if [ "$REDIS_COMMANDER_RUNNING" -ge 1 ]; then
      echo -e "Redis Commander: ${GREEN}http://localhost:${REDIS_COMMANDER_PORT}${NC}"
      echo -e "Redis Commander登录用户: ${GREEN}admin${NC}"
      echo -e "Redis Commander登录密码: ${GREEN}admin${NC}"
    fi
    
    if [ "$PGADMIN_RUNNING" -ge 1 ]; then
      echo -e "PGAdmin: ${GREEN}http://localhost:${PGADMIN_PORT}${NC}"
      echo -e "PGAdmin登录邮箱: ${GREEN}losesky@gmail.com${NC}"
      echo -e "PGAdmin登录密码: ${GREEN}admin${NC}"
    fi
  fi
  
  return 0
}

# 初始化数据库结构
init_db_structure() {
  # 检查Docker是否运行
  if ! check_docker_running; then
    return 1
  fi
  
  # 确保数据库存在
  if ! ensure_db_exists; then
    return 1
  fi
  
  # 检查Python依赖
  if ! check_python_dependencies; then
    echo -e "${RED}无法继续，缺少必要的Python依赖。${NC}"
    return 1
  fi
  
  echo -e "${YELLOW}初始化表结构...${NC}"
  
  # 检查topics表是否已存在
  echo -e "${YELLOW}检查topics表是否存在...${NC}"
  if docker exec postgres-local psql -U postgres -d heatsight_dev -c "\dt topics" | grep -q "topics"; then
    echo -e "${GREEN}topics表已存在，跳过创建步骤。${NC}"
  else
    # 直接使用Docker执行SQL命令创建表
    echo -e "${YELLOW}创建topics表...${NC}"
    if ! docker exec postgres-local psql -U postgres -d heatsight_dev -c "
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        summary TEXT,
        category VARCHAR(100),
        heat FLOAT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    "; then
      echo -e "${RED}错误: 创建topics表失败${NC}"
      return 1
    fi
    echo -e "${GREEN}topics表创建成功。${NC}"
  fi
  
  # 检查content_suggestions表是否已存在
  echo -e "${YELLOW}检查content_suggestions表是否存在...${NC}"
  if docker exec postgres-local psql -U postgres -d heatsight_dev -c "\dt content_suggestions" | grep -q "content_suggestions"; then
    echo -e "${GREEN}content_suggestions表已存在，跳过创建步骤。${NC}"
  else
    echo -e "${YELLOW}创建content_suggestions表...${NC}"
    if ! docker exec postgres-local psql -U postgres -d heatsight_dev -c "
      CREATE TABLE IF NOT EXISTS content_suggestions (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
        category VARCHAR(100),
        suggestion_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    "; then
      echo -e "${RED}错误: 创建content_suggestions表失败${NC}"
      return 1
    fi
    echo -e "${GREEN}content_suggestions表创建成功。${NC}"
  fi
  
  echo -e "${GREEN}数据库结构初始化完成!${NC}"
  return 0
}

# 初始化主题数据
init_topic_data() {
  echo -e "${YELLOW}添加初始主题数据...${NC}"
  
  # 创建SQL脚本添加基础主题
  cat > init_topics.sql << EOF
-- 清除现有数据
TRUNCATE topics CASCADE;

-- 插入话题数据
INSERT INTO topics (title, summary, category, heat, created_at, updated_at)
VALUES 
('元宇宙发展现状与未来趋势', '探讨元宇宙技术发展现状、应用场景与未来可能的发展方向', '科技', 95.5, NOW(), NOW()),
('数字人民币试点扩大到更多城市', '数字人民币试点范围进一步扩大，应用场景不断丰富', '财经', 92.8, NOW(), NOW()),
('新能源汽车销量创历史新高', '新能源汽车市场快速发展，多家车企销量创新高', '汽车', 90.2, NOW(), NOW()),
('AI绘画引发版权争议', '人工智能绘画技术引发的艺术创作与版权归属问题', '科技', 88.7, NOW(), NOW()),
('芯片短缺问题持续影响全球供应链', '全球芯片供应紧张，影响多个行业生产和供应', '科技', 86.3, NOW(), NOW()),
('在线教育行业进入深度调整期', '在线教育行业面临新政策环境下的挑战与转型', '教育', 85.1, NOW(), NOW()),
('碳达峰碳中和政策推进情况分析', '各地碳达峰碳中和相关政策实施进展与效果分析', '环保', 83.4, NOW(), NOW()),
('直播电商新规出台', '针对直播电商行业的新监管政策解读及影响分析', '电商', 81.9, NOW(), NOW());

-- 显示添加的数据
SELECT id, title, category, heat FROM topics ORDER BY heat DESC;
EOF

  # 执行SQL脚本
  docker exec -i postgres-local psql -U postgres -d heatsight_dev -f - < init_topics.sql
  
  # 清理临时文件
  rm init_topics.sql
  
  echo -e "${GREEN}初始主题数据添加完成!${NC}"
}

# 初始化内容建议数据
init_content_suggestions() {
  echo -e "${YELLOW}添加内容建议数据...${NC}"
  
  # 创建SQL脚本添加内容建议
  cat > init_suggestions.sql << EOF
-- 清除现有数据
TRUNCATE content_suggestions CASCADE;

-- 添加通用内容建议
INSERT INTO content_suggestions (category, suggestion_type, content, position)
VALUES
-- 科技类
('科技', 'title', '最新科技趋势：[主题]的发展与应用', 1),
('科技', 'title', '[主题]如何改变我们的生活方式', 2),
('科技', 'title', '[主题]的技术突破与未来展望', 3),
('科技', 'outline', '1. [主题]的背景介绍\n2. 当前发展状况\n3. 关键技术分析\n4. 应用场景探讨\n5. 未来发展趋势\n6. 结论与建议', 1),
('科技', 'keyPoint', '[主题]的核心价值在于提升效率和用户体验', 1),
('科技', 'keyPoint', '技术创新是推动[主题]发展的关键驱动力', 2),
('科技', 'introduction', '随着科技的迅猛发展，[主题]正逐渐成为改变人们生活方式的重要力量。本文将深入探讨其发展现状、应用场景及未来趋势。', 1),

-- 财经类
('财经', 'title', '[主题]对经济发展的影响分析', 1),
('财经', 'title', '[主题]：机遇与挑战并存', 2),
('财经', 'title', '解读[主题]背后的经济逻辑', 3),
('财经', 'outline', '1. [主题]的政策背景\n2. 市场现状分析\n3. 经济影响评估\n4. 行业发展机遇\n5. 潜在风险探讨\n6. 发展建议', 1),
('财经', 'keyPoint', '[主题]将为相关产业链带来显著的经济增长点', 1),
('财经', 'keyPoint', '政策支持是[主题]持续发展的重要保障', 2),
('财经', 'introduction', '在全球经济格局不断变化的今天，[主题]作为新兴领域，正展现出强大的发展潜力和经济活力。本文将从多个维度分析其经济影响。', 1),

-- 汽车类
('汽车', 'title', '[主题]引领汽车行业变革新趋势', 1),
('汽车', 'title', '[主题]市场分析：现状与未来展望', 2),
('汽车', 'title', '[主题]如何重塑出行方式与城市生活', 3),
('汽车', 'outline', '1. [主题]发展现状\n2. 市场竞争格局分析\n3. 技术发展路线比较\n4. 消费者需求与痛点\n5. 未来趋势预测\n6. 投资与合作机会', 1),
('汽车', 'keyPoint', '[主题]将加速传统汽车行业的转型升级', 1),
('汽车', 'keyPoint', '政策支持与技术进步是推动[主题]发展的双轮驱动', 2),
('汽车', 'introduction', '随着环保意识的增强和技术的不断突破，[主题]正成为全球汽车产业变革的核心推动力。本文将全面剖析其发展现状、挑战与未来前景。', 1),

-- 教育类
('教育', 'title', '[主题]重构教育生态的新路径', 1),
('教育', 'title', '[主题]的挑战与转型策略分析', 2),
('教育', 'title', '[主题]如何助力教育普惠与创新', 3),
('教育', 'outline', '1. [主题]的发展背景\n2. 行业现状与问题分析\n3. 政策环境解读\n4. 典型案例与模式创新\n5. 转型路径与策略\n6. 未来发展预测', 1),
('教育', 'keyPoint', '[主题]需要找准定位，提供差异化、高质量的教学服务', 1),
('教育', 'keyPoint', '技术与内容的深度融合是[主题]可持续发展的关键', 2),
('教育', 'introduction', '在政策调整与市场变化的双重压力下，[主题]正经历前所未有的深度变革。本文将分析当前形势，探讨有效的转型策略与未来发展方向。', 1),

-- 环保类
('环保', 'title', '[主题]：中国绿色发展的重要里程碑', 1),
('环保', 'title', '深度解析[主题]的实施路径与挑战', 2),
('环保', 'title', '[主题]对产业结构的影响与机遇', 3),
('环保', 'outline', '1. [主题]的政策背景\n2. 国内外实践比较\n3. 重点行业实施路径\n4. 面临的挑战与障碍\n5. 创新技术与解决方案\n6. 投资机会与政策建议', 1),
('环保', 'keyPoint', '[主题]需要全社会共同参与，形成系统性解决方案', 1),
('环保', 'keyPoint', '绿色技术创新是实现[主题]目标的重要支撑', 2),
('环保', 'introduction', '作为应对气候变化的重要举措，[主题]正在全球范围内掀起绿色转型浪潮。本文将详细分析中国在这一领域的政策推进、实施路径以及未来挑战。', 1),

-- 电商类
('电商', 'title', '[主题]重塑电商生态的深远影响', 1),
('电商', 'title', '解读[主题]：规范发展与创新平衡', 2),
('电商', 'title', '[主题]下电商平台的合规与转型之路', 3),
('电商', 'outline', '1. [主题]的出台背景\n2. 主要内容与变化点\n3. 对平台的影响分析\n4. 对商家的影响分析\n5. 行业转型与合规路径\n6. 未来发展趋势预测', 1),
('电商', 'keyPoint', '[主题]将促进电商行业更加健康、规范地发展', 1),
('电商', 'keyPoint', '平台与商家需建立新型合作关系以适应[主题]要求', 2),
('电商', 'introduction', '随着电子商务在国民经济中的地位日益提升，[主题]的出台标志着行业监管进入新阶段。本文将深入解读政策内容，分析其对行业各参与方的影响和应对策略。', 1);

-- 为每个主题关联内容建议
-- 元宇宙主题
WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%元宇宙%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'title',
  '元宇宙时代：数字与现实的融合之路',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%元宇宙%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'outline',
  '1. 元宇宙的概念与发展历程\n2. 元宇宙的技术基础：VR/AR、区块链、人工智能\n3. 元宇宙的应用场景分析\n4. 巨头布局与商业模式创新\n5. 元宇宙发展面临的挑战\n6. 未来展望与投资机会',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%元宇宙%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'keyPoint',
  '元宇宙不仅是技术创新，更是社会交互方式的革命性变革',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%元宇宙%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'introduction',
  '元宇宙作为数字世界的下一个前沿，正在重新定义人们的社交、工作和娱乐方式。本文将探讨元宇宙的发展现状、关键技术和未来可能的演变路径。',
  10;

-- 数字人民币主题
WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%数字人民币%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '财经',
  'title',
  '数字人民币：中国支付体系的创新升级',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%数字人民币%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '财经',
  'outline',
  '1. 数字人民币的定位与特点\n2. 试点进展与应用场景\n3. 与现有支付方式的差异\n4. 对金融体系的影响\n5. 对个人和企业的意义\n6. 未来发展方向与国际化展望',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%数字人民币%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '财经',
  'keyPoint',
  '数字人民币的推广将重塑中国数字经济生态，提升支付效率和普惠性',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%数字人民币%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '财经',
  'introduction',
  '数字人民币作为中国法定数字货币，其试点范围不断扩大，正逐步改变人们的支付习惯和金融体验。本文将分析其推广现状、技术特点和未来影响。',
  10;

-- 新能源汽车主题
WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%新能源汽车%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '汽车',
  'title',
  '新能源汽车销量爆发：产业变革的加速期',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%新能源汽车%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '汽车',
  'outline',
  '1. 新能源汽车销量创新高的市场背景\n2. 中国与全球市场对比分析\n3. 传统车企与新势力的竞争格局\n4. 技术路线与成本结构分析\n5. 充电基础设施建设进展\n6. 未来三年市场预测',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%新能源汽车%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '汽车',
  'keyPoint',
  '消费者认可度提升和续航里程突破是推动新能源汽车销量增长的关键因素',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%新能源汽车%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '汽车',
  'introduction',
  '2023年新能源汽车市场迎来爆发式增长，多家车企销量创下历史新高，标志着行业发展进入新阶段。本文将从多个维度剖析这一现象背后的驱动因素与未来趋势。',
  10;

-- AI绘画主题
WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%AI绘画%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'title',
  'AI绘画与版权：技术创新与法律边界的碰撞',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%AI绘画%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'outline',
  '1. AI绘画技术的发展与突破\n2. 版权争议的主要焦点\n3. 国内外相关案例分析\n4. 艺术创作者的权益保护\n5. 现有法律框架的局限\n6. 平衡创新与保护的未来路径',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%AI绘画%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'keyPoint',
  'AI绘画引发的版权争议反映了技术发展与法律演进的不同步，需要新的规则框架',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%AI绘画%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'introduction',
  'AI绘画技术的飞速发展正在改变创意产业的生产方式，同时也带来了关于创作者权益、原创性定义和版权归属的一系列法律与伦理争议。本文将深入探讨这一新兴技术与现有版权体系的复杂关系。',
  10;

-- 芯片短缺主题
WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%芯片短缺%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'title',
  '全球芯片短缺：供应链危机的深层解析',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%芯片短缺%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'outline',
  '1. 芯片短缺的形成原因\n2. 受影响行业与损失评估\n3. 全球半导体产业链布局\n4. 地缘政治因素分析\n5. 企业应对策略\n6. 长期解决方案与行业展望',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%芯片短缺%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'keyPoint',
  '芯片短缺问题暴露了全球供应链的脆弱性，推动各国加速半导体产业的本土化',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%芯片短缺%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '科技',
  'introduction',
  '全球芯片短缺问题持续深化，从汽车到消费电子，多个行业生产受到严重影响。本文将分析这一供应链危机的成因、影响范围以及可能的解决路径。',
  10;

-- 在线教育主题
WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%在线教育%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '教育',
  'title',
  '在线教育深度调整：转型、整合与新机遇',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%在线教育%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '教育',
  'outline',
  '1. 在线教育行业遭遇的政策与市场变化\n2. 主要企业的转型路径分析\n3. 资本市场反应与融资环境\n4. 行业整合与并购机会\n5. 产品创新与差异化战略\n6. 未来发展前景与投资价值',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%在线教育%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '教育',
  'keyPoint',
  '在线教育行业进入调整期后，商业模式创新与教学质量提升成为企业生存的关键',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%在线教育%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '教育',
  'introduction',
  '在一系列监管政策出台后，中国在线教育行业正经历前所未有的深度调整。本文将分析行业现状，探讨头部企业的转型策略，并展望未来发展方向。',
  10;

-- 碳达峰碳中和主题
WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%碳达峰碳中和%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '环保',
  'title',
  '碳达峰碳中和：中国绿色转型的路线图与进展',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%碳达峰碳中和%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '环保',
  'outline',
  '1. 碳达峰碳中和的政策背景与目标\n2. 重点行业减排路径分析\n3. 地方政府推进策略对比\n4. 碳交易市场建设进展\n5. 绿色技术创新与投资机会\n6. 国际合作与全球气候治理',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%碳达峰碳中和%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '环保',
  'keyPoint',
  '实现碳达峰碳中和目标需要能源结构转型、产业升级和技术创新三管齐下',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%碳达峰碳中和%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '环保',
  'introduction',
  '碳达峰碳中和已成为中国经济社会发展的重大战略，各地各行业正积极推进相关政策落地。本文将分析目前的推进情况、面临的挑战以及未来的发展方向。',
  10;

-- 直播电商主题
WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%直播电商%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '电商',
  'title',
  '直播电商新规：行业规范化发展的转折点',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%直播电商%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '电商',
  'outline',
  '1. 直播电商新规的核心内容解读\n2. 对平台责任与主播行为的约束\n3. 消费者权益保护强化措施\n4. 广告与商品宣传的合规要求\n5. 行业洗牌与格局重塑预测\n6. 企业应对策略建议',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%直播电商%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '电商',
  'keyPoint',
  '直播电商新规旨在规范行业发展，从野蛮生长转向可持续健康发展模式',
  10;

WITH target_topic AS (SELECT id FROM topics WHERE title LIKE '%直播电商%')
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
  (SELECT id FROM target_topic),
  '电商',
  'introduction',
  '随着直播电商规模的快速扩大，监管政策逐步完善，新出台的监管规定将对行业格局产生深远影响。本文将详细解读政策内容，分析其对平台、主播和品牌方的影响与应对之道。',
  10;

-- 统计和显示添加的内容建议
SELECT t.title, COUNT(cs.id) AS suggestion_count 
FROM topics t 
LEFT JOIN content_suggestions cs ON t.id = cs.topic_id 
GROUP BY t.id, t.title
ORDER BY suggestion_count DESC;
EOF

  # 执行SQL脚本
  docker exec -i postgres-local psql -U postgres -d heatsight_dev -f - < init_suggestions.sql
  
  # 清理临时文件
  rm init_suggestions.sql
  
  echo -e "${GREEN}内容建议数据添加完成!${NC}"
}

# 更新主题内容关联
update_topic_content_links() {
  echo -e "${YELLOW}更新主题-内容建议关联...${NC}"
  
  # 创建SQL脚本更新关联
  cat > update_links.sql << EOF
-- 使用子查询和内联视图为每个主题关联内容建议
-- 元宇宙主题关联
WITH target_suggestions AS (
    SELECT id FROM content_suggestions
    WHERE (
        (category = '科技' AND suggestion_type IN ('title', 'outline', 'keyPoint', 'introduction') AND random() < 0.7)
        OR content LIKE '%元宇宙%'
        OR content LIKE '%虚拟现实%'
        OR content LIKE '%VR%'
        OR content LIKE '%AR%'
    )
    AND topic_id IS NULL
    LIMIT 7
)
UPDATE content_suggestions
SET topic_id = (SELECT id FROM topics WHERE title LIKE '%元宇宙%' LIMIT 1)
WHERE id IN (SELECT id FROM target_suggestions);

-- 数字人民币主题关联
WITH target_suggestions AS (
    SELECT id FROM content_suggestions
    WHERE (
        (category = '财经' AND suggestion_type IN ('title', 'outline', 'keyPoint', 'introduction') AND random() < 0.7)
        OR content LIKE '%数字人民币%'
        OR content LIKE '%央行数字货币%'
        OR content LIKE '%CBDC%'
        OR content LIKE '%支付%'
    )
    AND topic_id IS NULL
    LIMIT 7
)
UPDATE content_suggestions
SET topic_id = (SELECT id FROM topics WHERE title LIKE '%数字人民币%' LIMIT 1)
WHERE id IN (SELECT id FROM target_suggestions);

-- 新能源汽车主题关联
WITH target_suggestions AS (
    SELECT id FROM content_suggestions
    WHERE (
        (category = '汽车' AND suggestion_type IN ('title', 'outline', 'keyPoint', 'introduction') AND random() < 0.7)
        OR content LIKE '%新能源%'
        OR content LIKE '%电动汽车%'
        OR content LIKE '%充电%'
        OR content LIKE '%续航%'
    )
    AND topic_id IS NULL
    LIMIT 7
)
UPDATE content_suggestions
SET topic_id = (SELECT id FROM topics WHERE title LIKE '%新能源汽车%' LIMIT 1)
WHERE id IN (SELECT id FROM target_suggestions);

-- AI绘画主题关联
WITH target_suggestions AS (
    SELECT id FROM content_suggestions
    WHERE (
        (category = '科技' AND suggestion_type IN ('title', 'outline', 'keyPoint', 'introduction') AND random() < 0.7)
        OR content LIKE '%AI%'
        OR content LIKE '%人工智能%'
        OR content LIKE '%版权%'
        OR content LIKE '%绘画%'
    )
    AND topic_id IS NULL
    LIMIT 7
)
UPDATE content_suggestions
SET topic_id = (SELECT id FROM topics WHERE title LIKE '%AI绘画%' LIMIT 1)
WHERE id IN (SELECT id FROM target_suggestions);

-- 芯片短缺主题关联
WITH target_suggestions AS (
    SELECT id FROM content_suggestions
    WHERE (
        (category = '科技' AND suggestion_type IN ('title', 'outline', 'keyPoint', 'introduction') AND random() < 0.7)
        OR content LIKE '%芯片%'
        OR content LIKE '%半导体%'
        OR content LIKE '%供应链%'
        OR content LIKE '%短缺%'
    )
    AND topic_id IS NULL
    LIMIT 7
)
UPDATE content_suggestions
SET topic_id = (SELECT id FROM topics WHERE title LIKE '%芯片短缺%' LIMIT 1)
WHERE id IN (SELECT id FROM target_suggestions);

-- 在线教育主题关联
WITH target_suggestions AS (
    SELECT id FROM content_suggestions
    WHERE (
        (category = '教育' AND suggestion_type IN ('title', 'outline', 'keyPoint', 'introduction') AND random() < 0.7)
        OR content LIKE '%在线教育%'
        OR content LIKE '%教育平台%'
        OR content LIKE '%培训%'
        OR content LIKE '%课程%'
    )
    AND topic_id IS NULL
    LIMIT 7
)
UPDATE content_suggestions
SET topic_id = (SELECT id FROM topics WHERE title LIKE '%在线教育%' LIMIT 1)
WHERE id IN (SELECT id FROM target_suggestions);

-- 碳达峰碳中和主题关联
WITH target_suggestions AS (
    SELECT id FROM content_suggestions
    WHERE (
        (category = '环保' AND suggestion_type IN ('title', 'outline', 'keyPoint', 'introduction') AND random() < 0.7)
        OR content LIKE '%碳达峰%'
        OR content LIKE '%碳中和%'
        OR content LIKE '%低碳%'
        OR content LIKE '%绿色发展%'
    )
    AND topic_id IS NULL
    LIMIT 7
)
UPDATE content_suggestions
SET topic_id = (SELECT id FROM topics WHERE title LIKE '%碳达峰碳中和%' LIMIT 1)
WHERE id IN (SELECT id FROM target_suggestions);

-- 直播电商主题关联
WITH target_suggestions AS (
    SELECT id FROM content_suggestions
    WHERE (
        (category = '电商' AND suggestion_type IN ('title', 'outline', 'keyPoint', 'introduction') AND random() < 0.7)
        OR content LIKE '%直播%'
        OR content LIKE '%电商%'
        OR content LIKE '%带货%'
        OR content LIKE '%主播%'
    )
    AND topic_id IS NULL
    LIMIT 7
)
UPDATE content_suggestions
SET topic_id = (SELECT id FROM topics WHERE title LIKE '%直播电商%' LIMIT 1)
WHERE id IN (SELECT id FROM target_suggestions);

-- 统计和显示更新后的关联
SELECT t.title, COUNT(cs.id) AS suggestion_count 
FROM topics t 
LEFT JOIN content_suggestions cs ON t.id = cs.topic_id 
GROUP BY t.id, t.title
ORDER BY suggestion_count DESC;
EOF

  # 执行SQL脚本
  docker exec -i postgres-local psql -U postgres -d heatsight_dev -f - < update_links.sql
  
  # 清理临时文件
  rm update_links.sql
  
  echo -e "${GREEN}主题-内容建议关联更新完成!${NC}"
}

# 停止数据库服务
stop_db_services() {
  echo -e "${YELLOW}停止PostgreSQL数据库服务...${NC}"
  # 只停止PostgreSQL服务，不影响Redis相关服务和PGAdmin
  docker stop postgres-local
  echo -e "${GREEN}PostgreSQL数据库服务已停止${NC}"
}

# 清理数据库数据
clean_db_data() {
  echo -e "${RED}警告: 这将删除heatsight_dev数据库及其数据!${NC}"
  echo -e "${YELLOW}确认删除? (y/n)${NC}"
  read -r CONFIRM
  
  if [[ $CONFIRM =~ ^[Yy]$ ]]; then
    # 检查PostgreSQL容器是否运行
    if docker ps | grep -q "postgres-local"; then
      echo -e "${YELLOW}PostgreSQL容器正在运行，继续操作...${NC}"
      
      # 删除heatsight_dev数据库
      echo -e "${YELLOW}删除heatsight_dev数据库...${NC}"
      if docker exec postgres-local psql -U postgres -c "DROP DATABASE IF EXISTS heatsight_dev WITH (FORCE);" 2>/dev/null; then
        echo -e "${GREEN}heatsight_dev数据库已成功删除${NC}"
      else
        echo -e "${RED}删除heatsight_dev数据库失败${NC}"
        echo -e "${YELLOW}可能需要先断开所有连接，正在尝试断开连接...${NC}"
        
        # 尝试断开所有到heatsight_dev的连接
        docker exec postgres-local psql -U postgres -c "
          SELECT pg_terminate_backend(pid) 
          FROM pg_stat_activity 
          WHERE datname = 'heatsight_dev' AND pid <> pg_backend_pid();
        " 2>/dev/null
        
        # 再次尝试删除数据库
        if docker exec postgres-local psql -U postgres -c "DROP DATABASE IF EXISTS heatsight_dev WITH (FORCE);" 2>/dev/null; then
          echo -e "${GREEN}heatsight_dev数据库已成功删除${NC}"
        else
          echo -e "${RED}删除heatsight_dev数据库失败，可能需要手动操作${NC}"
          return 1
        fi
      fi
      
      # 重新创建一个空的heatsight_dev数据库
      echo -e "${YELLOW}创建新的空heatsight_dev数据库...${NC}"
      if docker exec postgres-local createdb -U postgres heatsight_dev 2>/dev/null; then
        echo -e "${GREEN}新的heatsight_dev数据库已创建${NC}"
      else
        echo -e "${RED}创建新的heatsight_dev数据库失败${NC}"
        return 1
      fi
      
      echo -e "${GREEN}heatsight_dev数据库清理完成${NC}"
      echo -e "${YELLOW}注意: PostgreSQL容器和其他数据库未被删除或修改${NC}"
    else
      echo -e "${YELLOW}PostgreSQL容器未运行，请先启动数据库服务${NC}"
      return 1
    fi
  else
    echo -e "${YELLOW}操作已取消${NC}"
  fi
}

# 显示数据库状态
show_db_status() {
  # 获取实际使用的端口
  PGADMIN_PORT=$(docker ps | grep "pgadmin-local" | grep -o "0.0.0.0:[0-9]*->80/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "5050")
  REDIS_COMMANDER_PORT=$(docker ps | grep -e "redis-commander-local\|rediscommander" | grep -o "0.0.0.0:[0-9]*->8081/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "8081")
  POSTGRES_PORT=$(docker ps | grep "postgres-local" | grep -o "0.0.0.0:[0-9]*->5432/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "5432")
  REDIS_PORT=$(docker ps | grep "redis-local " | grep -o "0.0.0.0:[0-9]*->6379/tcp" | cut -d':' -f2 | cut -d'-' -f1 || echo "6379")
  
  # 如果未检测到Redis，尝试查找其他Redis容器
  if [ -z "$REDIS_PORT" ]; then
    REDIS_PORT=$(docker ps | grep -e "redis" | grep -v "redis-commander\|rediscommander" | grep -o "0.0.0.0:[0-9]*->6379/tcp" | head -1 | cut -d':' -f2 | cut -d'-' -f1 || echo "6380")
  fi
  
  # 如果未检测到Redis Commander，尝试查找其他Redis Commander容器
  if [ -z "$REDIS_COMMANDER_PORT" ]; then
    REDIS_COMMANDER_PORT=$(docker ps | grep -e "redis-commander\|rediscommander" | grep -o "0.0.0.0:[0-9]*->8081/tcp" | head -1 | cut -d':' -f2 | cut -d'-' -f1 || echo "8081")
  fi

  echo -e "${YELLOW}数据库服务状态:${NC}"
  docker compose ps postgres redis redis-commander pgadmin
  
  # 显示PostgreSQL连接信息
  echo -e "\n${YELLOW}PostgreSQL连接信息:${NC}"
  echo -e "数据库主机: ${GREEN}localhost:${POSTGRES_PORT}${NC}"
  echo -e "数据库用户: ${GREEN}postgres${NC}"
  echo -e "数据库密码: ${GREEN}postgres${NC}"
  echo -e "数据库名称: ${GREEN}heatsight_dev${NC}"
  
  # 显示Redis和Redis Commander信息
  echo -e "\n${YELLOW}Redis和Redis Commander访问信息:${NC}"
  echo -e "Redis主机: ${GREEN}localhost:${REDIS_PORT}${NC}"
  echo -e "Redis Commander: ${GREEN}http://localhost:${REDIS_COMMANDER_PORT}${NC}"
  echo -e "Redis Commander登录用户: ${GREEN}admin${NC}"
  echo -e "Redis Commander登录密码: ${GREEN}admin${NC}"
  
  # 显示PGAdmin信息
  echo -e "\n${YELLOW}PGAdmin访问信息:${NC}"
  echo -e "网址: ${GREEN}http://localhost:${PGADMIN_PORT}${NC}"
  echo -e "登录邮箱: ${GREEN}losesky@gmail.com${NC}"
  echo -e "登录密码: ${GREEN}admin${NC}"
  
  # 检查PostgreSQL服务是否可访问
  if ! docker exec postgres-local pg_isready -q; then
    echo -e "\n${RED}无法连接到PostgreSQL服务，请确保服务已启动${NC}"
    return 1
  fi
  
  # 检查heatsight_dev数据库是否存在 - 直接尝试连接
  if ! docker exec postgres-local psql -U postgres -d heatsight_dev -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "\n${RED}数据库 'heatsight_dev' 不存在或无法连接，请先初始化数据库${NC}"
    return 1
  fi
  
  echo -e "\n${YELLOW}主题数据统计:${NC}"
  if ! docker exec postgres-local psql -U postgres -d heatsight_dev -c "SELECT COUNT(*) AS total_topics FROM topics;" 2>/dev/null; then
    echo -e "${RED}无法查询 topics 表，请确保表已创建${NC}"
  fi
  
  echo -e "\n${YELLOW}内容建议数据统计:${NC}"
  if ! docker exec postgres-local psql -U postgres -d heatsight_dev -c "SELECT COUNT(*) AS total_suggestions FROM content_suggestions;" 2>/dev/null; then
    echo -e "${RED}无法查询 content_suggestions 表，请确保表已创建${NC}"
  fi
  
  echo -e "\n${YELLOW}主题-内容建议关联统计:${NC}"
  if ! docker exec postgres-local psql -U postgres -d heatsight_dev -c "SELECT t.title, COUNT(cs.id) AS suggestion_count FROM topics t LEFT JOIN content_suggestions cs ON t.id = cs.topic_id GROUP BY t.id, t.title ORDER BY suggestion_count DESC;" 2>/dev/null; then
    echo -e "${RED}无法查询主题-内容建议关联，请确保相关表已创建${NC}"
  fi
}

# 初始化所有数据（主题+内容建议+关联）
init_all_data() {
  echo -e "${YELLOW}一键初始化所有数据...${NC}"
  
  # 依次执行三个初始化函数
  init_topic_data
  init_content_suggestions
  update_topic_content_links
  
  echo -e "${GREEN}所有数据初始化完成!${NC}"
  return 0
}

# 主菜单
main_menu() {
  local choice
  
  while true; do
    print_title
    echo -e "${YELLOW}主菜单${NC}\n"
    echo -e "1) ${GREEN}启动数据库服务${NC}"
    echo -e "2) ${GREEN}初始化数据库结构${NC}"
    echo -e "3) ${CYAN}初始化所有数据${NC} (主题+内容建议+关联)"
    echo -e "4) ${CYAN}查看数据库状态${NC}"
    echo -e "5) ${RED}停止数据库服务${NC}"
    echo -e "6) ${RED}清理数据库数据${NC}"
    echo -e "0) ${RED}退出程序${NC}"
    echo
    read -p "请选择操作 [0-9]: " choice
    
    case $choice in
      1) 
        start_db_services
        echo -e "\n${YELLOW}按任意键继续...${NC}"
        read -n1
        ;;
      2) 
        init_db_structure
        echo -e "\n${YELLOW}按任意键继续...${NC}"
        read -n1
        ;;
      3) 
        init_all_data
        echo -e "\n${YELLOW}按任意键继续...${NC}"
        read -n1
        ;;
      4) 
        show_db_status
        echo -e "\n${YELLOW}按任意键继续...${NC}"
        read -n1
        ;;
      5) 
        stop_db_services
        echo -e "\n${YELLOW}按任意键继续...${NC}"
        read -n1
        ;;
      6) 
        clean_db_data
        echo -e "\n${YELLOW}按任意键继续...${NC}"
        read -n1
        ;;
      0) 
        echo -e "\n${GREEN}感谢使用HeatSight数据库管理工具，再见！${NC}"
        exit 0
        ;;
      *) 
        echo -e "${RED}无效选择，请重新输入${NC}"
        sleep 1
        ;;
    esac
  done
}

# 快速初始化（无需菜单）
quick_init() {
  if ! check_prerequisites; then
    exit 1
  fi
  
  if ! start_db_services; then
    exit 1
  fi
  
  # 检查Python依赖
  if ! check_python_dependencies; then
    echo -e "${RED}无法继续，缺少必要的Python依赖。${NC}"
    exit 1
  fi
  
  if ! init_db_structure; then
    exit 1
  fi
  
  echo -e "${YELLOW}是否初始化所有数据? (主题+内容建议+关联) (y/n)${NC}"
  read -r INIT_ALL
  if [[ $INIT_ALL =~ ^[Yy]$ ]]; then
    init_all_data
  fi
  
  show_db_status
  
  echo -e "\n${GREEN}数据库初始化完成!${NC}"
  exit 0
}

# 主程序入口
main() {
  if ! check_prerequisites; then
    echo -e "${RED}请先安装Docker并确保配置正确${NC}"
    exit 1
  fi
  
  # 判断是否使用快速初始化模式
  if [ "$1" = "--quick" ]; then
    quick_init
  else
    main_menu
  fi
}

# 脚本参数处理
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo -e "HeatSight数据库管理工具"
  echo -e "用法:"
  echo -e "  $0                 启动交互式菜单"
  echo -e "  $0 --quick         快速初始化数据库"
  echo -e "  $0 --help          显示帮助信息"
  exit 0
fi

# 执行主程序
main "$@" 