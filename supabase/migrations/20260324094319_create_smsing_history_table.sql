/*
  # Create SMSing History Table

  1. New Tables
    - `smsing`
      - `id` (uuid, primary key) - Identifiant unique
      - `date_envoi` (timestamptz) - Date et heure exacte d'envoi
      - `description` (text) - Description du SMS
      - `destinataire` (text) - Numéro de téléphone du destinataire
      - `client` (text) - Nom du client
      - `numero_contrat` (text) - Numéro de contrat associé
      - `utilisateur` (text) - Nom de l'utilisateur qui a envoyé le SMS
      - `created_at` (timestamptz) - Date de création de l'enregistrement

  2. Security
    - Enable RLS on `smsing` table
    - Add policy for authenticated users to read their SMS history
    - Add policy for authenticated users to insert SMS records
*/

CREATE TABLE IF NOT EXISTS smsing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_envoi timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  destinataire text NOT NULL,
  client text NOT NULL,
  numero_contrat text,
  utilisateur text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE smsing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read SMS history"
  ON smsing
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anonymous users to read SMS history"
  ON smsing
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated users to insert SMS records"
  ON smsing
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to insert SMS records"
  ON smsing
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_smsing_date_envoi ON smsing(date_envoi DESC);
CREATE INDEX IF NOT EXISTS idx_smsing_utilisateur ON smsing(utilisateur);
CREATE INDEX IF NOT EXISTS idx_smsing_numero_contrat ON smsing(numero_contrat);