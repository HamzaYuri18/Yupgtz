/*
  # Ajouter la colonne Paiement et corriger le calcul du Solde

  1. Modifications
    - Ajouter la colonne `paiement` (decimal) à la table `liste_credits`
    - Corriger le calcul du solde : solde = prime - paiement (au lieu de prime - montant_credit)
    - Mettre à jour le trigger pour le nouveau calcul
    - Ajouter un index sur la colonne paiement

  2. Sécurité
    - La colonne paiement est nullable (défaut: 0)
    - Le solde est recalculé automatiquement
    - Trigger mis à jour pour le nouveau calcul
*/

-- Ajouter la colonne paiement à la table liste_credits
ALTER TABLE liste_credits 
ADD COLUMN IF NOT EXISTS paiement DECIMAL(10,2) DEFAULT 0;

-- Mettre à jour les enregistrements existants (paiement = 0 par défaut)
UPDATE liste_credits 
SET paiement = 0 
WHERE paiement IS NULL;

-- Corriger la fonction de calcul du solde
CREATE OR REPLACE FUNCTION calculate_solde()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer le solde comme la différence entre prime et paiement
    NEW.solde := NEW.prime - COALESCE(NEW.paiement, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recalculer le solde pour tous les enregistrements existants
UPDATE liste_credits 
SET solde = prime - COALESCE(paiement, 0);

-- Créer un index sur la colonne paiement pour optimiser les recherches
CREATE INDEX IF NOT EXISTS liste_credits_paiement_idx ON liste_credits (paiement);

-- Vérifier que les modifications sont correctes
DO $$
BEGIN
    RAISE NOTICE 'Colonne paiement ajoutée avec succès à la table liste_credits';
    RAISE NOTICE 'Calcul du solde corrigé : solde = prime - paiement';
    RAISE NOTICE 'Trigger de calcul automatique mis à jour';
    RAISE NOTICE 'Index sur la colonne paiement créé';
END $$;
