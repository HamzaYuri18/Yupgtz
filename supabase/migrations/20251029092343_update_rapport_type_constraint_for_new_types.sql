/*
  # Update rapport table type constraint

  1. Changes
    - Drop existing rapport_type_check constraint
    - Add new constraint with additional types:
      - 'Avenant' (for Avenant changement de véhicule)
      - 'Encaissement pour autre code'
    
  2. Security
    - No changes to RLS policies
    - Maintains data integrity with updated constraint
*/

-- Drop the existing constraint
ALTER TABLE rapport DROP CONSTRAINT IF EXISTS rapport_type_check;

-- Add the new constraint with additional types
ALTER TABLE rapport ADD CONSTRAINT rapport_type_check 
CHECK (type = ANY (ARRAY[
  'Terme'::text, 
  'Affaire'::text, 
  'Crédit'::text, 
  'Dépense'::text, 
  'Recette Exceptionnelle'::text, 
  'Ristourne'::text, 
  'Sinistre'::text, 
  'Paiement Crédit'::text,
  'Avenant'::text,
  'Encaissement pour autre code'::text
]));