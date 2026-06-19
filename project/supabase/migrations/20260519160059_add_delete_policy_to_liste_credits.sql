/*
  # Add DELETE policy to liste_credits table

  1. Problem
    - The liste_credits table has no DELETE RLS policy
    - Delete operations silently fail (Supabase returns no error but nothing is deleted)
    - This prevents Hamza from deleting credits even though the UI allows it

  2. Fix
    - Add a DELETE policy that allows all users to delete records
    - This matches the existing pattern of the SELECT and UPDATE policies on this table
*/

CREATE POLICY "Allow delete access"
  ON liste_credits
  FOR DELETE
  USING (true);
