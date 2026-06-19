/*
  # Create function to update attestation in carnet table

  1. New Function
    - `update_attestation_servie` updates an attestation record with contract data
    - Marks attestation as 'imprimee' (printed)
    - Fills in contract details (numero_contrat, assure, montant, date_impression)
    - Works with dynamic table names

  2. Parameters
    - attestation_numero: The attestation number to update
    - numero_contrat: The contract number
    - assure: The insured name
    - montant: The premium amount
    - date_impression: The date the attestation was printed

  3. Security
    - Function uses SECURITY DEFINER for proper access
    - Returns TRUE on success, FALSE on failure
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
  -- Convert number to text for comparison
  attestation_text := attestation_numero::TEXT;
  
  -- Loop through all carnets to find the attestation
  FOR carnet_record IN 
    SELECT id, table_name, numero_debut, numero_fin 
    FROM carnets_attestations 
    WHERE attestation_numero >= numero_debut 
      AND attestation_numero <= numero_fin
  LOOP
    -- Update the attestation in this carnet's table
    EXECUTE format('
      UPDATE %I
      SET 
        numero_contrat = $1,
        assure = $2,
        montant = $3,
        date_impression = $4,
        statut = ''imprimee'',
        updated_at = NOW()
      WHERE numero_attestation = $5
        AND (statut IS NULL OR statut = ''en_stock'')
    ', carnet_record.table_name)
    USING numero_contrat, assure, montant, date_impression, attestation_text;
    
    -- Check if any rows were updated
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    IF rows_updated > 0 THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  
  -- If not found or not updated in any table, return false
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;