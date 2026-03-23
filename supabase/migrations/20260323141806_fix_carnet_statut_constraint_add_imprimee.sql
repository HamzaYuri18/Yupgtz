/*
  # Fix carnet statut constraint - add 'imprimee' value

  ## Problem
  The new carnet table (attestations_13976401) has a CHECK constraint that only allows:
  NULL, 'servie', 'annulee'
  
  But the update_attestation_servie function sets statut = 'imprimee' (which is the 
  correct value used in the old carnet table attestations_13974552).
  
  The UPDATE was being rejected silently by the CHECK constraint, leaving statut = NULL
  even after a contract was saved with that attestation number.

  ## Fix
  1. Add 'imprimee' to the CHECK constraint of the new carnet table (13976401)
  2. Update create_carnet_table() to include 'imprimee' in future tables
  3. Restore update_attestation_servie to use 'imprimee' (original behavior)
  4. Fix all existing attestations in 13976401 that are in rapport but still NULL
*/

-- 1. Fix the CHECK constraint on the existing new carnet table
ALTER TABLE attestations_13976401 
  DROP CONSTRAINT IF EXISTS attestations_13976401_statut_check;

ALTER TABLE attestations_13976401 
  ADD CONSTRAINT attestations_13976401_statut_check 
  CHECK (statut IS NULL OR statut IN ('imprimee', 'servie', 'annulee'));

-- 2. Update create_carnet_table to include 'imprimee' for all future carnet tables
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
      statut text DEFAULT NULL CHECK (statut IS NULL OR statut IN (''imprimee'', ''servie'', ''annulee'')),
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

-- 3. Restore update_attestation_servie to use 'imprimee' (original behavior)
CREATE OR REPLACE FUNCTION update_attestation_servie(
  attestation_numero INTEGER,
  numero_contrat TEXT,
  assure TEXT,
  montant NUMERIC,
  date_impression TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  carnet_record RECORD;
  attestation_text TEXT;
  rows_updated INTEGER;
BEGIN
  attestation_text := attestation_numero::TEXT;
  
  FOR carnet_record IN 
    SELECT id, table_name, numero_debut, numero_fin 
    FROM carnets_attestations 
    WHERE attestation_numero >= numero_debut 
      AND attestation_numero <= numero_fin
  LOOP
    EXECUTE format('
      UPDATE %I
      SET 
        numero_contrat = $1,
        assure = $2,
        montant = $3,
        date_impression = $4,
        statut = ''imprimee'',
        updated_at = NOW()
      WHERE numero_attestation = $5
        AND (statut IS NULL OR statut = ''en_stock'')
    ', carnet_record.table_name)
    USING numero_contrat, assure, montant, date_impression, attestation_text;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    IF rows_updated > 0 THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 4. Fix existing attestations in 13976401 that appear in rapport but statut is still NULL
-- Sync the carnet table with what's already recorded in rapport
UPDATE attestations_13976401 a
SET 
  statut = 'imprimee',
  numero_contrat = r.numero_contrat,
  assure = r.assure,
  montant = r.montant,
  date_impression = r.created_at,
  updated_at = NOW()
FROM rapport r
WHERE r.numatt = a.numero_attestation
  AND a.statut IS NULL
  AND r.numatt IS NOT NULL
  AND r.numatt != ''
  AND r.type IN ('Terme', 'Affaire', 'Encaissement Autre Code', 'Avenant Changement Véhicule');
