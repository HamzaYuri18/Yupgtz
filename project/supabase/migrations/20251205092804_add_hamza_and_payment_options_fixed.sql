/*
  # Add Hamza to depenses and payment options for sinistres/ristournes

  1. Modifications to depenses table
    - Add "Hamza" to type_depense constraint
  
  2. Modifications to sinistres table
    - Add column `type_paiement` (TEXT) with options: Espece, Cheque, Banque
    - Add column `date_paiement_sinistre` (DATE) for payment date
  
  3. Modifications to ristournes table
    - Update type_paiement constraint to include Espece, Cheque, Banque
*/

-- 1. Update depenses constraint to include Hamza
ALTER TABLE depenses DROP CONSTRAINT IF EXISTS depenses_type_depense_check;
ALTER TABLE depenses ADD CONSTRAINT depenses_type_depense_check 
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
    'Hamza'::text
  ]));

-- 2. Add payment columns to sinistres table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sinistres' AND column_name = 'type_paiement'
  ) THEN
    ALTER TABLE sinistres 
    ADD COLUMN type_paiement TEXT DEFAULT 'Espece';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sinistres' AND column_name = 'date_paiement_sinistre'
  ) THEN
    ALTER TABLE sinistres 
    ADD COLUMN date_paiement_sinistre DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Add constraint for sinistres type_paiement
ALTER TABLE sinistres DROP CONSTRAINT IF EXISTS sinistres_type_paiement_check;
ALTER TABLE sinistres ADD CONSTRAINT sinistres_type_paiement_check 
  CHECK (type_paiement = ANY (ARRAY['Espece'::text, 'Cheque'::text, 'Banque'::text]));

-- 3. Update ristournes type_paiement constraint (use Espece without accent)
ALTER TABLE ristournes DROP CONSTRAINT IF EXISTS ristournes_type_paiement_check;
ALTER TABLE ristournes ADD CONSTRAINT ristournes_type_paiement_check 
  CHECK (type_paiement = ANY (ARRAY['Espece'::text, 'Cheque'::text, 'Banque'::text]));

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Modifications appliquées:';
    RAISE NOTICE '   - Hamza ajouté aux types de dépenses';
    RAISE NOTICE '   - Colonnes type_paiement et date_paiement_sinistre ajoutées à sinistres';
    RAISE NOTICE '   - Contraintes de paiement mises à jour pour sinistres et ristournes';
END $$;
