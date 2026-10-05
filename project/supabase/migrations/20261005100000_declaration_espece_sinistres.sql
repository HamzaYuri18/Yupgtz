/*
  # Déclaration signée pour les sinistres payés en espèce

  1. Changes
    - sinistres: declaration_validee (bool), declaration_scan_url (text).
    - sinistre_declaration_codes: codes à 6 chiffres envoyés à Hamza par
      Telegram pour valider le scan de la déclaration signée. Valables
      20 minutes et uniquement pour l'utilisateur qui a demandé la validation
      (requested_by).

  2. Security
    - Politiques permissives anon/authenticated (l'app n'utilise pas
      l'authentification Supabase), comme le reste du projet.
*/

ALTER TABLE sinistres ADD COLUMN IF NOT EXISTS declaration_validee boolean NOT NULL DEFAULT false;
ALTER TABLE sinistres ADD COLUMN IF NOT EXISTS declaration_scan_url text;

CREATE POLICY "Allow update sinistres declaration"
  ON sinistres FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS sinistre_declaration_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_sinistre text NOT NULL,
  code text NOT NULL,
  requested_by text NOT NULL,
  scan_url text,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz NOT NULL
);

ALTER TABLE sinistre_declaration_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read sinistre_declaration_codes"
  ON sinistre_declaration_codes FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow insert sinistre_declaration_codes"
  ON sinistre_declaration_codes FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow update sinistre_declaration_codes"
  ON sinistre_declaration_codes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sinistre_declaration_codes_lookup
  ON sinistre_declaration_codes(numero_sinistre, requested_by, code);
