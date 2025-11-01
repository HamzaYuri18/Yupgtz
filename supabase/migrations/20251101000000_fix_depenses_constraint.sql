/*
  # Fix depenses table type_depense constraint

  1. Changes
    - Drop existing constraint on depenses.type_depense
    - Add corrected constraint with proper comma separation including all values:
      - Frais Bureau
      - Frais de Ménage
      - STEG
      - SONED
      - A/S Ahlem
      - A/S Islem
      - Reprise sur Avance Client
      - Versement Bancaire
      - Remise

  2. Security
    - No changes to RLS policies (already configured)
*/

-- Drop the existing constraint
ALTER TABLE depenses DROP CONSTRAINT IF EXISTS depenses_type_depense_check;

-- Add the corrected constraint with proper comma after 'Versement Bancaire'
ALTER TABLE depenses ADD CONSTRAINT depenses_type_depense_check
CHECK (type_depense IN (
  'Frais Bureau',
  'Frais de Ménage',
  'STEG',
  'SONED',
  'A/S Ahlem',
  'A/S Islem',
  'Reprise sur Avance Client',
  'Versement Bancaire',
  'Remise'
));

-- Confirmation message
DO $$
BEGIN
    RAISE NOTICE '✅ Contrainte depenses.type_depense corrigée avec succès';
    RAISE NOTICE '   - 9 types de dépenses autorisés';
END $$;
