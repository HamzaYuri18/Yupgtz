/*
  # Create Etat Commission Table
  
  1. New Tables
    - `etat_commission`
      - `id` (uuid, primary key)
      - `annee` (integer) - Year
      - `mois` (integer) - Month (1-12)
      - `quinzaine` (integer) - Fortnight (1 or 2)
      - `date_debut` (date) - Start date of fortnight
      - `date_fin` (date) - End date of fortnight
      - `commission` (numeric) - Commission amount
      - `total_charges` (numeric) - Total charges from sessions table
      - `total_depenses` (numeric) - Total expenses from depenses table
      - `commission_nette` (numeric) - Net commission (commission - charges - depenses)
      - `statut` (text) - Status: 'Non Liquidée' or 'Liquidée'
      - `date_liquidation` (date) - Settlement date (nullable)
      - `banque` (text) - Bank name (nullable)
      - `mode_liquidation` (text) - Settlement mode: 'Chèque' or 'Virement' (nullable)
      - `remarques` (text) - Notes/remarks (nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS on `etat_commission` table
    - Add policies for authenticated users to manage commission data
*/

CREATE TABLE IF NOT EXISTS etat_commission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annee integer NOT NULL,
  mois integer NOT NULL CHECK (mois >= 1 AND mois <= 12),
  quinzaine integer NOT NULL CHECK (quinzaine IN (1, 2)),
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  commission numeric(10,3) DEFAULT 0,
  total_charges numeric(10,3) DEFAULT 0,
  total_depenses numeric(10,3) DEFAULT 0,
  commission_nette numeric(10,3) DEFAULT 0,
  statut text DEFAULT 'Non Liquidée' CHECK (statut IN ('Non Liquidée', 'Liquidée')),
  date_liquidation date,
  banque text,
  mode_liquidation text CHECK (mode_liquidation IN ('Chèque', 'Virement') OR mode_liquidation IS NULL),
  remarques text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(annee, mois, quinzaine)
);

ALTER TABLE etat_commission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view etat_commission"
  ON etat_commission FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert etat_commission"
  ON etat_commission FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update etat_commission"
  ON etat_commission FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete etat_commission"
  ON etat_commission FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_etat_commission_date ON etat_commission(annee, mois, quinzaine);
CREATE INDEX IF NOT EXISTS idx_etat_commission_periode ON etat_commission(date_debut, date_fin);
