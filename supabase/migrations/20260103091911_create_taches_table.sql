/*
  # Create taches table

  1. New Tables
    - `taches`
      - `id` (uuid, primary key)
      - `titre` (text) - Titre de la tâche
      - `description` (text) - Description de la tâche
      - `date_effectuer` (date) - Date à effectuer la tâche
      - `degre_importance` (text) - Degré d'importance: 'Urgent', 'Haute', 'Moyenne', 'Basse'
      - `utilisateur_charge` (text) - Utilisateur chargé: 'Ahlem' ou 'Islem'
      - `statut` (text) - Statut: 'A faire', 'Accomplie'
      - `remarques` (text) - Remarques ajoutées par l'utilisateur chargé
      - `session_id` (uuid) - ID de la session en cours
      - `created_by` (text) - Utilisateur qui a créé la tâche (Hamza)
      - `created_at` (timestamptz) - Date de création
      - `updated_at` (timestamptz) - Date de dernière modification

  2. Security
    - Enable RLS on `taches` table
    - Add policies for authenticated users to read taches
    - Add policies for Hamza to create and update taches
    - Add policies for Ahlem and Islem to update statut and remarques only
*/

CREATE TABLE IF NOT EXISTS taches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL,
  description text,
  date_effectuer date NOT NULL,
  degre_importance text NOT NULL CHECK (degre_importance IN ('Urgent', 'Haute', 'Moyenne', 'Basse')),
  utilisateur_charge text NOT NULL CHECK (utilisateur_charge IN ('Ahlem', 'Islem')),
  statut text NOT NULL DEFAULT 'A faire' CHECK (statut IN ('A faire', 'Accomplie')),
  remarques text DEFAULT '',
  session_id uuid,
  created_by text NOT NULL DEFAULT 'Hamza',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE taches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view taches"
  ON taches FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Hamza can insert taches"
  ON taches FOR INSERT
  TO public
  WITH CHECK (created_by = 'Hamza');

CREATE POLICY "Hamza can update all taches"
  ON taches FOR UPDATE
  TO public
  USING (created_by = 'Hamza')
  WITH CHECK (created_by = 'Hamza');

CREATE POLICY "Ahlem can update her taches status and remarks"
  ON taches FOR UPDATE
  TO public
  USING (utilisateur_charge = 'Ahlem')
  WITH CHECK (utilisateur_charge = 'Ahlem');

CREATE POLICY "Islem can update her taches status and remarks"
  ON taches FOR UPDATE
  TO public
  USING (utilisateur_charge = 'Islem')
  WITH CHECK (utilisateur_charge = 'Islem');

CREATE INDEX IF NOT EXISTS idx_taches_utilisateur_charge ON taches(utilisateur_charge);
CREATE INDEX IF NOT EXISTS idx_taches_statut ON taches(statut);
CREATE INDEX IF NOT EXISTS idx_taches_date_effectuer ON taches(date_effectuer);
CREATE INDEX IF NOT EXISTS idx_taches_session_id ON taches(session_id);