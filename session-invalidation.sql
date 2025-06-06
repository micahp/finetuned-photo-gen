-- Add the session_invalidated_at column to the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_invalidated_at TIMESTAMP; 