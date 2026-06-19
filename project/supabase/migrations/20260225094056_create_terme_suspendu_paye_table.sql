/*
  # Créer la table terme_suspendu_paye
  
  1. Nouvelle Table
    - `terme_suspendu_paye`
      - `id` (uuid, primary key) - Identifiant unique
      - `session_date` (date, not null) - Date de la session où le terme a été enregistré
      - `num_police` (text, not null) - Numéro de police
      - `code_ste` (text, not null) - Code société
      - `num_av` (text, not null) - Numéro avenant
      - `souscripteur` (text, not null) - Nom du souscripteur
      - `date_echeance` (date, not null) - Date d'échéance du contrat
      - `jours_depasses` (integer, not null) - Nombre de jours dépassés (par rapport aux 45 jours)
      - `prime_totale` (decimal(10,2), not null) - Prime totale du contrat
      - `created_at` (timestamptz, default now()) - Date de création
      - `updated_at` (timestamptz, default now()) - Date de mise à jour
  
  2. Sécurité
    - Activer RLS sur la table `terme_suspendu_paye`
    - Ajouter une politique permettant aux utilisateurs anonymes de lire, insérer, mettre à jour et supprimer
  
  3. Notes Importantes
    - Cette table enregistre les termes qui ont dépassé le délai de garde de 45 jours
    - Elle sert de registre d'attention pour les contrats qui doivent être remis en vigueur
    - Les utilisateurs anonymes ont accès complet pour l'enregistrement des alertes
*/

CREATE TABLE IF NOT EXISTS terme_suspendu_paye (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL,
  num_police text NOT NULL,
  code_ste text NOT NULL,
  num_av text NOT NULL,
  souscripteur text NOT NULL,
  date_echeance date NOT NULL,
  jours_depasses integer NOT NULL,
  prime_totale decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE terme_suspendu_paye ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous users to select terme_suspendu_paye"
  ON terme_suspendu_paye
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous users to insert terme_suspendu_paye"
  ON terme_suspendu_paye
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to update terme_suspendu_paye"
  ON terme_suspendu_paye
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to delete terme_suspendu_paye"
  ON terme_suspendu_paye
  FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_terme_suspendu_paye_session_date ON terme_suspendu_paye(session_date);
CREATE INDEX IF NOT EXISTS idx_terme_suspendu_paye_num_police ON terme_suspendu_paye(num_police);