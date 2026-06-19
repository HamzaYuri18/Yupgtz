/*
  # Corriger le calcul du montant pour les types de paiement crédit

  1. Objectif
    - Si type_paiement = 'Crédit' : montant = prime - montant_credit
    - Si type_paiement = 'Au comptant' : montant = prime
    - Créer un trigger pour calculer automatiquement le montant

  2. Modifications
    - Créer une fonction de calcul du montant basée sur le type de paiement
    - Créer un trigger pour les insertions/mises à jour
    - Recalculer tous les montants existants

  3. Logique finale
    - prime = valeur de la prime TTC saisie au formulaire (inchangée)
    - montant_credit = montant du crédit saisi (ou NULL)
    - montant = prime - montant_credit (si type_paiement = 'Crédit'), sinon montant = prime
*/

-- Créer une fonction pour calculer automatiquement le montant selon le type de paiement
CREATE OR REPLACE FUNCTION calculate_rapport_montant_by_payment_type()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer le montant selon le type de paiement :
    -- Si type_paiement = 'Crédit' et montant_credit existe : montant = prime - montant_credit
    -- Sinon : montant = prime
    IF NEW.type_paiement = 'Crédit' AND NEW.montant_credit IS NOT NULL AND NEW.montant_credit > 0 THEN
        NEW.montant := NEW.prime - NEW.montant_credit;
    ELSE
        NEW.montant := NEW.prime;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_calculate_rapport_montant ON rapport;
DROP TRIGGER IF EXISTS trigger_calculate_rapport_montant_by_payment_type ON rapport;

-- Créer le nouveau trigger
CREATE TRIGGER trigger_calculate_rapport_montant_by_payment_type
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION calculate_rapport_montant_by_payment_type();

-- Recalculer tous les montants existants avec la nouvelle logique
UPDATE rapport 
SET montant = CASE 
    WHEN type_paiement = 'Crédit' AND montant_credit IS NOT NULL AND montant_credit > 0 THEN 
        prime - montant_credit
    ELSE 
        prime
END;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Calcul du montant corrigé selon le type de paiement';
    RAISE NOTICE '   - Si type_paiement = ''Crédit'' : montant = prime - montant_credit';
    RAISE NOTICE '   - Si type_paiement = ''Au comptant'' : montant = prime';
    RAISE NOTICE '   - Trigger créé pour les futurs calculs automatiques';
    RAISE NOTICE '   - Tous les montants existants recalculés';
END $$;
