/*
  # Fix missing database schema - Create terme table and add echeance column

  1. New Tables
    - `terme` - Table for storing "Terme" type contracts with payment date
      - `id` (serial, primary key)
      - `numero_contrat` (text, not null)
      - `prime` (decimal, not null)
      - `assure` (text, not null)
      - `branche` (text, not null)
      - `echeance` (date, not null)
      - `date_paiement` (date, default current_date)
      - `created_at` (timestamptz, default now)

  2. Table Modifications
    - Add `echeance` column to `rapport` table (date, nullable)
    - NULL for Affaire contracts, date for Terme contracts

  3. Security
    - Enable RLS on terme table
    - Public read and insert policies
    - Indexes for performance optimization
*/

-- Create the terme table if it doesn't exist
CREATE TABLE IF NOT EXISTS terme (
  id SERIAL PRIMARY KEY,
  numero_contrat TEXT NOT NULL,
  prime DECIMAL(10,2) NOT NULL DEFAULT 0,
  assure TEXT NOT NULL,
  branche TEXT NOT NULL CHECK (branche IN ('Auto', 'Vie', 'Santé', 'IRDS')),
  echeance DATE NOT NULL,
  date_paiement DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on terme table
ALTER TABLE terme ENABLE ROW LEVEL SECURITY;

-- Create policies for terme table
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'terme' AND policyname = 'Allow read access'
  ) THEN
    CREATE POLICY "Allow read access" ON terme
    FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'terme' AND policyname = 'Allow insert access'
  ) THEN
    CREATE POLICY "Allow insert access" ON terme
    FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;
END $$;

-- Create indexes for terme table
CREATE INDEX IF NOT EXISTS terme_numero_contrat_idx ON terme (numero_contrat);
CREATE INDEX IF NOT EXISTS terme_echeance_idx ON terme (echeance);
CREATE INDEX IF NOT EXISTS terme_numero_echeance_idx ON terme (numero_contrat, echeance);
CREATE INDEX IF NOT EXISTS terme_branche_idx ON terme (branche);
CREATE INDEX IF NOT EXISTS terme_created_at_idx ON terme (created_at);

-- Add unique constraint on numero_contrat + echeance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'terme_numero_echeance_unique'
  ) THEN
    ALTER TABLE terme 
    ADD CONSTRAINT terme_numero_echeance_unique 
    UNIQUE (numero_contrat, echeance);
  END IF;
END $$;

-- Add echeance column to rapport table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rapport' AND column_name = 'echeance'
  ) THEN
    ALTER TABLE rapport ADD COLUMN echeance DATE;
  END IF;
END $$;

-- Create index on echeance column in rapport table
CREATE INDEX IF NOT EXISTS rapport_echeance_idx ON rapport (echeance);

-- Confirmation message
DO $$
BEGIN
    RAISE NOTICE '✅ Schema fix completed successfully';
    RAISE NOTICE '   - Table terme created with all constraints and indexes';
    RAISE NOTICE '   - Column echeance added to rapport table';
    RAISE NOTICE '   - RLS enabled with public policies';
    RAISE NOTICE '   - All indexes created for performance';
END $$;
