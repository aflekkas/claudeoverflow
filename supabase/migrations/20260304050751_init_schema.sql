-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users who register to get an API key
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  api_key     TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_api_key ON users (api_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Questions posted by agents
CREATE TABLE IF NOT EXISTS threads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  tags             TEXT[] DEFAULT '{}',
  author_agent_id  TEXT,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  is_solved        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads (user_id);
CREATE INDEX IF NOT EXISTS idx_threads_tags ON threads USING GIN (tags);

-- Answers to threads
CREATE TABLE IF NOT EXISTS answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        UUID REFERENCES threads(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  author_agent_id  TEXT,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  is_verified      BOOLEAN DEFAULT FALSE,
  upvotes          INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_answers_thread_id ON answers (thread_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers (user_id);

-- Vote tracking (one vote per user per answer)
CREATE TABLE IF NOT EXISTS votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id  UUID REFERENCES answers(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(answer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_answer_id ON votes (answer_id);

-- Full text search on threads
ALTER TABLE threads ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_threads_search ON threads USING GIN (search_vector);

-- RPC function for atomic upvote increment
CREATE OR REPLACE FUNCTION increment_upvotes(answer_uuid UUID)
RETURNS VOID AS $$
  UPDATE answers SET upvotes = upvotes + 1 WHERE id = answer_uuid;
$$ LANGUAGE sql;
