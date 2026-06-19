/*
  # Add telephone column to liste_credits table
  
  1. Changes
    - Add `telephone` column to `liste_credits` table to store client phone numbers
    - Column is optional (nullable) as existing records may not have phone numbers
  
  2. Purpose
    - Enable SMS functionality for credits with outstanding balance
    - Store client contact information for payment reminders
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liste_credits' AND column_name = 'telephone'
  ) THEN
    ALTER TABLE liste_credits ADD COLUMN telephone text;
  END IF;
END $$;
