/*
  # Ajouter colonne telephone à la table affaire

  1. Modifications
    - Ajouter la colonne `telephone` à la table `affaire`
      - Type: TEXT
      - Obligatoire pour tous les nouveaux contrats Affaire
      - Par défaut: chaîne vide pour les enregistrements existants

  2. Notes importantes
    - Cette colonne est nécessaire pour enregistrer le numéro de téléphone du client
    - Pour les contrats affaire, le téléphone devient un champ obligatoire
*/

-- Ajouter la colonne telephone à la table affaire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affaire' AND column_name = 'telephone'
  ) THEN
    ALTER TABLE affaire ADD COLUMN telephone TEXT NOT NULL DEFAULT '';
  END IF;
END $$;