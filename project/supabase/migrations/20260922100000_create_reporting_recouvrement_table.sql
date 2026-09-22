/*
  # Create reporting_recouvrement table

  1. New Table
    - `reporting_recouvrement`
      - `id` (uuid, primary key)
      - `numero_contrat` (text) - Contrat concerné
      - `assure` (text) - Nom de l'assuré
      - `montant_credit` (numeric) - Montant du crédit
      - `solde` (numeric) - Solde restant au moment du reporting
      - `statut` (text) - Statut du crédit au moment du reporting
      - `reporting` (text) - Détail de l'opération de recouvrement effectuée
      - `utilisateur` (text) - Utilisateur ayant saisi le reporting
      - `session_date` (date) - Date de la session concernée
      - `created_at` (timestamptz)

  2. Purpose
    - Avant de pouvoir demander la clé de clôture de la caisse, si des
      crédits à payer le jour même ne sont pas encore payés en
      totalité, l'utilisateur doit saisir un reporting de recouvrement
      pour chacun — enregistré ici.

  3. Security
    - Enable RLS, permissive policies for anon/authenticated (l'app
      n'utilise pas l'authentification Supabase).
*/

CREATE TABLE IF NOT EXISTS reporting_recouvrement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrat text,
  assure text,
  montant_credit numeric,
  solde numeric,
  statut text,
  reporting text NOT NULL,
  utilisateur text NOT NULL,
  session_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reporting_recouvrement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read reporting_recouvrement"
  ON reporting_recouvrement
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert reporting_recouvrement"
  ON reporting_recouvrement
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_reporting_recouvrement_session_date ON reporting_recouvrement(session_date);
CREATE INDEX IF NOT EXISTS idx_reporting_recouvrement_numero_contrat ON reporting_recouvrement(numero_contrat);
