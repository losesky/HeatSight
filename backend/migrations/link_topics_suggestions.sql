-- 为每个主题创建一套特定的内容建议

-- 清除现有关联，重新开始
UPDATE content_suggestions SET topic_id = NULL;

-- 1. 首先获取所有主题ID和类别
CREATE TEMP TABLE topic_info AS
SELECT id, category, title FROM topics;

-- 2. 按类别为每个主题关联内容建议
DO $$
DECLARE
    topic_rec RECORD;
    limit_count INTEGER;
BEGIN
    -- 处理每个科技类主题
    FOR topic_rec IN SELECT id, title FROM topics WHERE category = '科技' LOOP
        -- 为每个科技主题关联title建议
        limit_count := floor(random() * 2) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = '科技' 
            AND suggestion_type = 'title'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个科技主题关联outline建议
        limit_count := floor(random() * 3) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = '科技' 
            AND suggestion_type = 'outline'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个科技主题关联keyPoint建议
        limit_count := floor(random() * 2) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = '科技' 
            AND suggestion_type = 'keyPoint'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个科技主题关联introduction建议
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = '科技' 
            AND suggestion_type = 'introduction'
            AND topic_id IS NULL
            LIMIT 1
        );
    END LOOP;
    
    -- 处理每个财经类主题
    FOR topic_rec IN SELECT id, title FROM topics WHERE category = '财经' LOOP
        -- 为每个财经主题关联title建议
        limit_count := floor(random() * 2) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = '财经' 
            AND suggestion_type = 'title'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个财经主题关联outline建议
        limit_count := floor(random() * 3) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = '财经' 
            AND suggestion_type = 'outline'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个财经主题关联keyPoint建议
        limit_count := floor(random() * 2) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = '财经' 
            AND suggestion_type = 'keyPoint'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个财经主题关联introduction建议
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = '财经' 
            AND suggestion_type = 'introduction'
            AND topic_id IS NULL
            LIMIT 1
        );
    END LOOP;
    
    -- 为其他类别的主题关联默认建议
    FOR topic_rec IN SELECT id, title FROM topics WHERE category NOT IN ('科技', '财经') LOOP
        -- 为每个其他主题关联title建议
        limit_count := floor(random() * 2) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = 'default' 
            AND suggestion_type = 'title'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个其他主题关联outline建议
        limit_count := floor(random() * 3) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = 'default' 
            AND suggestion_type = 'outline'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个其他主题关联keyPoint建议
        limit_count := floor(random() * 2) + 1;
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = 'default' 
            AND suggestion_type = 'keyPoint'
            AND topic_id IS NULL
            LIMIT limit_count
        );
        
        -- 为每个其他主题关联introduction建议
        UPDATE content_suggestions
        SET topic_id = topic_rec.id
        WHERE id IN (
            SELECT id FROM content_suggestions
            WHERE category = 'default' 
            AND suggestion_type = 'introduction'
            AND topic_id IS NULL
            LIMIT 1
        );
    END LOOP;
END $$;

-- 4. 为特定主题创建定制内容建议
-- 为"元宇宙"主题添加专属内容建议
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
    id AS topic_id, 
    '科技' AS category,
    'title' AS suggestion_type,
    '元宇宙时代：重塑数字体验与商业模式' AS content,
    10 AS position
FROM topics 
WHERE title LIKE '%元宇宙%';

INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
    id AS topic_id, 
    '科技' AS category,
    'keyPoint' AS suggestion_type,
    '元宇宙将重塑人们工作、社交、娱乐和学习的方式' AS content,
    10 AS position
FROM topics 
WHERE title LIKE '%元宇宙%';

-- 为"数字人民币"主题添加专属内容建议
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
    id AS topic_id, 
    '财经' AS category,
    'title' AS suggestion_type,
    '数字人民币：中国数字经济的新引擎' AS content,
    10 AS position
FROM topics 
WHERE title LIKE '%数字人民币%';

INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
    id AS topic_id, 
    '财经' AS category,
    'introduction' AS suggestion_type,
    '数字人民币作为央行数字货币的探索实践，正在以前所未有的速度拓展其应用场景。本文深入分析数字人民币的技术特点、试点进展以及对未来金融格局的影响，探讨其在推动普惠金融、提升支付效率等方面的潜力。' AS content,
    10 AS position
FROM topics 
WHERE title LIKE '%数字人民币%';

-- 为"新能源汽车"主题添加专属内容建议
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
    id AS topic_id, 
    'default' AS category,
    'title' AS suggestion_type,
    '新能源汽车：驱动绿色出行革命的关键力量' AS content,
    10 AS position
FROM topics 
WHERE title LIKE '%新能源车%';

-- 为"AI绘画"主题添加专属内容建议
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
    id AS topic_id, 
    'default' AS category,
    'introduction' AS suggestion_type,
    'AI绘画技术的快速发展正在重新定义创意产业。本文探讨AI绘画背后的核心技术、创作流程以及对艺术领域的影响，同时深入分析版权保护等相关争议问题，为读者提供全面了解这一创新技术的视角。' AS content,
    10 AS position
FROM topics 
WHERE title LIKE '%AI绘画%';

-- 为"在线教育"主题添加专属内容建议
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
    id AS topic_id, 
    'default' AS category,
    'outline' AS suggestion_type,
    '1. 在线教育市场现状分析\n2. 主要平台业务调整方向\n3. 监管政策对行业的影响\n4. 细分领域机会与挑战\n5. 行业未来发展趋势预测' AS content,
    10 AS position
FROM topics 
WHERE title LIKE '%在线教育%';

-- 为"农产品电商"主题添加专属内容建议
INSERT INTO content_suggestions (topic_id, category, suggestion_type, content, position)
SELECT 
    id AS topic_id, 
    'default' AS category,
    'keyPoint' AS suggestion_type,
    '农产品电商平台正在通过数字化手段重塑传统农业供应链，实现优质农产品的高效流通' AS content,
    10 AS position
FROM topics 
WHERE title LIKE '%农产品电商%';

-- 统计关联结果
SELECT 'topics' AS table_name, count(*) AS total_count FROM topics
UNION ALL
SELECT 'content_suggestions (total)' AS table_name, count(*) AS total_count FROM content_suggestions
UNION ALL
SELECT 'content_suggestions (linked)' AS table_name, count(*) AS total_count FROM content_suggestions WHERE topic_id IS NOT NULL;
