/*
  # Create Prolongation Validation Codes Table + Storage Bucket

  1. New Tables
    - `prolongation_validation_codes`
      - `id` (uuid, primary key)
      - `numero_contrat` (text) - Contrat concerné par la demande de téléchargement
      - `code` (text) - Code à 6 chiffres envoyé à Mr Hamza par Telegram
      - `requested_by` (text) - Utilisateur demandeur (Ahlem, Rouae, ...) - Hamza n'en a pas besoin
      - `pdf_url` (text) - Lien public du PDF généré, envoyé à Hamza pour consultation
      - `used` (boolean) - Le code a-t-il déjà servi à débloquer un téléchargement
      - `created_at` (timestamptz)
      - `used_at` (timestamptz, nullable)
      - `expires_at` (timestamptz) - Le code n'est valable qu'un temps limité (30 min)

  2. Security
    - Enable RLS
    - Politiques permissives pour `anon`/`authenticated` : l'application gère ses
      propres comptes utilisateurs (voir src/utils/auth.ts), pas Supabase Auth.

  3. Storage
    - Bucket public `prolongations` pour héberger les PDF envoyés à Hamza pour
      validation avant téléchargement.
*/

CREATE TABLE IF NOT EXISTS prolongation_validation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrat text NOT NULL,
  code text NOT NULL,
  requested_by text NOT NULL,
  pdf_url text,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz NOT NULL
);

ALTER TABLE prolongation_validation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read validation codes"
  ON prolongation_validation_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow anonymous users to read validation codes"
  ON prolongation_validation_codes FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated users to insert validation codes"
  ON prolongation_validation_codes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow anonymous users to insert validation codes"
  ON prolongation_validation_codes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update validation codes"
  ON prolongation_validation_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous users to update validation codes"
  ON prolongation_validation_codes FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_prolongation_validation_codes_lookup
  ON prolongation_validation_codes(numero_contrat, requested_by, code);

-- Bucket de stockage pour les PDF envoyés à Hamza pour validation.
INSERT INTO storage.buckets (id, name, public)
VALUES ('prolongations', 'prolongations', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access to prolongation pdfs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'prolongations');

CREATE POLICY "Anon upload prolongation pdfs"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'prolongations');

CREATE POLICY "Authenticated upload prolongation pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prolongations');
