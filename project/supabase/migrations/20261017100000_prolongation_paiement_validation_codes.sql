/*
  # Extension de la date de paiement d'une prolongation — validation Hamza

  1. New Table
    - `prolongation_paiement_validation_codes` — mirrors
      credit_reporting_validation_codes : pour étendre la date de paiement
      d'une prolongation déjà payée, un code à 6 chiffres est envoyé à
      Hamza par Telegram et doit être saisi par l'utilisateur demandeur
      pour valider le changement. Valable 10 minutes.

  2. Security
    - Enable RLS, politiques permissives anon/authenticated (l'app
      n'utilise pas l'authentification Supabase).
*/

CREATE TABLE IF NOT EXISTS prolongation_paiement_validation_codes (
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

ALTER TABLE prolongation_paiement_validation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read prolongation_paiement_validation_codes" ON prolongation_paiement_validation_codes;
CREATE POLICY "Allow read prolongation_paiement_validation_codes"
  ON prolongation_paiement_validation_codes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert prolongation_paiement_validation_codes" ON prolongation_paiement_validation_codes;
CREATE POLICY "Allow insert prolongation_paiement_validation_codes"
  ON prolongation_paiement_validation_codes FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update prolongation_paiement_validation_codes" ON prolongation_paiement_validation_codes;
CREATE POLICY "Allow update prolongation_paiement_validation_codes"
  ON prolongation_paiement_validation_codes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_prolongation_paiement_validation_codes_lookup
  ON prolongation_paiement_validation_codes(numero_contrat, requested_by, code);
