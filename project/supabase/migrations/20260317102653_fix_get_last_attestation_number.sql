/*
  # Fix get_last_attestation_number function
  
  1. Changes
    - Remove the retour contentieux check since it doesn't exist in rapport table
    - Simply get the last attestation number from rapport table sorted by created_at
*/

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
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  
  RETURN COALESCE(last_num, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
