/*
  # Create Encaissement_autre_code table

  1. New Tables
    - `Encaissement_autre_code`
      - `id` (integer, primary key, auto-increment)
      - `numero_contrat` (text, contract number)
      - `assure` (text, insured name)
      - `prime` (numeric, premium amount)
      - `echeance` (date, maturity date)
      - `mode_paiement` (text, payment mode)
      - `cree_par` (text, created by user)
      - `created_at` (timestamptz, creation timestamp)

  2. Security
    - Enable RLS on `Encaissement_autre_code` table
    - Add policy for public access to read and insert data
*/

CREATE TABLE IF NOT EXISTS Encaissement_autre_code (
  id SERIAL PRIMARY KEY,
  numero_contrat TEXT NOT NULL,
  assure TEXT NOT NULL,
  prime NUMERIC NOT NULL,
  echeance DATE NOT NULL,
  mode_paiement TEXT NOT NULL,
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE Encaissement_autre_code ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to Encaissement_autre_code"
  ON Encaissement_autre_code
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to Encaissement_autre_code"
  ON Encaissement_autre_code
  FOR INSERT
  WITH CHECK (true);