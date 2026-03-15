/*
  # Fix ambiguous column names in check_attestation_disponible

  1. Changes
    - Use qualified column names to avoid ambiguity
    - Prefix carnet columns with carnet_record
*/

DROP FUNCTION IF EXISTS check_attestation_disponible(INTEGER);

CREATE OR REPLACE FUNCTION check_attestation_disponible(attestation_numero INTEGER)
RETURNS TABLE (
  existe BOOLEAN,
  disponible BOOLEAN,
  carnet_id UUID,
  table_name TEXT,
  numero_attestation TEXT,
  statut_actuel TEXT,
  numero_contrat TEXT,
  assure TEXT,
  montant NUMERIC
)
SECURITY DEFINER
AS $$
DECLARE
  carnet_record RECORD;
  attestation_text TEXT;
  attestation_record RECORD;
BEGIN
  -- Convert number to text for comparison
  attestation_text := attestation_numero::TEXT;
  
  -- Loop through all carnets to find the attestation
  FOR carnet_record IN 
    SELECT c.id, c.table_name, c.numero_debut, c.numero_fin 
    FROM carnets_attestations c
    WHERE attestation_numero >= c.numero_debut 
      AND attestation_numero <= c.numero_fin
  LOOP
    -- Check if attestation exists in this carnet's table
    BEGIN
      EXECUTE format('
        SELECT 
          a.numero_attestation,
          a.statut,
          a.numero_contrat,
          a.assure,
          a.montant
        FROM %I a
        WHERE a.numero_attestation = $1
      ', carnet_record.table_name)
      INTO attestation_record
      USING attestation_text;
      
      IF FOUND THEN
        -- Attestation found
        RETURN QUERY SELECT 
          TRUE,
          (attestation_record.statut IS NULL OR attestation_record.statut = 'en_stock'),
          carnet_record.id,
          carnet_record.table_name,
          attestation_record.numero_attestation,
          COALESCE(attestation_record.statut, 'en_stock'),
          attestation_record.numero_contrat,
          attestation_record.assure,
          attestation_record.montant;
        RETURN;
      END IF;
    EXCEPTION
      WHEN undefined_table THEN
        -- Table doesn't exist, skip to next carnet
        CONTINUE;
    END;
  END LOOP;
  
  -- Attestation not found in any carnet
  RETURN QUERY SELECT 
    FALSE,
    FALSE,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::NUMERIC;
END;
$$ LANGUAGE plpgsql;