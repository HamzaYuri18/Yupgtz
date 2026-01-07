/*
  # Add Remarque Columns to Terme Tables

  1. Changes
    - Add `remarque` column (text) to all terme tables
    - Add `date_remarque` column (timestamptz) to all terme tables
    - Add `user_remarque` column (text) to all terme tables

  2. Purpose
    - Allow users to add remarks/notes to specific payment terms
    - Track when remarks were added and by whom
    - Display remark history in the UI

  3. Implementation
    - Uses dynamic SQL to add columns to all tables matching 'terme_%' pattern
    - Columns are nullable to maintain compatibility with existing records
*/

DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'terme_%'
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
