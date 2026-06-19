/*
  # Correction du trigger handle_rapport_nulls

  1. Problème
    - Le trigger `handle_rapport_nulls` fait encore référence à la colonne `montant_credit` qui a été supprimée
    - Cela cause l'erreur: record "new" has no field "montant_credit"

  2. Solution
    - Mettre à jour la fonction `handle_rapport_nulls()` pour supprimer la référence à `montant_credit`
    - Garder seulement la logique pour `date_paiement_prevue`

  3. Changements
    - Suppression de `NEW.montant_credit := NULL;`
    - Conservation de `NEW.date_paiement_prevue := NULL;`
*/

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS handle_rapport_nulls();

-- Créer la nouvelle fonction sans référence à montant_credit
CREATE OR REPLACE FUNCTION handle_rapport_nulls()
RETURNS TRIGGER AS $$
BEGIN
    -- Si le type de paiement est "Au comptant", mettre la date de paiement prévue à NULL
    IF NEW.type_paiement = 'Au comptant' THEN
        NEW.date_paiement_prevue := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trigger_handle_rapport_nulls ON rapport;
CREATE TRIGGER trigger_handle_rapport_nulls
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION handle_rapport_nulls();

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Trigger handle_rapport_nulls corrigé';
    RAISE NOTICE '   - Suppression de la référence à montant_credit';
    RAISE NOTICE '   - Conservation de la logique pour date_paiement_prevue';
END $$;
