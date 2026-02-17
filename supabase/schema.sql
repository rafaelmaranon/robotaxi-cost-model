-- Create chat_events table for rate limiting and chat storage
CREATE TABLE IF NOT EXISTS chat_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  sim_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient rate limiting queries
CREATE INDEX IF NOT EXISTS idx_chat_events_session_created 
ON chat_events (session_id, created_at);

-- Create index for session-based queries
CREATE INDEX IF NOT EXISTS idx_chat_events_session_id 
ON chat_events (session_id);

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE chat_events ENABLE ROW LEVEL SECURITY;
