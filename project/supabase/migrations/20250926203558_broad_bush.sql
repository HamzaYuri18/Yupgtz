/*
  # Corriger le calcul du montant dans la table rapport

  1. Objectif
    - Si montant_credit n'est pas NULL : montant = prime - montant_credit
    - Si montant_credit est NULL : montant = prime
    - Créer un trigger pour calculer automatiquement le montant

  2. Modifications
    - Créer une fonction de calcul du montant
    - Créer un trigger pour les insertions/mises à jour
    - Recalculer tous les montants existants

  3. Logique finale
    - prime = valeur de la prime TTC saisie au formulaire (inchangée)
    - montant_credit = montant du crédit saisi (ou NULL)
    - montant = prime - montant_credit (si montant_credit existe), sinon montant = prime
*/

-- Créer une fonction pour calculer automatiquement le montant
CREATE OR REPLACE FUNCTION calculate_rapport_montant()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer le montant selon la logique :
    -- Si montant_credit existe : montant = prime - montant_credit
    -- Sinon : montant = prime
    IF NEW.montant_credit IS NOT NULL AND NEW.montant_credit > 0 THEN
        NEW.montant := NEW.prime - NEW.montant_credit;
    ELSE
        NEW.montant := NEW.prime;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_calculate_rapport_montant ON rapport;

-- Créer le nouveau trigger
CREATE TRIGGER trigger_calculate_rapport_montant
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION calculate_rapport_montant();

-- Recalculer tous les montants existants avec la nouvelle logique
UPDATE rapport 
SET montant = CASE 
    WHEN montant_credit IS NOT NULL AND montant_credit > 0 THEN 
        prime - montant_credit
    ELSE 
        prime
END;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Calcul du montant corrigé dans la table rapport';
    RAISE NOTICE '   - Si montant_credit existe : montant = prime - montant_credit';
    RAISE NOTICE '   - Si montant_credit est NULL : montant = prime';
    RAISE NOTICE '   - Trigger créé pour les futurs calculs automatiques';
    RAISE NOTICE '   - Tous les montants existants recalculés';
END $$;
