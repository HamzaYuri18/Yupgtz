/*
  # Recreate taches session_id index
  
  1. Changes
    - Recreate index on session_id after type change
  
  2. Purpose
    - Restore performance for queries filtering by session_id
*/

-- Recreate the index on session_id
CREATE INDEX IF NOT EXISTS idx_taches_session_id ON taches(session_id);