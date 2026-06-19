/*
  # Update rapport table type constraint to include financial types

  1. Modifications
    - Drop existing CHECK constraint on type column
    - Add new CHECK constraint with expanded allowed values
    - Include financial transaction types: Dépense, Recette Exceptionnelle, Ristourne, Sinistre

  2. Allowed values
    - Terme, Affaire (existing contract types)
    - Dépense, Recette Exceptionnelle, Ristourne, Sinistre (new financial types)
*/

-- Drop the existing CHECK constraint on the type column
ALTER TABLE rapport DROP CONSTRAINT IF EXISTS rapport_type_check;

-- Add a new CHECK constraint with the expanded list of allowed values
ALTER TABLE rapport ADD CONSTRAINT rapport_type_check
CHECK (type IN ('Terme', 'Affaire', 'Dépense', 'Recette Exceptionnelle', 'Ristourne', 'Sinistre'));

-- Confirmation message
DO $$
BEGIN
    RAISE NOTICE '✅ Constraint rapport_type_check updated successfully';
    RAISE NOTICE '   - Allowed values: Terme, Affaire, Dépense, Recette Exceptionnelle, Ristourne, Sinistre';
END $$;
