/*
  # Corriger le calcul du solde dans la table liste_credits

  1. Problème
    - Le solde était calculé comme : solde = prime - paiement
    - Doit être : solde = montant_credit - paiement

  2. Solution
    - Mettre à jour la fonction calculate_solde()
    - Recalculer tous les soldes existants
    - Le solde représente ce qui reste à payer du crédit

  3. Logique
    - solde = montant_credit - paiement
    - Si solde > 0 : il reste à payer
    - Si solde = 0 : crédit entièrement payé
    - Si solde < 0 : trop-perçu (rare)
*/

-- Mettre à jour la fonction de calcul du solde
CREATE OR REPLACE FUNCTION calculate_solde()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer le solde : solde = montant_credit - paiement
    NEW.solde := NEW.montant_credit - COALESCE(NEW.paiement, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recalculer le solde pour tous les enregistrements existants
UPDATE liste_credits 
SET solde = montant_credit - COALESCE(paiement, 0);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Calcul du solde corrigé dans liste_credits';
    RAISE NOTICE '   - Nouvelle formule: solde = montant_credit - paiement';
    RAISE NOTICE '   - Tous les soldes existants recalculés';
    RAISE NOTICE '   - Trigger mis à jour pour les futurs calculs';
END $$;
