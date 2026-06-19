/*
  # Ajouter la colonne montant à la table rapport

  1. Nouvelle colonne
    - `montant` (decimal, not null, default 0) - Montant unifié pour tous les types
    - Positif pour : Terme, Affaire, Recettes exceptionnelles
    - Négatif pour : Dépenses, Ristournes, Sinistres

  2. Migration des données existantes
    - Copier les valeurs de la colonne `prime` vers `montant`
    - Maintenir la compatibilité avec les données existantes

  3. Index
    - Index sur la colonne montant pour optimiser les calculs de totaux
*/

-- Ajouter la colonne montant à la table rapport
ALTER TABLE rapport 
ADD COLUMN IF NOT EXISTS montant DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Migrer les données existantes : copier prime vers montant
UPDATE rapport 
SET montant = COALESCE(prime, 0)
WHERE montant = 0;

-- Créer un index sur la colonne montant pour optimiser les calculs
CREATE INDEX IF NOT EXISTS rapport_montant_idx ON rapport (montant);

-- Créer un trigger pour maintenir la cohérence entre prime et montant
CREATE OR REPLACE FUNCTION sync_prime_montant()
RETURNS TRIGGER AS $$
BEGIN
    -- Si montant est fourni, utiliser montant
    -- Sinon, utiliser prime (pour compatibilité)
    IF NEW.montant IS NOT NULL AND NEW.montant != 0 THEN
        NEW.prime := NEW.montant;
    ELSIF NEW.prime IS NOT NULL THEN
        NEW.montant := NEW.prime;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_sync_prime_montant ON rapport;
CREATE TRIGGER trigger_sync_prime_montant
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION sync_prime_montant();

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Colonne montant ajoutée à la table rapport avec succès';
    RAISE NOTICE '   - Données existantes migrées de prime vers montant';
    RAISE NOTICE '   - Index créé pour optimiser les calculs de totaux';
    RAISE NOTICE '   - Trigger créé pour maintenir la cohérence prime/montant';
    RAISE NOTICE '   - Positif: Terme, Affaire, Recettes | Négatif: Dépenses, Ristournes, Sinistres';
END $$;
