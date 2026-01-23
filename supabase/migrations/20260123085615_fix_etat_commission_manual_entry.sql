/*
  # Fix etat_commission to allow manual commission entry

  1. Problem
    - The automatic trigger was overwriting manually entered commission values
    - Users need to be able to manually set commission values

  2. Solution
    - Only recalculate total_charges and total_depenses automatically
    - Do NOT recalculate commission automatically
    - Commission should be manually entered by the user
    - Commission_nette = commission - total_charges - total_depenses (using manually entered commission)

  3. Changes
    - Remove commission calculation from trigger
    - Keep automatic calculation for charges and depenses only
    - Update commission_nette using the manual commission value
*/

CREATE OR REPLACE FUNCTION update_etat_commission()
RETURNS VOID AS $$
DECLARE
  rec RECORD;
  v_total_charges NUMERIC;
  v_total_depenses NUMERIC;
BEGIN
  FOR rec IN SELECT DISTINCT id, annee, mois, quinzaine, date_debut, date_fin, commission FROM etat_commission
  LOOP
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

    -- Update only charges, depenses and commission_nette
    -- DO NOT update commission (keep manual value)
    UPDATE etat_commission
    SET
      total_charges = v_total_charges,
      total_depenses = v_total_depenses,
      commission_nette = COALESCE(commission, 0) - v_total_charges - v_total_depenses,
      updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- The trigger function remains the same
CREATE OR REPLACE FUNCTION trigger_update_etat_commission()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_etat_commission();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers are in place
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

-- Recalculate charges and depenses for existing records (without touching commission)
SELECT update_etat_commission();
