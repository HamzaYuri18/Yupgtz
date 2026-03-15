/*
  # Add NumATT column to terme table

  1. Changes
    - Add `numatt` column to terme table (integer, nullable)
    - This column stores the attestation number for Auto insurance contracts
  
  2. Notes
    - Column is nullable because not all contracts are Auto (only Auto branch needs attestation)
    - No default value as attestation numbers are assigned when creating contracts
*/

-- Add NumATT column to terme table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'terme' 
    AND column_name = 'numatt'
  ) THEN
    ALTER TABLE terme ADD COLUMN numatt INTEGER;
  END IF;
END $$;

-- Create index for performance when searching by attestation number
CREATE INDEX IF NOT EXISTS idx_terme_numatt ON terme(numatt);
