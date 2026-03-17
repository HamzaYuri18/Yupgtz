/*
  # Add attestation sequence validation
  
  1. New Function
    - `validate_attestation_sequence()` - Validates that the attestation number is the next expected number
    
  2. Logic
    - Find which carnet the attestation belongs to
    - Find the last attestation printed from that carnet in rapport table
    - Verify the new attestation is the next sequential number
    - If not sequential, return error with details about missing numbers
*/

CREATE OR REPLACE FUNCTION validate_attestation_sequence(attestation_numero INTEGER)
RETURNS TABLE (
  is_valid BOOLEAN,
  message TEXT,
  dernier_numero_imprime TEXT,
  numero_attendu TEXT,
  carnet_table TEXT
)
SECURITY DEFINER
AS $$
DECLARE
  carnet_record RECORD;
  attestation_text TEXT;
  dernier_numero TEXT;
  numero_attendu_calc INTEGER;
BEGIN
  attestation_text := attestation_numero::TEXT;
  
  -- Find which carnet this attestation belongs to
  SELECT c.id, c.table_name, c.numero_debut, c.numero_fin 
  INTO carnet_record
  FROM carnets_attestations c
  WHERE attestation_numero >= c.numero_debut 
    AND attestation_numero <= c.numero_fin
  LIMIT 1;
  
  -- If carnet not found
  IF carnet_record IS NULL THEN
    RETURN QUERY SELECT 
      FALSE,
      'Numéro d''attestation hors limites des carnets disponibles'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;
  
  -- Find the last attestation from this carnet that was printed (in rapport table)
  SELECT r.numatt INTO dernier_numero
  FROM rapport r
  INNER JOIN carnets_attestations c ON c.table_name = carnet_record.table_name
  WHERE r.type IN ('Terme', 'Encaissement Autre Code', 'Affaire', 'Avenant Changement Véhicule')
    AND r.numatt IS NOT NULL
    AND r.numatt != ''
    AND r.numatt::INTEGER >= c.numero_debut
    AND r.numatt::INTEGER <= c.numero_fin
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT 1;
  
  -- If no attestation found in rapport for this carnet, the first one should be numero_debut
  IF dernier_numero IS NULL THEN
    numero_attendu_calc := carnet_record.numero_debut;
    
    IF attestation_numero = numero_attendu_calc THEN
      RETURN QUERY SELECT 
        TRUE,
        'Première attestation du carnet'::TEXT,
        NULL::TEXT,
        numero_attendu_calc::TEXT,
        carnet_record.table_name;
    ELSE
      RETURN QUERY SELECT 
        FALSE,
        format('Cette attestation est la première du carnet. Le numéro attendu est %s', numero_attendu_calc)::TEXT,
        NULL::TEXT,
        numero_attendu_calc::TEXT,
        carnet_record.table_name;
    END IF;
    RETURN;
  END IF;
  
  -- Calculate expected next number
  numero_attendu_calc := dernier_numero::INTEGER + 1;
  
  -- Check if the attestation number is sequential
  IF attestation_numero = numero_attendu_calc THEN
    RETURN QUERY SELECT 
      TRUE,
      'Numéro d''attestation valide'::TEXT,
      dernier_numero,
      numero_attendu_calc::TEXT,
      carnet_record.table_name;
  ELSE
    -- Check if attestation is before the expected number
    IF attestation_numero < numero_attendu_calc THEN
      RETURN QUERY SELECT 
        FALSE,
        format('Cette attestation a déjà été utilisée. Dernière attestation imprimée: %s, numéro attendu: %s', 
               dernier_numero, numero_attendu_calc)::TEXT,
        dernier_numero,
        numero_attendu_calc::TEXT,
        carnet_record.table_name;
    ELSE
      -- Attestation is after the expected number - there are missing numbers
      RETURN QUERY SELECT 
        FALSE,
        format('Il manque des attestations! Dernière attestation imprimée: %s, numéro attendu: %s, mais vous essayez d''utiliser: %s', 
               dernier_numero, numero_attendu_calc, attestation_numero)::TEXT,
        dernier_numero,
        numero_attendu_calc::TEXT,
        carnet_record.table_name;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
