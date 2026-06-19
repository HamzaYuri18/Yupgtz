/*
  # Ajout du type "Recuperation Depense" dans la table recettes_exceptionnelles

  1. Modifications
    - Ajoute "Recuperation Depense" dans la contrainte de type_recette de la table recettes_exceptionnelles
    - Permet l'utilisation de ce nouveau type de recette avec les colonnes id_depense et libelle existantes
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'recettes_exceptionnelles' AND constraint_name LIKE '%type_recette%'
  ) THEN
    ALTER TABLE recettes_exceptionnelles DROP CONSTRAINT IF EXISTS recettes_exceptionnelles_type_recette_check;
  END IF;
END $$;

ALTER TABLE recettes_exceptionnelles 
ADD CONSTRAINT recettes_exceptionnelles_type_recette_check 
CHECK (type_recette = ANY (ARRAY[
  'Hamza'::text, 
  'Récupération A/S Ahlem'::text, 
  'Récupération A/S Islem'::text, 
  'Avance Client'::text,
  'Recuperation Depense'::text
]));