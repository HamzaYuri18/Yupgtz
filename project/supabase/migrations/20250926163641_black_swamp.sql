/*
  # Correction du trigger handle_rapport_nulls avec CASCADE

  1. Problème
    - Le trigger `handle_rapport_nulls` fait encore référence à la colonne `montant_credit` qui a été supprimée
    - Erreur: "record 'new' has no field 'montant_credit'"
    - Impossible de supprimer la fonction sans CASCADE car le trigger en dépend

  2. Solution
    - Utiliser DROP ... CASCADE pour supprimer la fonction et le trigger dépendant
    - Recréer la fonction sans référence à montant_credit
    - Recréer le trigger

  3. Changements
    - Suppression de `NEW.montant_credit := NULL;`
    - Conservation de `NEW.date_paiement_prevue := NULL;`
*/

-- Supprimer l'ancienne fonction avec CASCADE (supprime aussi le trigger dépendant)
DROP FUNCTION IF EXISTS handle_rapport_nulls() CASCADE;

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
CREATE TRIGGER trigger_handle_rapport_nulls
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION handle_rapport_nulls();

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Trigger handle_rapport_nulls corrigé avec CASCADE';
    RAISE NOTICE '   - Fonction et trigger supprimés puis recréés';
    RAISE NOTICE '   - Suppression de la référence à montant_credit';
    RAISE NOTICE '   - Conservation de la logique pour date_paiement_prevue';
END $$;
