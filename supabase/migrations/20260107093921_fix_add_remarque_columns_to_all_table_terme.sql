/*
  # Fix: Add Remarque Columns to All table_terme Tables

  1. Changes
    - Add `remarque` column (text) to all table_terme_* tables if not exists
    - Add `date_remarque` column (timestamptz) to all table_terme_* tables if not exists
    - Add `user_remarque` column (text) to all table_terme_* tables if not exists

  2. Purpose
    - Ensure all table_terme_* tables have the remarque columns
    - Fix the previous migration that looked for 'terme_%' instead of 'table_terme_%'

  3. Implementation
    - Uses dynamic SQL to add columns to all tables matching 'table_terme_%' pattern
    - Columns are nullable to maintain compatibility with existing records
    - IF NOT EXISTS prevents errors if columns already exist
*/

DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'table_terme_%'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'remarque'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN remarque text', table_record.tablename);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'date_remarque'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN date_remarque timestamptz', table_record.tablename);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'user_remarque'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN user_remarque text', table_record.tablename);
    END IF;
  END LOOP;
END $$;
