/*
  # Exclure systématiquement les Dépenses Récupérables du calcul des dépenses

  1. Problème
    - update_etat_commission() n'excluait les dépenses de type
      "Dépense Récupérable" que lorsque leur statut_depense valait 'Payé'.
    - Une dépense récupérable non payée (ex: 800 DT sur la 2ème quinzaine
      d'août 2026) était donc toujours comptabilisée dans total_depenses,
      alors que ce type de dépense ne doit jamais impacter la colonne
      DEPENSES, quel que soit son statut.

  2. Solution
    - Exclure 'Dépense Récupérable' du calcul sans condition de statut,
      comme les autres types déjà exclus.
    - Recalculer immédiatement toutes les périodes existantes pour
      corriger les totaux déjà stockés (ex: le 800 DT signalé).
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

    -- Calculate Total Depenses excluding specific types (incl. all Dépense Récupérable)
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
        'Dépense Récupérable'
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

-- Recalculate all periods with the new logic (corrige immédiatement les totaux déjà stockés)
SELECT update_etat_commission();
