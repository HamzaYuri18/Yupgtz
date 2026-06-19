/*
  # Corriger la logique du montant dans la table rapport

  1. Objectif
    - Le montant dans la table rapport doit toujours être la valeur de la prime saisie
    - Ne pas soustraire le montant du crédit du montant principal
    - Le crédit est enregistré séparément dans montant_credit

  2. Modifications
    - Supprimer le trigger qui modifie le montant
    - Le montant = prime (toujours)
    - montant_credit = valeur du crédit (si applicable)

  3. Logique finale
    - prime = valeur de la prime TTC saisie au formulaire
    - montant = prime (même valeur, pas de calcul)
    - montant_credit = montant du crédit (ou NULL si pas de crédit)
*/

-- Supprimer l'ancien trigger qui modifiait le montant
DROP TRIGGER IF EXISTS trigger_calculate_rapport_montant ON rapport;
DROP FUNCTION IF EXISTS calculate_rapport_montant();

-- Créer une nouvelle fonction qui ne modifie PAS le montant
CREATE OR REPLACE FUNCTION handle_rapport_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Le montant reste toujours égal à la prime saisie
    -- Pas de calcul, pas de soustraction du crédit
    NEW.montant := NEW.prime;
    
    -- Si le type de paiement est "Au comptant", mettre les valeurs crédit à NULL
    IF NEW.type_paiement = 'Au comptant' THEN
        NEW.montant_credit := NULL;
        NEW.date_paiement_prevue := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le nouveau trigger
CREATE TRIGGER trigger_handle_rapport_data
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION handle_rapport_data();

-- Mettre à jour tous les enregistrements existants
-- Le montant doit être égal à la prime (pas de soustraction du crédit)
UPDATE rapport 
SET montant = prime;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Logique du montant corrigée dans la table rapport';
    RAISE NOTICE '   - montant = prime (toujours la valeur saisie)';
    RAISE NOTICE '   - montant_credit = valeur du crédit (séparée)';
    RAISE NOTICE '   - Pas de soustraction du crédit du montant principal';
    RAISE NOTICE '   - Tous les enregistrements existants mis à jour';
END $$;
