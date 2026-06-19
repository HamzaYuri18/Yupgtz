/*
  # Corriger le calcul du montant dans la table rapport

  1. Problème
    - La fonction calculate_rapport_montant() peut mal calculer le montant
    - La colonne prime doit toujours contenir la valeur de la prime saisie au formulaire
    - Le montant doit être calculé comme : prime - montant_credit (si crédit existe)

  2. Solution
    - Mettre à jour la fonction de calcul
    - Recalculer tous les montants existants
    - S'assurer que prime = valeur saisie au formulaire

  3. Logique finale
    - prime = valeur saisie au formulaire (inchangée)
    - montant_credit = montant du crédit saisi (ou NULL)
    - montant = prime - montant_credit (si montant_credit existe), sinon montant = prime
*/

-- Mettre à jour la fonction de calcul du montant
CREATE OR REPLACE FUNCTION calculate_rapport_montant()
RETURNS TRIGGER AS $$
BEGIN
    -- S'assurer que prime contient la valeur de la prime saisie au formulaire
    -- (cette valeur ne doit jamais être modifiée par le trigger)
    
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

-- Recalculer tous les montants existants avec la logique correcte
UPDATE rapport 
SET montant = CASE 
    WHEN montant_credit IS NOT NULL AND montant_credit > 0 THEN 
        prime - montant_credit
    ELSE 
        prime
END;

-- Vérification et correction des données pour les types spéciaux
-- Pour les entrées de type 'Crédit', s'assurer que le montant est négatif
UPDATE rapport 
SET montant = -ABS(montant_credit)
WHERE type = 'Crédit' AND montant_credit IS NOT NULL;

-- Pour les dépenses, ristournes et sinistres, s'assurer que le montant est négatif
UPDATE rapport 
SET montant = -ABS(montant)
WHERE type IN ('Dépense', 'Ristourne', 'Sinistre') AND montant > 0;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Calcul du montant corrigé dans la table rapport';
    RAISE NOTICE '   - prime = valeur saisie au formulaire (inchangée)';
    RAISE NOTICE '   - montant = prime - montant_credit (si crédit existe)';
    RAISE NOTICE '   - montant = prime (si pas de crédit)';
    RAISE NOTICE '   - Tous les montants existants recalculés';
    RAISE NOTICE '   - Types spéciaux (Crédit, Dépense, etc.) avec montants négatifs';
END $$;
