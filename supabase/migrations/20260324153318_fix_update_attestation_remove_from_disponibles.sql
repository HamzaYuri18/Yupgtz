/*
  # Fix update_attestation_servie to remove attestation from disponibles

  ## Problem
  When an attestation from attestations_disponibles is reused in a new contract,
  the function update_attestation_servie() marks it as 'servie' in the carnet table,
  but does NOT remove or mark it as used in attestations_disponibles.

  This causes the attestation to still appear as available after being used.

  ## Solution
  Modify the function to also delete the attestation from attestations_disponibles
  when it is successfully marked as 'servie' in the carnet table.
*/

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
  success BOOLEAN := FALSE;
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
        statut = ''servie'',
        updated_at = NOW()
      WHERE numero_attestation = $5
        AND (statut IS NULL OR statut = ''en_stock'')
    ', carnet_record.table_name)
    USING numero_contrat, assure, montant, date_impression, attestation_text;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
      success := TRUE;
    END IF;
  END LOOP;

  -- If attestation was successfully marked as servie, remove from disponibles
  IF success THEN
    DELETE FROM attestations_disponibles
    WHERE numero_attestation = attestation_text;
  END IF;

  RETURN success;
END;
$$ LANGUAGE plpgsql;
