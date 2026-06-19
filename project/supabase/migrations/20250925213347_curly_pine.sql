/*
  # Update rapport table mode_paiement constraint

  1. Modifications
    - Drop existing CHECK constraint on mode_paiement column
    - Add new CHECK constraint with expanded allowed values
    - Include financial transaction payment modes: Système, Ristourne, Sinistre

  2. Allowed values
    - Espece, Cheque, Carte Bancaire (existing)
    - Système, Ristourne, Sinistre (new for financial transactions)
*/

-- Drop the existing CHECK constraint on the mode_paiement column
ALTER TABLE rapport DROP CONSTRAINT IF EXISTS rapport_mode_paiement_check;

-- Add a new CHECK constraint with the expanded list of allowed values
ALTER TABLE rapport ADD CONSTRAINT rapport_mode_paiement_check
CHECK (mode_paiement IN ('Espece', 'Cheque', 'Carte Bancaire', 'Système', 'Ristourne', 'Sinistre'));

-- Confirmation message
DO $$
BEGIN
    RAISE NOTICE '✅ Constraint rapport_mode_paiement_check updated successfully';
    RAISE NOTICE '   - Allowed values now include: Espece, Cheque, Carte Bancaire, Système, Ristourne, Sinistre';
END $$;
