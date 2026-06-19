/*
  # Add paiement column to liste_credits table

  1. New Columns
    - `paiement` (decimal, default 0) - Amount paid by the client
  
  2. Schema Updates
    - Add paiement column to liste_credits table
    - Update solde calculation: solde = prime - paiement
    - Create trigger to automatically calculate solde
    - Add index on paiement column for performance
  
  3. Data Migration
    - Set default paiement = 0 for existing records
    - Recalculate all solde values with new formula
*/

-- Add paiement column to liste_credits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'liste_credits' AND column_name = 'paiement'
  ) THEN
    ALTER TABLE liste_credits ADD COLUMN paiement DECIMAL(10,2) DEFAULT 0;
    RAISE NOTICE 'Column paiement added to liste_credits table';
  ELSE
    RAISE NOTICE 'Column paiement already exists in liste_credits table';
  END IF;
END $$;

-- Set default value for existing records
UPDATE liste_credits 
SET paiement = 0 
WHERE paiement IS NULL;

-- Create or replace function to calculate solde
CREATE OR REPLACE FUNCTION calculate_solde()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate solde as the difference between prime and paiement
    NEW.solde := NEW.prime - COALESCE(NEW.paiement, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_calculate_solde ON liste_credits;

-- Create trigger to automatically calculate solde on insert/update
CREATE TRIGGER trigger_calculate_solde
    BEFORE INSERT OR UPDATE ON liste_credits
    FOR EACH ROW
    EXECUTE FUNCTION calculate_solde();

-- Recalculate solde for all existing records
UPDATE liste_credits 
SET solde = prime - COALESCE(paiement, 0);

-- Create index on paiement column for better performance
CREATE INDEX IF NOT EXISTS idx_liste_credits_paiement ON liste_credits (paiement);

-- Verify the changes
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'liste_credits' AND column_name = 'paiement'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '✅ Migration completed successfully:';
        RAISE NOTICE '   - Column paiement added to liste_credits';
        RAISE NOTICE '   - Solde calculation updated: solde = prime - paiement';
        RAISE NOTICE '   - Trigger created for automatic solde calculation';
        RAISE NOTICE '   - Index created on paiement column';
    ELSE
        RAISE EXCEPTION '❌ Migration failed: paiement column not found';
    END IF;
END $$;
