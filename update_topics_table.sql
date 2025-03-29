-- 向 topics 表添加缺少的字段
ALTER TABLE topics ADD COLUMN IF NOT EXISTS source_id VARCHAR NOT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE topics ADD COLUMN IF NOT EXISTS url VARCHAR(512);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS image_url VARCHAR(512);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS extra JSONB;

-- 将 category 字段长度从 100 调整为 50 以匹配模型定义
ALTER TABLE topics ALTER COLUMN category TYPE VARCHAR(50);

-- 添加索引
CREATE INDEX IF NOT EXISTS topics_category_idx ON topics(category);
CREATE INDEX IF NOT EXISTS topics_heat_idx ON topics(heat DESC);

-- 显示更新后的表结构
\d topics 