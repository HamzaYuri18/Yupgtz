/*
  # Ensure all required columns exist in terme tables
  
  1. Changes
    - Add missing columns to existing table_terme_* tables
    - Ensures all tables have: numero_contrat, assure, prime, echeance, num_tel, num_tel_2, statut, remarque, date_remarque, user_remarque
  
  2. Purpose
    - Prevents insertion errors due to missing columns
    - Makes all tables consistent with the schema
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
    -- Add numero_contrat if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'numero_contrat'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN numero_contrat TEXT NOT NULL DEFAULT ''''', table_record.tablename);
    END IF;

    -- Add assure if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'assure'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN assure TEXT NOT NULL DEFAULT ''''', table_record.tablename);
    END IF;

    -- Add prime if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'prime'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN prime NUMERIC NOT NULL DEFAULT 0', table_record.tablename);
    END IF;

    -- Add echeance if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'echeance'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN echeance DATE', table_record.tablename);
    END IF;

    -- Add num_tel if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'num_tel'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN num_tel TEXT', table_record.tablename);
    END IF;

    -- Add num_tel_2 if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'num_tel_2'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN num_tel_2 TEXT', table_record.tablename);
    END IF;

    -- Add statut if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'statut'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN statut TEXT DEFAULT ''non payé''', table_record.tablename);
    END IF;

    -- Add remarque if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'remarque'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN remarque TEXT', table_record.tablename);
    END IF;

    -- Add date_remarque if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'date_remarque'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN date_remarque TIMESTAMPTZ', table_record.tablename);
    END IF;

    -- Add user_remarque if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'user_remarque'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN user_remarque TEXT', table_record.tablename);
    END IF;

    RAISE NOTICE 'Ensured all columns exist in table %', table_record.tablename;
  END LOOP;
END $$;