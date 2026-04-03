/*
  # Fix record_missing_attestation for PRG TRUMAN motif

  1. Issue
    - When motif is "PRG TRUMAN", function fails because table doesn't have record
    - Need to insert into attestations_manquantes table only
    - Don't try to insert into carnet table for PRG TRUMAN (future cancellations)

  2. Changes
    - Update function to only record in attestations_manquantes table
    - For "Annulé", update carnet table with statut "annulee"
    - For "PRG TRUMAN", only record in attestations_manquantes (no carnet update)
    - Return proper error handling
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
BEGIN
  -- Always record in attestations_manquantes table
  INSERT INTO attestations_manquantes (numero_attestation, motif, scan_barree_url, user_created)
  VALUES (p_numero_attestation, p_motif, p_scan_url, p_user);
  
  -- Only update carnet table for cancelled attestations ("Annulé")
  IF p_motif = 'Annulé' THEN
    EXECUTE format('
      UPDATE %I 
      SET statut = $1,
          motif_annulation = $2,
          scan_barree_url = $3,
          user_annule = $4,
          updated_at = now()
      WHERE numero_attestation = $5',
      p_carnet_table)
    USING 'annulee', p_motif, p_scan_url, p_user, p_numero_attestation;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error recording missing attestation: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;
