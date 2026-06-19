/*
  # Create Avenant_Changement_véhicule table

  1. New Tables
    - `Avenant_Changement_véhicule`
      - `id` (integer, primary key, auto-increment)
      - `numero_contrat` (text, contract number)
      - `assure` (text, insured name)
      - `prime` (numeric, premium amount)
      - `branche` (text, branch)
      - `mode_paiement` (text, payment mode)
      - `cree_par` (text, created by user)
      - `created_at` (timestamptz, creation timestamp)

  2. Security
    - Enable RLS on `Avenant_Changement_véhicule` table
    - Add policy for public access to read and insert data
*/

CREATE TABLE IF NOT EXISTS "Avenant_Changement_véhicule" (
  id SERIAL PRIMARY KEY,
  numero_contrat TEXT NOT NULL,
  assure TEXT NOT NULL,
  prime NUMERIC NOT NULL,
  branche TEXT NOT NULL,
  mode_paiement TEXT NOT NULL,
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE "Avenant_Changement_véhicule" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to Avenant_Changement_véhicule"
  ON "Avenant_Changement_véhicule"
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to Avenant_Changement_véhicule"
  ON "Avenant_Changement_véhicule"
  FOR INSERT
  WITH CHECK (true);