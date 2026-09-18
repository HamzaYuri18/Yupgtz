/*
  # Support "prolongation" as an attestation status

  1. Problem
    - Carnet tables (one per attestation booklet, registered in
      carnets_attestations, e.g. attestations_13976401) constrain
      `statut` to NULL/'imprimee'/'servie'/'annulee' only.
    - The Prolongation Exceptionnelle form needs to mark an
      attestation as used for a prolongation ('prolongation'), which
      the current constraint would reject.

  2. Changes
    - Dynamically widen the `statut` CHECK constraint on every
      existing carnet table to also allow 'prolongation'.
    - Update create_carnet_table() so future carnet tables include
      'prolongation' from the start.
    - Add update_attestation_prolongation(attestation_numero,
      numero_contrat, assure): finds the right carnet table for the
      given attestation number and sets statut = 'prolongation'
      (mirrors update_attestation_servie(), different status value).
    - Add numero_attestation to the prolongation table so the form
      can record which attestation was used.
*/

-- 0. Store the attestation number on each prolongation record.
ALTER TABLE prolongation ADD COLUMN IF NOT EXISTS numero_attestation text;

-- 1. Widen the statut constraint on every existing carnet table.
--    Built from whatever statut values actually exist in each table (some
--    older carnet tables use a legacy value like 'en_stock' that our fixed
--    list didn't account for) plus the standard set and 'prolongation', so
--    this never fails no matter what's already stored. Registry rows whose
--    table_name doesn't actually exist as a table (stale/orphaned entries
--    in carnets_attestations) are skipped.
DO $$
DECLARE
  carnet_record RECORD;
  existing_constraint text;
  allowed_values text;
BEGIN
  FOR carnet_record IN SELECT table_name FROM carnets_attestations LOOP
    IF to_regclass(quote_ident(carnet_record.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT string_agg(DISTINCT quote_literal(statut), '', '') FROM %I WHERE statut IS NOT NULL',
      carnet_record.table_name
    ) INTO allowed_values;

    allowed_values := COALESCE(allowed_values || ', ', '')
      || '''imprimee'', ''servie'', ''annulee'', ''prolongation''';

    SELECT con.conname INTO existing_constraint
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = carnet_record.table_name
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%statut%';

    IF existing_constraint IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', carnet_record.table_name, existing_constraint);
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (statut IS NULL OR statut IN (%s))',
      carnet_record.table_name,
      carnet_record.table_name || '_statut_check',
      allowed_values
    );
  END LOOP;
END $$;

-- 2. Future carnet tables should also allow 'prolongation' from creation.
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
      statut text DEFAULT NULL CHECK (statut IS NULL OR statut IN (''imprimee'', ''servie'', ''annulee'', ''prolongation'')),
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

-- 3. Mark an attestation as used for a prolongation.
CREATE OR REPLACE FUNCTION update_attestation_prolongation(
  attestation_numero INTEGER,
  p_numero_contrat TEXT,
  p_assure TEXT
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
    SELECT table_name FROM carnets_attestations
    WHERE attestation_numero >= numero_debut
      AND attestation_numero <= numero_fin
  LOOP
    EXECUTE format('
      UPDATE %I
      SET
        numero_contrat = $1,
        assure = $2,
        statut = ''prolongation'',
        updated_at = NOW()
      WHERE numero_attestation = $3
    ', carnet_record.table_name)
    USING p_numero_contrat, p_assure, attestation_text;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
