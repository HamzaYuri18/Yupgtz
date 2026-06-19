/*
  # Fix taches session_id type
  
  1. Changes
    - Change session_id from UUID to INTEGER in taches table
    - This matches the sessions table id type which is SERIAL
  
  2. Purpose
    - Fix "invalid input syntax for type uuid" error when inserting tasks
    - Allow proper foreign key relationship with sessions table
*/

-- Drop the existing index on session_id
DROP INDEX IF EXISTS idx_taches_session_id;

-- Change session_id type from uuid to integer
ALTER TABLE taches 
ALTER COLUMN session_id TYPE INTEGER USING NULL;