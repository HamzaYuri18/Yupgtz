/*
  # Ajout du type "Depense Recuperable" dans la table depenses

  1. Modifications
    - Ajoute "Depense Recuperable" dans la contrainte de type_depense de la table depenses
    - Permet l'utilisation de ce nouveau type de dépense avec les colonnes libelle et date_recuperation_prevue existantes
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'depenses' AND constraint_name LIKE '%type_depense%'
  ) THEN
    ALTER TABLE depenses DROP CONSTRAINT IF EXISTS depenses_type_depense_check;
  END IF;
END $$;

ALTER TABLE depenses 
ADD CONSTRAINT depenses_type_depense_check 
CHECK (type_depense = ANY (ARRAY[
  'Frais Bureau'::text, 
  'Frais de Ménage'::text, 
  'STEG'::text, 
  'SONED'::text, 
  'A/S Ahlem'::text, 
  'A/S Islem'::text, 
  'Reprise sur Avance Client'::text, 
  'Versement Bancaire'::text, 
  'Remise'::text, 
  'Hamza'::text,
  'Depense Recuperable'::text
]));