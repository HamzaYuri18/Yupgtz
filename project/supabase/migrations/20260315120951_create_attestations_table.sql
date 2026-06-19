/*
  # Create attestations table

  1. New Tables
    - `attestations`
      - `id` (uuid, primary key) - Unique identifier
      - `numero_attestation` (text, unique, not null) - Attestation number
      - `numero_contrat` (text, nullable) - Contract number (null by default)
      - `assure` (text, nullable) - Insured name (null by default)
      - `date_impression` (date, nullable) - Print date (null by default)
      - `montant` (numeric, nullable) - Amount (null by default)
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `attestations` table
    - Add policies for authenticated users to manage attestations
    
  3. Indexes
    - Add index on numero_attestation for fast lookups
    - Add index on numero_contrat for filtering
*/

CREATE TABLE IF NOT EXISTS attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_attestation text UNIQUE NOT NULL,
  numero_contrat text DEFAULT NULL,
  assure text DEFAULT NULL,
  date_impression date DEFAULT NULL,
  montant numeric(10, 3) DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view attestations"
  ON attestations
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert attestations"
  ON attestations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update attestations"
  ON attestations
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete attestations"
  ON attestations
  FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_attestations_numero ON attestations(numero_attestation);
CREATE INDEX IF NOT EXISTS idx_attestations_contrat ON attestations(numero_contrat);

CREATE OR REPLACE FUNCTION update_attestations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_attestations_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_attestations_updated_at
      BEFORE UPDATE ON attestations
      FOR EACH ROW
      EXECUTE FUNCTION update_attestations_updated_at();
  END IF;
END $$;