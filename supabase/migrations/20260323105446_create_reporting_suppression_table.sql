/*
  # Create reporting_suppression table

  ## Purpose
  This migration creates a table to track all deleted operations from the rapport table.
  
  ## New Tables
  - `reporting_suppression`
    - `id` (uuid, primary key) - unique identifier
    - `rapport_id` (integer) - original ID from rapport table
    - `type` (text) - type of operation (Terme, Affaire, Dépense, etc.)
    - `branche` (text) - insurance branch
    - `numero_contrat` (text) - contract number
    - `prime` (numeric) - premium amount
    - `assure` (text) - insured person name
    - `mode_paiement` (text) - payment mode
    - `type_paiement` (text) - payment type
    - `montant_credit` (numeric) - credit amount
    - `montant` (numeric) - total amount
    - `echeance` (text) - maturity date (for Terme)
    - `date_paiement_prevue` (text) - planned payment date
    - `cree_par` (text) - who created the original operation
    - `created_at_original` (timestamptz) - original creation timestamp
    - `motif_suppression` (text) - reason for deletion (required)
    - `supprime_par` (text) - who deleted the operation
    - `supprime_le` (timestamptz) - when it was deleted
    - `numero_attestation` (text) - attestation number if applicable
    - `session_date` (text) - session date when deletion occurred

  ## Security
  - Enable RLS
  - Authenticated users can insert (to record deletions)
  - Authenticated users can read all suppression records
*/

CREATE TABLE IF NOT EXISTS reporting_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapport_id integer,
  type text NOT NULL,
  branche text,
  numero_contrat text,
  prime numeric DEFAULT 0,
  assure text,
  mode_paiement text,
  type_paiement text,
  montant_credit numeric,
  montant numeric DEFAULT 0,
  echeance text,
  date_paiement_prevue text,
  cree_par text,
  created_at_original timestamptz,
  motif_suppression text NOT NULL,
  supprime_par text NOT NULL,
  supprime_le timestamptz DEFAULT now(),
  numero_attestation text,
  session_date text
);

ALTER TABLE reporting_suppression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert suppression records"
  ON reporting_suppression FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read suppression records"
  ON reporting_suppression FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_reporting_suppression_supprime_le ON reporting_suppression(supprime_le DESC);
CREATE INDEX IF NOT EXISTS idx_reporting_suppression_type ON reporting_suppression(type);
CREATE INDEX IF NOT EXISTS idx_reporting_suppression_supprime_par ON reporting_suppression(supprime_par);
CREATE INDEX IF NOT EXISTS idx_reporting_suppression_session_date ON reporting_suppression(session_date);
