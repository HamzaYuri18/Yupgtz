/*
  # Ajout de la colonne statut_depense dans la table depenses

  1. Modifications
    - Ajoute la colonne statut_depense dans la table depenses
    - Type: TEXT avec contrainte ('Non Payé', 'Payé')
    - Valeur par défaut: NULL
    - Cette colonne permet de suivre si une dépense récupérable a été payée ou non
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'depenses' AND column_name = 'statut_depense'
  ) THEN
    ALTER TABLE depenses 
    ADD COLUMN statut_depense TEXT CHECK (statut_depense IN ('Non Payé', 'Payé') OR statut_depense IS NULL);
  END IF;
END $$;