/*
  # Add Automatic Update Triggers for etat_commission

  1. Functions
    - Create function to recalculate etat_commission based on sessions, charges, and depenses
    - Updates commission, total_charges, total_depenses, and commission_nette automatically

  2. Triggers
    - Add trigger on sessions table for INSERT, UPDATE, DELETE
    - Add trigger on depenses table for INSERT, UPDATE, DELETE
    - Add trigger on recettes_exceptionnelles table for INSERT, UPDATE, DELETE
    - Each trigger calls the update function to refresh etat_commission

  3. Logic
    - For each etat_commission period (annee, mois, quinzaine):
      - Commission = sum of total_espece from sessions within date_debut to date_fin
      - Total Charges = sum of charges from sessions + sum of montant from depenses where type_depense NOT IN ('Depense Recuperable', 'Recuperation Depense')
      - Total Depenses = sum of montant from depenses where type_depense IN ('Depense Recuperable', 'Recuperation Depense')
      - Commission Nette = Commission - Total Charges - Total Depenses
*/

CREATE OR REPLACE FUNCTION update_etat_commission()
RETURNS VOID AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Get all periods from etat_commission
  FOR rec IN SELECT DISTINCT id, annee, mois, quinzaine, date_debut, date_fin FROM etat_commission
  LOOP
    UPDATE etat_commission
    SET
      commission = COALESCE((
        SELECT SUM(COALESCE(total_espece, 0))
        FROM sessions
        WHERE date_session >= rec.date_debut
        AND date_session <= rec.date_fin
      ), 0),
      total_charges = COALESCE((
        SELECT SUM(COALESCE(s.charges, 0)) + SUM(COALESCE(d.montant, 0))
        FROM sessions s
        FULL OUTER JOIN depenses d ON d.date_depense >= rec.date_debut AND d.date_depense <= rec.date_fin
        WHERE s.date_session >= rec.date_debut AND s.date_session <= rec.date_fin
        AND (d.type_depense NOT IN ('Depense Recuperable', 'Recuperation Depense') OR d.type_depense IS NULL)
      ), 0),
      total_depenses = COALESCE((
        SELECT SUM(COALESCE(montant, 0))
        FROM depenses
        WHERE date_depense >= rec.date_debut
        AND date_depense <= rec.date_fin
        AND type_depense IN ('Depense Recuperable', 'Recuperation Depense')
      ), 0),
      updated_at = now()
    WHERE id = rec.id;
  END LOOP;

  -- Update commission_nette for all records
  UPDATE etat_commission
  SET commission_nette = commission - total_charges - total_depenses,
      updated_at = now()
  WHERE commission_nette != (commission - total_charges - total_depenses);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_update_etat_commission()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_etat_commission();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sessions_update_etat_commission ON sessions;
CREATE TRIGGER trigger_sessions_update_etat_commission
AFTER INSERT OR UPDATE OR DELETE ON sessions
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_update_etat_commission();

DROP TRIGGER IF EXISTS trigger_depenses_update_etat_commission ON depenses;
CREATE TRIGGER trigger_depenses_update_etat_commission
AFTER INSERT OR UPDATE OR DELETE ON depenses
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_update_etat_commission();

DROP TRIGGER IF EXISTS trigger_recettes_update_etat_commission ON recettes_exceptionnelles;
CREATE TRIGGER trigger_recettes_update_etat_commission
AFTER INSERT OR UPDATE OR DELETE ON recettes_exceptionnelles
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_update_etat_commission();