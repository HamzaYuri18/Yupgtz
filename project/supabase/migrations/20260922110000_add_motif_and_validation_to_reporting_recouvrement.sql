/*
  # Structured motif + new payment date for reporting_recouvrement

  1. Changes
    - Add `motif` (text), `ancienne_date_paiement` (date) and
      `nouvelle_date_paiement` (date) to `reporting_recouvrement`: the
      free-text reporting is replaced by a fixed list the user picks
      from (report suite demande client / client injoignable / payé
      partiellement), each producing a new payment date.

  2. New Table
    - `credit_reporting_validation_codes` — mirrors
      prolongation_validation_codes: when the new payment date (report
      suite demande client) exceeds 7 days from the original one, a
      6-digit code is sent to Hamza by Telegram and must be entered to
      approve it.

  3. Security
    - Enable RLS, permissive policies for anon/authenticated (l'app
      n'utilise pas l'authentification Supabase).
*/

ALTER TABLE reporting_recouvrement ADD COLUMN IF NOT EXISTS motif text;
ALTER TABLE reporting_recouvrement ADD COLUMN IF NOT EXISTS ancienne_date_paiement date;
ALTER TABLE reporting_recouvrement ADD COLUMN IF NOT EXISTS nouvelle_date_paiement date;

CREATE TABLE IF NOT EXISTS credit_reporting_validation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrat text NOT NULL,
  code text NOT NULL,
  requested_by text NOT NULL,
  ancienne_date_paiement date,
  nouvelle_date_paiement date,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz NOT NULL
);

ALTER TABLE credit_reporting_validation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read credit_reporting_validation_codes"
  ON credit_reporting_validation_codes FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow insert credit_reporting_validation_codes"
  ON credit_reporting_validation_codes FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow update credit_reporting_validation_codes"
  ON credit_reporting_validation_codes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_credit_reporting_validation_codes_lookup
  ON credit_reporting_validation_codes(numero_contrat, requested_by, code);
