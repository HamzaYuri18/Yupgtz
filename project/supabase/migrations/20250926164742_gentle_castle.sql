/*
  # Ajouter la colonne montant_credit à la table rapport

  1. Nouvelle colonne
    - `montant_credit` (decimal, nullable) - Montant du crédit s'il existe
    - NULL si pas de crédit, valeur du crédit sinon

  2. Logique de calcul
    - montant = prime - montant_credit (si montant_credit existe)
    - montant = prime (si montant_credit est NULL)

  3. Trigger
    - Créer un trigger pour calculer automatiquement le montant
    - Mise à jour automatique lors des insertions/modifications

  4. Migration des données
    - Mettre à jour les enregistrements existants
    - Recalculer les montants selon la nouvelle logique
*/

-- Ajouter la colonne montant_credit à la table rapport
ALTER TABLE rapport 
ADD COLUMN IF NOT EXISTS montant_credit DECIMAL(10,2);

-- Créer une fonction pour calculer automatiquement le montant
CREATE OR REPLACE FUNCTION calculate_rapport_montant()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer le montant selon la logique : montant = prime - montant_credit
    -- Si montant_credit est NULL, montant = prime
    IF NEW.montant_credit IS NOT NULL THEN
        NEW.montant := NEW.prime - NEW.montant_credit;
    ELSE
        NEW.montant := NEW.prime;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger pour calculer automatiquement le montant
DROP TRIGGER IF EXISTS trigger_calculate_rapport_montant ON rapport;
CREATE TRIGGER trigger_calculate_rapport_montant
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION calculate_rapport_montant();

-- Mettre à jour les enregistrements existants
-- Pour les contrats de type 'Crédit', définir montant_credit comme la valeur absolue du montant négatif
UPDATE rapport 
SET montant_credit = ABS(montant)
WHERE type = 'Crédit' AND montant < 0;

-- Pour les autres types, laisser montant_credit à NULL et recalculer le montant
UPDATE rapport 
SET montant_credit = NULL
WHERE type != 'Crédit';

-- Recalculer tous les montants avec la nouvelle logique
UPDATE rapport 
SET montant = CASE 
    WHEN montant_credit IS NOT NULL THEN prime - montant_credit
    ELSE prime
END;

-- Créer un index sur la colonne montant_credit pour optimiser les recherches
CREATE INDEX IF NOT EXISTS rapport_montant_credit_idx ON rapport (montant_credit);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Colonne montant_credit ajoutée à la table rapport avec succès';
    RAISE NOTICE '   - Trigger créé pour calculer automatiquement le montant';
    RAISE NOTICE '   - Logique: montant = prime - montant_credit (si montant_credit existe)';
    RAISE NOTICE '   - Logique: montant = prime (si montant_credit est NULL)';
    RAISE NOTICE '   - Données existantes migrées et recalculées';
    RAISE NOTICE '   - Index créé pour optimiser les performances';
END $$;
