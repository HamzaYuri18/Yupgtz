/*
  # Add type_paiement column to depenses table

  1. Changes
    - Add `type_paiement` column to `depenses` table with constraint for 'Espece' or 'Cheque'
    - This column stores the payment method for expenses, particularly important for 'Remise' type expenses
    - Default value is 'Espece' for backward compatibility with existing records

  2. Important Notes
    - This migration is safe and non-destructive
    - Existing records will default to 'Espece' (cash payment)
    - The constraint ensures only valid payment types are stored
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'depenses' AND column_name = 'type_paiement'
  ) THEN
    ALTER TABLE depenses
    ADD COLUMN type_paiement text DEFAULT 'Espece'
    CHECK (type_paiement IN ('Espece', 'Cheque'));
  END IF;
END $$;
