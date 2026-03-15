/*
  # Update check_attestation_disponible to return more information

  1. Changes
    - Add numero_attestation to the return type
    - Add table_name to the return type
    - Add numero_contrat if already assigned
    - Add assure if already assigned
    - Add montant if already assigned

  2. Purpose
    - Provide complete information about the attestation
    - Allow the frontend to display detailed information
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
    SELECT id, table_name, numero_debut, numero_fin 
    FROM carnets_attestations 
    WHERE attestation_numero >= numero_debut 
      AND attestation_numero <= numero_fin
  LOOP
    -- Check if attestation exists in this carnet's table
    BEGIN
      EXECUTE format('
        SELECT 
          numero_attestation,
          statut,
          numero_contrat,
          assure,
          montant
        FROM %I 
        WHERE numero_attestation = $1
      ', carnet_record.table_name)
      INTO attestation_record
      USING attestation_text;
      
      IF FOUND THEN
        -- Attestation found
        RETURN QUERY SELECT 
          TRUE as existe,
          (attestation_record.statut IS NULL OR attestation_record.statut = 'en_stock') as disponible,
          carnet_record.id as carnet_id,
          carnet_record.table_name,
          attestation_record.numero_attestation,
          COALESCE(attestation_record.statut, 'en_stock') as statut_actuel,
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
    FALSE as existe,
    FALSE as disponible,
    NULL::UUID as carnet_id,
    NULL::TEXT as table_name,
    NULL::TEXT as numero_attestation,
    NULL::TEXT as statut_actuel,
    NULL::TEXT as numero_contrat,
    NULL::TEXT as assure,
    NULL::NUMERIC as montant;
END;
$$ LANGUAGE plpgsql;