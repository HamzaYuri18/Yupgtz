/*
  # Fix update_attestation_servie function - use 'servie' instead of 'imprimee'

  ## Problem
  The carnet tables created by create_carnet_table() have a CHECK constraint:
    statut IS NULL OR statut IN ('servie', 'annulee')
  
  But the function update_attestation_servie was setting statut = 'imprimee'
  which violates this constraint, causing the UPDATE to fail silently (0 rows updated).
  
  ## Fix
  Change the statut value from 'imprimee' to 'servie' to match the CHECK constraint.
  Also remove the overly restrictive WHERE clause that only updated when statut IS NULL 
  or 'en_stock' — the new carnet tables start with statut = NULL, so we keep that condition
  but add 'servie' exclusion is not needed since we want idempotent behavior.
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
      RETURN TRUE;
    END IF;
  END LOOP;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
