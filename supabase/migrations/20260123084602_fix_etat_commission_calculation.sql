/*
  # Fix etat_commission Calculation Logic

  1. Problem
    - The previous trigger had incorrect logic mixing charges and depenses
    - The FULL OUTER JOIN was creating incorrect calculations
    - Excluded depense types didn't match frontend logic

  2. Solution
    - Commission = SUM(total_espece) from sessions
    - Total Charges = SUM(charges) from sessions only
    - Total Depenses = SUM(montant) from depenses excluding specific types
    - Commission Nette = Commission - Total Charges - Total Depenses

  3. Excluded Depense Types
    - Versement Bancaire
    - A/S Ahlem
    - A/S Islem
    - Reprise sur Avance Client
*/

CREATE OR REPLACE FUNCTION update_etat_commission()
RETURNS VOID AS $$
DECLARE
  rec RECORD;
  v_commission NUMERIC;
  v_total_charges NUMERIC;
  v_total_depenses NUMERIC;
BEGIN
  FOR rec IN SELECT DISTINCT id, annee, mois, quinzaine, date_debut, date_fin FROM etat_commission
  LOOP
    -- Calculate Commission from sessions (total_espece)
    SELECT COALESCE(SUM(COALESCE(total_espece, 0)), 0)
    INTO v_commission
    FROM sessions
    WHERE date_session >= rec.date_debut
      AND date_session <= rec.date_fin;

    -- Calculate Total Charges from sessions (charges column)
    SELECT COALESCE(SUM(COALESCE(charges, 0)), 0)
    INTO v_total_charges
    FROM sessions
    WHERE date_session >= rec.date_debut
      AND date_session <= rec.date_fin;

    -- Calculate Total Depenses excluding specific types
    SELECT COALESCE(SUM(COALESCE(montant, 0)), 0)
    INTO v_total_depenses
    FROM depenses
    WHERE date_depense >= rec.date_debut
      AND date_depense <= rec.date_fin
      AND type_depense NOT IN (
        'Versement Bancaire',
        'A/S Ahlem',
        'A/S Islem',
        'Reprise sur Avance Client'
      );

    -- Update the etat_commission record
    UPDATE etat_commission
    SET
      commission = v_commission,
      total_charges = v_total_charges,
      total_depenses = v_total_depenses,
      commission_nette = v_commission - v_total_charges - v_total_depenses,
      updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger function (no changes needed)
CREATE OR REPLACE FUNCTION trigger_update_etat_commission()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_etat_commission();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers are in place (idempotent)
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

-- Perform initial calculation to fix existing records
SELECT update_etat_commission();
