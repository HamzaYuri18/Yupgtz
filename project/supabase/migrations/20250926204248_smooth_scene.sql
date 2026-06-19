/*
  # Corriger définitivement le calcul du montant dans la table rapport

  1. Objectif
    - Si type_paiement = 'Crédit' ET montant_credit existe : montant = prime - montant_credit
    - Si type_paiement = 'Au comptant' : montant = prime
    - Créer un trigger robuste qui fonctionne réellement

  2. Modifications
    - Supprimer tous les anciens triggers et fonctions
    - Créer une nouvelle fonction simple et efficace
    - Créer un nouveau trigger
    - Recalculer tous les montants existants

  3. Debug
    - Ajouter des logs pour vérifier le fonctionnement
    - Tester la logique avec des cas concrets
*/

-- Supprimer tous les anciens triggers et fonctions liés au calcul du montant
DROP TRIGGER IF EXISTS trigger_calculate_rapport_montant ON rapport;
DROP TRIGGER IF EXISTS trigger_calculate_rapport_montant_by_payment_type ON rapport;
DROP TRIGGER IF EXISTS trigger_handle_rapport_data ON rapport;
DROP FUNCTION IF EXISTS calculate_rapport_montant();
DROP FUNCTION IF EXISTS calculate_rapport_montant_by_payment_type();
DROP FUNCTION IF EXISTS handle_rapport_data();

-- Créer une nouvelle fonction simple et robuste
CREATE OR REPLACE FUNCTION calculate_montant_rapport()
RETURNS TRIGGER AS $$
BEGIN
    -- Log pour debug
    RAISE NOTICE 'Calcul montant pour: type_paiement=%, prime=%, montant_credit=%', 
        NEW.type_paiement, NEW.prime, NEW.montant_credit;
    
    -- Logique de calcul selon le type de paiement
    IF NEW.type_paiement = 'Crédit' AND NEW.montant_credit IS NOT NULL AND NEW.montant_credit > 0 THEN
        -- Pour les crédits : montant = prime - montant_credit
        NEW.montant := NEW.prime - NEW.montant_credit;
        RAISE NOTICE 'Crédit détecté: montant calculé = % - % = %', NEW.prime, NEW.montant_credit, NEW.montant;
    ELSE
        -- Pour les paiements au comptant : montant = prime
        NEW.montant := NEW.prime;
        RAISE NOTICE 'Au comptant: montant = prime = %', NEW.montant;
    END IF;
    
    -- Gérer les valeurs NULL pour les paiements au comptant
    IF NEW.type_paiement = 'Au comptant' THEN
        NEW.montant_credit := NULL;
        NEW.date_paiement_prevue := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le nouveau trigger
CREATE TRIGGER trigger_calculate_montant_rapport
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION calculate_montant_rapport();

-- Recalculer tous les montants existants avec la nouvelle logique
UPDATE rapport 
SET montant = CASE 
    WHEN type_paiement = 'Crédit' AND montant_credit IS NOT NULL AND montant_credit > 0 THEN 
        prime - montant_credit
    ELSE 
        prime
END;

-- Vérifier les résultats avec quelques exemples
DO $$
DECLARE
    test_record RECORD;
    total_records INTEGER;
    credit_records INTEGER;
    comptant_records INTEGER;
BEGIN
    -- Compter les enregistrements
    SELECT COUNT(*) INTO total_records FROM rapport;
    SELECT COUNT(*) INTO credit_records FROM rapport WHERE type_paiement = 'Crédit';
    SELECT COUNT(*) INTO comptant_records FROM rapport WHERE type_paiement = 'Au comptant';
    
    RAISE NOTICE '📊 STATISTIQUES APRÈS MIGRATION :';
    RAISE NOTICE '   - Total des enregistrements : %', total_records;
    RAISE NOTICE '   - Enregistrements Crédit : %', credit_records;
    RAISE NOTICE '   - Enregistrements Au comptant : %', comptant_records;
    
    -- Afficher quelques exemples
    FOR test_record IN 
        SELECT id, type_paiement, prime, montant_credit, montant 
        FROM rapport 
        LIMIT 5
    LOOP
        RAISE NOTICE '   Exemple ID %: type_paiement=%, prime=%, montant_credit=%, montant=%', 
            test_record.id, test_record.type_paiement, test_record.prime, 
            test_record.montant_credit, test_record.montant;
    END LOOP;
END $$;

-- Message de confirmation final
DO $$
BEGIN
    RAISE NOTICE '✅ Trigger de calcul du montant corrigé définitivement';
    RAISE NOTICE '   - Fonction calculate_montant_rapport() créée';
    RAISE NOTICE '   - Trigger trigger_calculate_montant_rapport créé';
    RAISE NOTICE '   - Logique: Si Crédit → montant = prime - montant_credit';
    RAISE NOTICE '   - Logique: Si Au comptant → montant = prime';
    RAISE NOTICE '   - Tous les montants existants recalculés';
    RAISE NOTICE '   - Logs activés pour debug';
END $$;
