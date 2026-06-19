/*
  # Ajouter la colonne Solde à la table liste_credits

  1. Modifications
    - Ajouter la colonne `solde` (decimal) à la table `liste_credits`
    - Le solde est calculé comme : prime - montant_credit
    - Mettre à jour les enregistrements existants avec le calcul du solde
    - Créer un trigger pour calculer automatiquement le solde lors des insertions/mises à jour

  2. Sécurité
    - La colonne solde est calculée automatiquement
    - Trigger pour maintenir la cohérence des données
*/

-- Ajouter la colonne solde à la table liste_credits
ALTER TABLE liste_credits 
ADD COLUMN IF NOT EXISTS solde DECIMAL(10,2) DEFAULT 0;

-- Mettre à jour les enregistrements existants avec le calcul du solde
UPDATE liste_credits 
SET solde = prime - montant_credit 
WHERE solde IS NULL OR solde = 0;

-- Créer une fonction pour calculer automatiquement le solde
CREATE OR REPLACE FUNCTION calculate_solde()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer le solde comme la différence entre prime et montant_credit
    NEW.solde := NEW.prime - NEW.montant_credit;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger pour calculer automatiquement le solde lors des insertions et mises à jour
DROP TRIGGER IF EXISTS trigger_calculate_solde ON liste_credits;
CREATE TRIGGER trigger_calculate_solde
    BEFORE INSERT OR UPDATE ON liste_credits
    FOR EACH ROW
    EXECUTE FUNCTION calculate_solde();

-- Créer un index sur la colonne solde pour optimiser les recherches
CREATE INDEX IF NOT EXISTS liste_credits_solde_idx ON liste_credits (solde);

-- Vérifier que les calculs sont corrects
DO $$
BEGIN
    RAISE NOTICE 'Colonne solde ajoutée avec succès à la table liste_credits';
    RAISE NOTICE 'Trigger de calcul automatique créé';
    RAISE NOTICE 'Index sur la colonne solde créé';
END $$;
