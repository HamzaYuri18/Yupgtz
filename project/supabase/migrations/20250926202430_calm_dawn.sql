/*
  # Ajouter les colonnes manquantes à la table affaire

  1. Nouvelles colonnes
    - `montant_credit` (decimal, nullable) - Montant du crédit s'il existe
    - `date_paiement` (date, nullable) - Date de paiement prévue pour les crédits

  2. Sécurité
    - Utilisation de IF NOT EXISTS pour éviter les erreurs si les colonnes existent déjà
    - Colonnes nullables pour maintenir la compatibilité avec les données existantes

  3. Index
    - Index sur montant_credit pour optimiser les recherches
*/

-- Ajouter la colonne montant_credit si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affaire' AND column_name = 'montant_credit'
  ) THEN
    ALTER TABLE affaire ADD COLUMN montant_credit DECIMAL(10,2);
    RAISE NOTICE '✅ Colonne montant_credit ajoutée à la table affaire';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne montant_credit existe déjà dans la table affaire';
  END IF;
END $$;

-- Ajouter la colonne date_paiement si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affaire' AND column_name = 'date_paiement'
  ) THEN
    ALTER TABLE affaire ADD COLUMN date_paiement DATE;
    RAISE NOTICE '✅ Colonne date_paiement ajoutée à la table affaire';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne date_paiement existe déjà dans la table affaire';
  END IF;
END $$;

-- Créer un index sur montant_credit pour optimiser les recherches
CREATE INDEX IF NOT EXISTS affaire_montant_credit_idx ON affaire (montant_credit);

-- Message de confirmation final
DO $$
BEGIN
    RAISE NOTICE '✅ Migration terminée avec succès';
    RAISE NOTICE '   - Colonnes montant_credit et date_paiement ajoutées à la table affaire';
    RAISE NOTICE '   - Index créé sur montant_credit pour optimiser les performances';
    RAISE NOTICE '   - Compatibilité maintenue avec les données existantes';
END $$;
