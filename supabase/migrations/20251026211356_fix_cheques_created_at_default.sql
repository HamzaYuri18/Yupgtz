/*
  # Correction de la colonne created_at de la table Cheques

  1. Modifications
    - Ajouter une valeur par défaut NOW() à la colonne created_at
    - Assurer que les insertions futures auront automatiquement la date

  2. Notes
    - Cette migration corrige le problème de contrainte NOT NULL sur created_at
*/

-- Ajouter la valeur par défaut à la colonne created_at
ALTER TABLE "Cheques" 
ALTER COLUMN created_at SET DEFAULT NOW();
