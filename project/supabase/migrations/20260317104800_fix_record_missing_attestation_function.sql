/*
  # Fix record_missing_attestation function
  
  1. Changes
    - Drop existing function first
    - Recreate with correct signature
*/

DROP FUNCTION IF EXISTS record_missing_attestation(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION record_missing_attestation(
  p_numero_attestation TEXT,
  p_motif TEXT,
  p_scan_url TEXT,
  p_user TEXT,
  p_carnet_table TEXT
)
RETURNS VOID
SECURITY DEFINER
AS $$
DECLARE
  v_statut TEXT;
BEGIN
  -- Determine status based on motif
  IF p_motif = 'Annulé' THEN
    v_statut := 'annulee';
  ELSE
    v_statut := 'autre';
  END IF;
  
  -- Insert or update the attestation in the carnet table
  EXECUTE format('
    INSERT INTO %I (
      numero_attestation,
      statut,
      motif_annulation,
      scan_url,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (numero_attestation) 
    DO UPDATE SET
      statut = $2,
      motif_annulation = $3,
      scan_url = $4,
      updated_at = NOW()
  ', p_carnet_table)
  USING p_numero_attestation, v_statut, p_motif, p_scan_url;
  
END;
$$ LANGUAGE plpgsql;
