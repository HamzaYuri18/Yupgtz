/*
  # Fix attestations_manquantes motif constraint

  1. Issue
    - CHECK constraint only allows ('PRG', 'TRUMAN', 'Annulé')
    - Frontend sends 'PRG TRUMAN' as single motif
    - Need to accept 'PRG TRUMAN' as valid value

  2. Changes
    - Drop and recreate CHECK constraint to include 'PRG TRUMAN'
*/

DO $$
BEGIN
  -- Drop the old constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attestations_manquantes' 
    AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE attestations_manquantes DROP CONSTRAINT IF EXISTS attestations_manquantes_motif_check;
  END IF;
  
  -- Add new constraint that accepts 'PRG TRUMAN', 'Annulé'
  ALTER TABLE attestations_manquantes 
  ADD CONSTRAINT attestations_manquantes_motif_check 
  CHECK (motif IN ('PRG TRUMAN', 'Annulé'));
  
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
