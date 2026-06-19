/*
  # Add Rouae to taches utilisateur_charge constraint

  ## Change
  - Updates the CHECK constraint on `taches.utilisateur_charge` to include 'Rouae'
  - Previous constraint only allowed 'Ahlem' and 'Islem'
  - New constraint allows 'Ahlem', 'Islem', and 'Rouae'
*/

ALTER TABLE taches DROP CONSTRAINT IF EXISTS taches_utilisateur_charge_check;

ALTER TABLE taches ADD CONSTRAINT taches_utilisateur_charge_check
  CHECK (utilisateur_charge = ANY (ARRAY['Ahlem'::text, 'Islem'::text, 'Rouae'::text]));
