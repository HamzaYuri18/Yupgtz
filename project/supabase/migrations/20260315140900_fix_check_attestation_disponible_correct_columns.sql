/*
  # Fix check_attestation_disponible to use correct column names

  1. Changes
    - Update function to use 'numero_attestation' (TEXT) instead of 'numero' (INTEGER)
    - Remove position_dans_carnet since it doesn't exist in dynamic tables
    - Treat NULL statut as 'en_stock' (disponible)
    - Convert attestation number to text for comparison

  2. Return Values
    - existe: TRUE if attestation found
    - disponible: TRUE if statut is NULL or 'en_stock'
    - carnet_id: UUID of the carnet
    - statut_actuel: Current status (NULL means available/en_stock)

  3. Security
    - Function uses SECURITY DEFINER for proper access
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS check_attestation_disponible(INTEGER);

-- Recreate the function with correct column names
CREATE OR REPLACE FUNCTION check_attestation_disponible(attestation_numero INTEGER)
RETURNS TABLE (
  existe BOOLEAN,
  disponible BOOLEAN,
  carnet_id UUID,
  statut_actuel TEXT
) 
SECURITY DEFINER
AS $$
DECLARE
  carnet_record RECORD;
  result_record RECORD;
  attestation_text TEXT;
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
    -- Try to find the attestation in this carnet's table
    EXECUTE format('
      SELECT 
        TRUE as existe,
        (statut IS NULL OR statut = ''en_stock'') as disponible,
        $1::UUID as carnet_id,
        COALESCE(statut, ''en_stock'') as statut_actuel
      FROM %I
      WHERE numero_attestation = $2
      LIMIT 1
    ', carnet_record.table_name)
    INTO result_record
    USING carnet_record.id, attestation_text;
    
    -- If found, return the result
    IF result_record IS NOT NULL THEN
      RETURN QUERY SELECT 
        result_record.existe,
        result_record.disponible,
        result_record.carnet_id,
        result_record.statut_actuel;
      RETURN;
    END IF;
  END LOOP;
  
  -- If not found in any table, return false
  RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;