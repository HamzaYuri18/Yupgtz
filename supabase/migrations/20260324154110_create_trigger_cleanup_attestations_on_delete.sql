/*
  # Create trigger to cleanup attestations when contracts are deleted

  ## Purpose
  Automatically run the cleanup function when contracts are deleted from rapport,
  affaire, or terme tables to immediately make attestations available again.

  ## Changes
  1. Create a trigger function that calls cleanup_attestations_orphelines()
  2. Attach this trigger to rapport, affaire, and terme tables on DELETE operations
*/

CREATE OR REPLACE FUNCTION trigger_cleanup_attestations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM cleanup_attestations_orphelines();
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS after_rapport_delete_cleanup_attestations ON rapport;
CREATE TRIGGER after_rapport_delete_cleanup_attestations
  AFTER DELETE ON rapport
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_attestations();

DROP TRIGGER IF EXISTS after_affaire_delete_cleanup_attestations ON affaire;
CREATE TRIGGER after_affaire_delete_cleanup_attestations
  AFTER DELETE ON affaire
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_attestations();

DROP TRIGGER IF EXISTS after_terme_delete_cleanup_attestations ON terme;
CREATE TRIGGER after_terme_delete_cleanup_attestations
  AFTER DELETE ON terme
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_attestations();
