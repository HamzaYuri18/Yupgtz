/*
  # Add phone columns to existing terme tables

  1. Changes
    - Adds num_tel and num_tel_2 columns to all existing table_terme_* tables
    - These columns store phone numbers for contracts
    - Both columns are optional (nullable)
*/

DO $$
BEGIN
  -- Add num_tel column to table_terme_avril_2025 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_avril_2025' AND column_name = 'num_tel'
  ) THEN
    ALTER TABLE table_terme_avril_2025 ADD COLUMN num_tel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_avril_2025' AND column_name = 'num_tel_2'
  ) THEN
    ALTER TABLE table_terme_avril_2025 ADD COLUMN num_tel_2 TEXT;
  END IF;

  -- Add num_tel column to table_terme_aout_2025 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_aout_2025' AND column_name = 'num_tel'
  ) THEN
    ALTER TABLE table_terme_aout_2025 ADD COLUMN num_tel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_aout_2025' AND column_name = 'num_tel_2'
  ) THEN
    ALTER TABLE table_terme_aout_2025 ADD COLUMN num_tel_2 TEXT;
  END IF;

  -- Add num_tel column to table_terme_septembre_2025 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_septembre_2025' AND column_name = 'num_tel'
  ) THEN
    ALTER TABLE table_terme_septembre_2025 ADD COLUMN num_tel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_septembre_2025' AND column_name = 'num_tel_2'
  ) THEN
    ALTER TABLE table_terme_septembre_2025 ADD COLUMN num_tel_2 TEXT;
  END IF;

  -- Add num_tel column to table_terme_juillet_2025 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_juillet_2025' AND column_name = 'num_tel'
  ) THEN
    ALTER TABLE table_terme_juillet_2025 ADD COLUMN num_tel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_juillet_2025' AND column_name = 'num_tel_2'
  ) THEN
    ALTER TABLE table_terme_juillet_2025 ADD COLUMN num_tel_2 TEXT;
  END IF;

  -- Add num_tel column to table_terme_mai_2025 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_mai_2025' AND column_name = 'num_tel'
  ) THEN
    ALTER TABLE table_terme_mai_2025 ADD COLUMN num_tel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_mai_2025' AND column_name = 'num_tel_2'
  ) THEN
    ALTER TABLE table_terme_mai_2025 ADD COLUMN num_tel_2 TEXT;
  END IF;

  -- Add num_tel column to table_terme_novembre_2025 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_novembre_2025' AND column_name = 'num_tel'
  ) THEN
    ALTER TABLE table_terme_novembre_2025 ADD COLUMN num_tel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_novembre_2025' AND column_name = 'num_tel_2'
  ) THEN
    ALTER TABLE table_terme_novembre_2025 ADD COLUMN num_tel_2 TEXT;
  END IF;

  -- Add num_tel column to table_terme_octobre_2025 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_octobre_2025' AND column_name = 'num_tel'
  ) THEN
    ALTER TABLE table_terme_octobre_2025 ADD COLUMN num_tel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_octobre_2025' AND column_name = 'num_tel_2'
  ) THEN
    ALTER TABLE table_terme_octobre_2025 ADD COLUMN num_tel_2 TEXT;
  END IF;

  -- Add num_tel column to table_terme_decembre_2025 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_decembre_2025' AND column_name = 'num_tel'
  ) THEN
    ALTER TABLE table_terme_decembre_2025 ADD COLUMN num_tel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_terme_decembre_2025' AND column_name = 'num_tel_2'
  ) THEN
    ALTER TABLE table_terme_decembre_2025 ADD COLUMN num_tel_2 TEXT;
  END IF;
END $$;