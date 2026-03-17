/*
  # Fix record_missing_attestation to use correct column name
  
  1. Changes
    - Use scan_barree_url instead of scan_url
    - Use user_annule to record who cancelled it
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
      scan_barree_url,
      user_annule,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (numero_attestation) 
    DO UPDATE SET
      statut = $2,
      motif_annulation = $3,
      scan_barree_url = $4,
      user_annule = $5,
      updated_at = NOW()
  ', p_carnet_table)
  USING p_numero_attestation, v_statut, p_motif, p_scan_url, p_user;
  
END;
$$ LANGUAGE plpgsql;
