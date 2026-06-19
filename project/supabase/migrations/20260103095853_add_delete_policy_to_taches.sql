/*
  # Add DELETE policy to taches table

  1. Changes
    - Add DELETE policy for Hamza to delete taches
    
  2. Security
    - Only Hamza (the creator) can delete taches
*/

CREATE POLICY "Hamza can delete taches"
  ON taches FOR DELETE
  TO public
  USING (created_by = 'Hamza');
