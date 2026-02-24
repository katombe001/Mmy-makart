-- PostgreSQL schema for Kinetic Swarm
-- Run: psql -f database.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- For UUID generation: O(1)

-- Users table: O(log n) lookup by email with B-tree index
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,  -- Unique index: O(log n)
    username VARCHAR(50) UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    
    -- Index for recent users query: O(log n)
    CONSTRAINT idx_users_created_at DESC (created_at)
);

-- Words library: O(log n) search with trigram index for fuzzy matching
CREATE TABLE words (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    word VARCHAR(100) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_curated BOOLEAN DEFAULT FALSE,
    difficulty INT CHECK (difficulty BETWEEN 1 AND 10),
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- B-tree index for exact match: O(log n)
    CONSTRAINT idx_words_word UNIQUE (word),
    -- Partial index for curated words: faster filtered queries
    CONSTRAINT idx_words_curated WHERE is_curated = true
);

-- GIN index for fast text search (if needed): O(log n) with posting lists
CREATE INDEX idx_words_trgm ON words USING gin(word gin_trgm_ops);

-- Rooms: O(log n) lookup by ID (UUID)
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100),
    created_by UUID REFERENCES users(id),
    max_users INT DEFAULT 10 CHECK (max_users > 0 AND max_users <= 100),
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- Index for active rooms query: O(log n)
    CONSTRAINT idx_rooms_active WHERE ended_at IS NULL
);

-- Room participants: O(1) with composite PK, O(log n) for room queries
CREATE TABLE room_participants (
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    
    PRIMARY KEY (room_id, user_id, joined_at),  -- Composite index
    CONSTRAINT idx_participants_user (user_id)  -- For user's room history
);

-- Word formations (analytics): O(log n) with time-based partitioning
CREATE TABLE word_formations (
    id BIGSERIAL,
    room_id UUID REFERENCES rooms(id),
    user_id UUID REFERENCES users(id),
    word VARCHAR(100) NOT NULL,
    formed_at TIMESTAMPTZ DEFAULT NOW(),
    letter_positions JSONB,  -- O(1) access to nested data
    
    -- Partition by month for query performance: O(log n) per partition
    PRIMARY KEY (id, formed_at)
) PARTITION BY RANGE (formed_at);

-- Create monthly partitions (automate in production)
CREATE TABLE word_formations_2024_01 PARTITION OF word_formations
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE word_formations_2024_02 PARTITION OF word_formations
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Recordings: O(1) lookup by S3 key
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id),
    created_by UUID REFERENCES users(id),
    s3_key TEXT NOT NULL,  -- O(1) S3 lookup
    duration_seconds INT,
    file_size_bytes BIGINT,
    status VARCHAR(20) DEFAULT 'processing',  -- processing, ready, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Insert sample curated words: O(log n) per insert
INSERT INTO words (word, is_curated, difficulty) VALUES
    ('REACT', true, 3),
    ('SWARM', true, 4),
    ('PHYSICS', true, 5),
    ('CODE', true, 2),
    ('CREATE', true, 3),
    ('FLOW', true, 3),
    ('VELOCITY', true, 6),
    ('MOMENTUM', true, 7),
    ('GRAVITY', true, 5),
    ('PARTICLE', true, 6);