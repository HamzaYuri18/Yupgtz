/*
  # Fix check_attestation_disponible to search in dynamic attestation tables

  1. Changes
    - Update check_attestation_disponible function to search across all dynamic attestation tables
    - The function will iterate through all carnet tables to find the attestation
    - Returns proper exists/disponible status based on the found attestation

  2. Technical Details
    - Uses dynamic SQL to query each carnet's attestation table
    - Checks each table in carnets_attestations sequentially
    - Returns as soon as attestation is found
    - Returns false if not found in any table

  3. Security
    - Function uses SECURITY DEFINER for proper access to all tables
    - Validates table names against carnets_attestations registry
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS check_attestation_disponible(INTEGER);

-- Recreate the function to search in dynamic tables
CREATE OR REPLACE FUNCTION check_attestation_disponible(attestation_numero INTEGER)
RETURNS TABLE (
  existe BOOLEAN,
  disponible BOOLEAN,
  carnet_id UUID,
  pos_carnet INTEGER,
  statut_actuel TEXT
) 
SECURITY DEFINER
AS $$
DECLARE
  carnet_record RECORD;
  attestation_found BOOLEAN := FALSE;
  result_record RECORD;
BEGIN
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
        (statut = ''en_stock'') as disponible,
        $1 as carnet_id,
        position_dans_carnet as pos_carnet,
        statut as statut_actuel
      FROM %I
      WHERE numero = $2
      LIMIT 1
    ', carnet_record.table_name)
    INTO result_record
    USING carnet_record.id, attestation_numero;
    
    -- If found, return the result
    IF result_record IS NOT NULL THEN
      RETURN QUERY SELECT 
        result_record.existe,
        result_record.disponible,
        result_record.carnet_id,
        result_record.pos_carnet,
        result_record.statut_actuel;
      RETURN;
    END IF;
  END LOOP;
  
  -- If not found in any table, return false
  RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, NULL::INTEGER, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;