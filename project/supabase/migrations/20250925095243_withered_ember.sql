/*
  # Correction du calcul du solde dans la table liste_credits

  1. Objectif
    - Corriger la formule : solde = prime - paiement
    - Valeur initiale de paiement = 0
    - Recalculer tous les soldes existants

  2. Modifications
    - Vérifier et ajouter la colonne paiement si nécessaire
    - Mettre à jour la fonction de calcul du solde
    - Recalculer tous les soldes existants
    - Créer un trigger pour les futurs calculs automatiques

  3. Sécurité
    - Vérifications d'existence avant modifications
    - Gestion des valeurs NULL
    - Messages de confirmation
*/

-- Étape 1: Vérifier et ajouter la colonne paiement si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'liste_credits' AND column_name = 'paiement'
  ) THEN
    ALTER TABLE liste_credits ADD COLUMN paiement DECIMAL(10,2) DEFAULT 0;
    RAISE NOTICE '✅ Colonne paiement ajoutée à la table liste_credits';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne paiement existe déjà dans la table liste_credits';
  END IF;
END $$;

-- Étape 2: Vérifier et ajouter la colonne solde si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'liste_credits' AND column_name = 'solde'
  ) THEN
    ALTER TABLE liste_credits ADD COLUMN solde DECIMAL(10,2) DEFAULT 0;
    RAISE NOTICE '✅ Colonne solde ajoutée à la table liste_credits';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne solde existe déjà dans la table liste_credits';
  END IF;
END $$;

-- Étape 3: Initialiser la valeur de paiement à 0 pour tous les enregistrements
UPDATE liste_credits 
SET paiement = 0 
WHERE paiement IS NULL;

RAISE NOTICE '✅ Valeurs de paiement initialisées à 0';

-- Étape 4: Créer ou remplacer la fonction de calcul du solde
CREATE OR REPLACE FUNCTION calculate_solde()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer le solde : solde = prime - paiement
    NEW.solde := NEW.prime - COALESCE(NEW.paiement, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE '✅ Fonction calculate_solde() créée/mise à jour';

-- Étape 5: Supprimer l'ancien trigger s'il existe et créer le nouveau
DROP TRIGGER IF EXISTS trigger_calculate_solde ON liste_credits;

CREATE TRIGGER trigger_calculate_solde
    BEFORE INSERT OR UPDATE ON liste_credits
    FOR EACH ROW
    EXECUTE FUNCTION calculate_solde();

RAISE NOTICE '✅ Trigger trigger_calculate_solde créé';

-- Étape 6: Recalculer le solde pour tous les enregistrements existants
UPDATE liste_credits 
SET solde = prime - COALESCE(paiement, 0);

RAISE NOTICE '✅ Tous les soldes recalculés avec la formule : solde = prime - paiement';

-- Étape 7: Créer des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_liste_credits_paiement ON liste_credits (paiement);
CREATE INDEX IF NOT EXISTS idx_liste_credits_solde ON liste_credits (solde);

RAISE NOTICE '✅ Index créés sur les colonnes paiement et solde';

-- Étape 8: Vérification finale et rapport
DO $$
DECLARE
    total_records INTEGER;
    records_with_zero_paiement INTEGER;
    avg_solde DECIMAL(10,2);
BEGIN
    -- Compter les enregistrements
    SELECT COUNT(*) INTO total_records FROM liste_credits;
    SELECT COUNT(*) INTO records_with_zero_paiement FROM liste_credits WHERE paiement = 0;
    SELECT AVG(solde) INTO avg_solde FROM liste_credits;
    
    RAISE NOTICE '📊 RAPPORT FINAL :';
    RAISE NOTICE '   - Total des enregistrements : %', total_records;
    RAISE NOTICE '   - Enregistrements avec paiement = 0 : %', records_with_zero_paiement;
    RAISE NOTICE '   - Solde moyen : % DT', COALESCE(avg_solde, 0);
    RAISE NOTICE '✅ Migration terminée avec succès !';
    RAISE NOTICE '🔧 Formule appliquée : SOLDE = PRIME - PAIEMENT';
END $$;
