/*
  # Add Carnet Management for Attestations

  1. New Tables
    - `carnets_attestations` - Stores metadata about each carnet (notebook/sequence)
      - `id` (uuid, primary key) - Unique identifier
      - `nom_carnet` (text, unique) - Carnet name (usually the starting number)
      - `numero_debut` (integer) - Starting number of sequence
      - `numero_fin` (integer) - Ending number of sequence
      - `nombre_total` (integer) - Total number of attestations in sequence
      - `table_name` (text) - Name of the dynamic table created for this carnet
      - `created_at` (timestamptz) - Creation timestamp

  2. Functions
    - `create_carnet_table` - Creates a new table for a specific carnet
    - `check_sequence_overlap` - Checks if a sequence range already exists in any carnet

  3. Security
    - Enable RLS on carnets_attestations table
    - Add policies for managing carnets
*/

CREATE TABLE IF NOT EXISTS carnets_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_carnet text UNIQUE NOT NULL,
  numero_debut integer NOT NULL,
  numero_fin integer NOT NULL,
  nombre_total integer NOT NULL,
  table_name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE carnets_attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view carnets"
  ON carnets_attestations
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert carnets"
  ON carnets_attestations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update carnets"
  ON carnets_attestations
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete carnets"
  ON carnets_attestations
  FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_carnets_nom ON carnets_attestations(nom_carnet);
CREATE INDEX IF NOT EXISTS idx_carnets_range ON carnets_attestations(numero_debut, numero_fin);

CREATE OR REPLACE FUNCTION create_carnet_table(
  p_table_name text,
  p_numero_debut integer,
  p_numero_fin integer
)
RETURNS boolean AS $$
DECLARE
  v_numero integer;
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      numero_attestation text UNIQUE NOT NULL,
      numero_contrat text DEFAULT NULL,
      assure text DEFAULT NULL,
      date_impression timestamptz DEFAULT NULL,
      montant numeric(10, 3) DEFAULT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )', p_table_name);

  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('
    DROP POLICY IF EXISTS "Anyone can view %I" ON %I', 
    p_table_name, p_table_name);
  
  EXECUTE format('
    CREATE POLICY "Anyone can view %I"
    ON %I FOR SELECT USING (true)', 
    p_table_name, p_table_name);

  EXECUTE format('
    DROP POLICY IF EXISTS "Anyone can insert %I" ON %I', 
    p_table_name, p_table_name);
  
  EXECUTE format('
    CREATE POLICY "Anyone can insert %I"
    ON %I FOR INSERT WITH CHECK (true)', 
    p_table_name, p_table_name);

  EXECUTE format('
    DROP POLICY IF EXISTS "Anyone can update %I" ON %I', 
    p_table_name, p_table_name);
  
  EXECUTE format('
    CREATE POLICY "Anyone can update %I"
    ON %I FOR UPDATE USING (true) WITH CHECK (true)', 
    p_table_name, p_table_name);

  EXECUTE format('
    DROP POLICY IF EXISTS "Anyone can delete %I" ON %I', 
    p_table_name, p_table_name);
  
  EXECUTE format('
    CREATE POLICY "Anyone can delete %I"
    ON %I FOR DELETE USING (true)', 
    p_table_name, p_table_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_%I_numero ON %I(numero_attestation)',
    p_table_name, p_table_name);

  FOR v_numero IN p_numero_debut..p_numero_fin LOOP
    EXECUTE format('
      INSERT INTO %I (numero_attestation, numero_contrat, assure, date_impression, montant)
      VALUES ($1, NULL, NULL, NULL, NULL)
      ON CONFLICT (numero_attestation) DO NOTHING',
      p_table_name)
    USING v_numero::text;
  END LOOP;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating carnet table: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_sequence_overlap(
  p_numero_debut integer,
  p_numero_fin integer
)
RETURNS table(overlap_exists boolean, carnet_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as overlap_exists,
    nom_carnet as carnet_name
  FROM carnets_attestations
  WHERE 
    (p_numero_debut >= numero_debut AND p_numero_debut <= numero_fin)
    OR (p_numero_fin >= numero_debut AND p_numero_fin <= numero_fin)
    OR (p_numero_debut <= numero_debut AND p_numero_fin >= numero_fin)
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END;
$$ LANGUAGE plpgsql;