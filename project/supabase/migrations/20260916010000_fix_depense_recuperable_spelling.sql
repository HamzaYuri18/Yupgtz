/*
  # Corriger l'orthographe de "Depense Recuperable" dans update_etat_commission()

  1. Problème
    - La migration précédente (20260916000000) excluait 'Dépense Récupérable'
      (avec accents), mais la vraie valeur stockée dans depenses.type_depense
      est 'Depense Recuperable' (sans accents — voir le <select> dans
      FinancialManagement.tsx). L'exclusion ne correspondait donc jamais à
      aucune ligne réelle, et le montant restait compté dans total_depenses.

  2. Solution
    - Utiliser la valeur exacte 'Depense Recuperable' et recalculer
      immédiatement toutes les périodes existantes.
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
    SELECT COALESCE(SUM(COALESCE(charges, 0)), 0)
    INTO v_total_charges
    FROM sessions
    WHERE date_session >= rec.date_debut
      AND date_session <= rec.date_fin;

    SELECT COALESCE(SUM(COALESCE(montant, 0)), 0)
    INTO v_total_depenses
    FROM depenses
    WHERE date_depense >= rec.date_debut
      AND date_depense <= rec.date_fin
      AND type_depense NOT IN (
        'Versement Bancaire',
        'A/S Ahlem',
        'A/S Islem',
        'Reprise sur Avance Client',
        'Depense Recuperable'
      );

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

-- Recalculate all periods with the corrected spelling
SELECT update_etat_commission();
