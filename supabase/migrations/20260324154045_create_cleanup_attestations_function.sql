/*
  # Create function to cleanup attestations_disponibles

  ## Purpose
  This migration creates a function to automatically reset attestations to disponible
  when their associated contracts are deleted from the rapport.

  ## Changes
  1. Creates a function cleanup_attestations_orphelines() that:
     - Finds attestations marked as reutilise=true but whose nouveau_numero_contrat 
       no longer exists in rapport, affaire, or terme tables
     - Resets these attestations to reutilise=false so they become available again

  2. Immediately runs the cleanup to fix existing data
*/

CREATE OR REPLACE FUNCTION cleanup_attestations_orphelines()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count INTEGER := 0;
BEGIN
  UPDATE attestations_disponibles ad
  SET 
    reutilise = false,
    reutilise_le = NULL,
    reutilise_par = NULL,
    nouveau_numero_contrat = NULL
  FROM (
    SELECT ad2.id
    FROM attestations_disponibles ad2
    LEFT JOIN rapport r ON ad2.nouveau_numero_contrat = r.numero_contrat
    LEFT JOIN affaire a ON ad2.nouveau_numero_contrat = a.numero_contrat
    LEFT JOIN terme t ON ad2.nouveau_numero_contrat = t.numero_contrat
    WHERE ad2.reutilise = true
      AND r.numero_contrat IS NULL
      AND a.numero_contrat IS NULL
      AND t.numero_contrat IS NULL
  ) orphans
  WHERE ad.id = orphans.id;
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$;

SELECT cleanup_attestations_orphelines() as attestations_cleaned;
