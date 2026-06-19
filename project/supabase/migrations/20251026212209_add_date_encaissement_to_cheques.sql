/*
  # Ajout de la colonne date_encaissement à la table Cheques

  1. Modifications
    - Ajouter la colonne `date_encaissement` (date, nullable)
    - Cette colonne sera remplie lorsque le chèque est encaissé

  2. Notes
    - NULL = chèque non encaissé
    - Date remplie = chèque encaissé à cette date
*/

-- Ajouter la colonne date_encaissement si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Cheques' AND column_name = 'date_encaissement'
  ) THEN
    ALTER TABLE "Cheques" ADD COLUMN date_encaissement DATE;
  END IF;
END $$;
