-- 创建主题表
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    source_name VARCHAR(100),
    category VARCHAR(50),
    published_at TIMESTAMP DEFAULT NOW(),
    url VARCHAR(512),
    image_url VARCHAR(512),
    heat FLOAT DEFAULT 0,
    extra JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建内容建议表
CREATE TABLE IF NOT EXISTS content_suggestions (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    suggestion_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建新闻热度评分表
CREATE TABLE IF NOT EXISTS news_heat_scores (
    id VARCHAR PRIMARY KEY,
    news_id VARCHAR NOT NULL,
    source_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    url VARCHAR NOT NULL,
    heat_score FLOAT NOT NULL,
    relevance_score FLOAT,
    recency_score FLOAT,
    popularity_score FLOAT,
    meta_data JSONB,
    keywords JSONB,
    calculated_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS topics_category_idx ON topics(category);
CREATE INDEX IF NOT EXISTS topics_heat_idx ON topics(heat DESC);
CREATE INDEX IF NOT EXISTS content_suggestions_category_idx ON content_suggestions(category);
CREATE INDEX IF NOT EXISTS content_suggestions_topic_id_idx ON content_suggestions(topic_id);
CREATE INDEX IF NOT EXISTS idx_news_heat_scores_news_id ON news_heat_scores (news_id);
CREATE INDEX IF NOT EXISTS idx_news_heat_scores_source_id ON news_heat_scores (source_id);
CREATE INDEX IF NOT EXISTS idx_news_heat_scores_heat_score ON news_heat_scores (heat_score);
CREATE INDEX IF NOT EXISTS idx_news_heat_scores_published_at ON news_heat_scores (published_at);
