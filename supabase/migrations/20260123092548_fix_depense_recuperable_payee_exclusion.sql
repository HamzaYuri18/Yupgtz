/*
  # Exclure les Dépenses Récupérables Payées du calcul des dépenses

  1. Problème
    - Les dépenses de type "Dépense Récupérable" avec statut "Payé" sont actuellement incluses dans le calcul des dépenses
    - Ces dépenses devraient être exclues car elles ont été récupérées/remboursées

  2. Solution
    - Modifier la fonction update_etat_commission() pour exclure les dépenses récupérables payées
    - Les dépenses récupérables non payées continueront d'être comptabilisées
    - Les autres dépenses restent inchangées

  3. Logique mise à jour
    - Total Depenses exclut:
      * 'Versement Bancaire'
      * 'A/S Ahlem'
      * 'A/S Islem'
      * 'Reprise sur Avance Client'
      * 'Dépense Récupérable' dont statut_depense = 'Payé'
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

    -- Calculate Total Depenses excluding specific types and paid recuperable expenses
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
      )
      AND NOT (type_depense = 'Dépense Récupérable' AND statut_depense = 'Payé');

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

-- Recalculate all periods with the new logic
SELECT update_etat_commission();
