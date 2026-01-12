/*
  # Fix Etat Commission RLS Policies

  1. Security Changes
    - Drop existing restrictive RLS policies that require authentication
    - Create new permissive policies for both authenticated and anon users
    - Allow insert, update, and delete operations for all users
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view etat_commission" ON etat_commission;
DROP POLICY IF EXISTS "Authenticated users can insert etat_commission" ON etat_commission;
DROP POLICY IF EXISTS "Authenticated users can update etat_commission" ON etat_commission;
DROP POLICY IF EXISTS "Authenticated users can delete etat_commission" ON etat_commission;

-- Create permissive policies for all users
CREATE POLICY "Allow all users to view etat_commission"
  ON etat_commission FOR SELECT
  USING (true);

CREATE POLICY "Allow all users to insert etat_commission"
  ON etat_commission FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all users to update etat_commission"
  ON etat_commission FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all users to delete etat_commission"
  ON etat_commission FOR DELETE
  USING (true);
