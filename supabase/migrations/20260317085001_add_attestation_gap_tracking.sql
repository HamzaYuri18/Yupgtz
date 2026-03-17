/*
  # Add attestation gap tracking and validation

  1. New Functions
    - `get_last_attestation_number()` - Returns the last attestation number used in rapport table
    - `record_missing_attestation()` - Records a missing/cancelled attestation with motif
    
  2. Changes to Carnet Tables
    - Add `motif_annulation` column to track cancellation reason (PRG, TRUMAN, Annulé)
    - Add `scan_barree_url` column to store the URL of scanned cancelled attestation
    - Add `user_annule` column to track who cancelled the attestation
    
  3. New Table
    - `attestations_manquantes` - Track all missing attestations with their justification
*/

-- Create table for missing attestations
CREATE TABLE IF NOT EXISTS attestations_manquantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_attestation text NOT NULL,
  motif text NOT NULL CHECK (motif IN ('PRG', 'TRUMAN', 'Annulé')),
  scan_barree_url text DEFAULT NULL,
  user_created text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attestations_manquantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view attestations_manquantes"
  ON attestations_manquantes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert attestations_manquantes"
  ON attestations_manquantes FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_attestations_manquantes_numero 
  ON attestations_manquantes(numero_attestation);

-- Function to get the last attestation number used
CREATE OR REPLACE FUNCTION get_last_attestation_number()
RETURNS text AS $$
DECLARE
  last_num text;
BEGIN
  SELECT numatt INTO last_num
  FROM rapport
  WHERE type IN ('Terme', 'Encaissement Autre Code', 'Affaire', 'Avenant Changement Véhicule')
    AND numatt IS NOT NULL
    AND numatt != ''
    AND NOT EXISTS (
      SELECT 1 FROM rapport r2 
      WHERE r2.type = 'Terme' 
        AND r2.retour = 'Contentieux'
        AND r2.numatt = rapport.numatt
    )
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  
  RETURN COALESCE(last_num, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record missing attestation
CREATE OR REPLACE FUNCTION record_missing_attestation(
  p_numero_attestation text,
  p_motif text,
  p_scan_url text,
  p_user text,
  p_carnet_table text
)
RETURNS boolean AS $$
BEGIN
  -- Insert into attestations_manquantes
  INSERT INTO attestations_manquantes (numero_attestation, motif, scan_barree_url, user_created)
  VALUES (p_numero_attestation, p_motif, p_scan_url, p_user);
  
  -- Update the carnet table to mark as annulée
  EXECUTE format('
    UPDATE %I 
    SET statut = $1,
        motif_annulation = $2,
        scan_barree_url = $3,
        user_annule = $4,
        updated_at = now()
    WHERE numero_attestation = $5',
    p_carnet_table)
  USING 'annulee', p_motif, p_scan_url, p_user, p_numero_attestation;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error recording missing attestation: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_carnet_table to include new columns
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
      statut text DEFAULT NULL CHECK (statut IS NULL OR statut IN (''servie'', ''annulee'')),
      motif_annulation text DEFAULT NULL CHECK (motif_annulation IS NULL OR motif_annulation IN (''PRG'', ''TRUMAN'', ''Annulé'')),
      scan_barree_url text DEFAULT NULL,
      user_annule text DEFAULT NULL,
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
      INSERT INTO %I (numero_attestation)
      VALUES ($1)
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

-- Add new columns to existing carnet tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT table_name 
    FROM carnets_attestations
  LOOP
    BEGIN
      EXECUTE format('
        ALTER TABLE %I 
        ADD COLUMN IF NOT EXISTS motif_annulation text DEFAULT NULL CHECK (motif_annulation IS NULL OR motif_annulation IN (''PRG'', ''TRUMAN'', ''Annulé'')),
        ADD COLUMN IF NOT EXISTS scan_barree_url text DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS user_annule text DEFAULT NULL',
        r.table_name);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error adding columns to %: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;
