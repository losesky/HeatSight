-- Create news_heat_scores table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_news_heat_scores_news_id ON news_heat_scores (news_id);
CREATE INDEX IF NOT EXISTS idx_news_heat_scores_source_id ON news_heat_scores (source_id);
CREATE INDEX IF NOT EXISTS idx_news_heat_scores_heat_score ON news_heat_scores (heat_score);
CREATE INDEX IF NOT EXISTS idx_news_heat_scores_published_at ON news_heat_scores (published_at);

-- Add comment
COMMENT ON TABLE news_heat_scores IS 'Stores news heat scores calculated by the NewsHeatScore system'; 