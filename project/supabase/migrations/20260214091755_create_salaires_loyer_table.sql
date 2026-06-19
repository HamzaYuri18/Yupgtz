/*
  # Créer la table salaires_loyer
  
  1. Nouvelle Table
    - `salaires_loyer`
      - `id` (uuid, primary key) - Identifiant unique
      - `mois` (text, unique) - Mois au format YYYY-MM (ex: 2025-06)
      - `statut` (boolean, default false) - true = liquidé, false = non liquidé
      - `mode_liquidation` (text, nullable) - Mode: "Compensation sur commission", "Virement", "Cheque"
      - `date_liquidation` (date, nullable) - Date de liquidation
      - `created_at` (timestamptz) - Date de création
      - `updated_at` (timestamptz) - Date de dernière modification
  
  2. Sécurité
    - Activer RLS sur la table `salaires_loyer`
    - Politique SELECT pour tous les utilisateurs authentifiés
    - Politique INSERT pour tous les utilisateurs authentifiés
    - Politique UPDATE pour tous les utilisateurs authentifiés
    - Politique DELETE pour tous les utilisateurs authentifiés
  
  3. Notes Importantes
    - Le mois est unique pour éviter les doublons
    - Le mode_liquidation et date_liquidation sont null si statut = false
    - Format du mois: YYYY-MM (ex: 2025-06 pour juin 2025)
*/

-- Créer la table salaires_loyer
CREATE TABLE IF NOT EXISTS salaires_loyer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mois text UNIQUE NOT NULL,
  statut boolean DEFAULT false NOT NULL,
  mode_liquidation text,
  date_liquidation date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Contrainte: mode_liquidation doit être l'une des valeurs autorisées
  CONSTRAINT valid_mode_liquidation CHECK (
    mode_liquidation IS NULL OR 
    mode_liquidation IN ('Compensation sur commission', 'Virement', 'Cheque')
  ),
  
  -- Contrainte: si statut est false, mode_liquidation et date_liquidation doivent être null
  CONSTRAINT statut_coherence CHECK (
    (statut = false AND mode_liquidation IS NULL AND date_liquidation IS NULL) OR
    (statut = true)
  )
);

-- Créer un index sur le mois pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_salaires_loyer_mois ON salaires_loyer(mois DESC);

-- Activer RLS
ALTER TABLE salaires_loyer ENABLE ROW LEVEL SECURITY;

-- Politique SELECT: tous les utilisateurs authentifiés peuvent lire
CREATE POLICY "Authenticated users can view salaires_loyer"
  ON salaires_loyer
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique INSERT: tous les utilisateurs authentifiés peuvent insérer
CREATE POLICY "Authenticated users can insert salaires_loyer"
  ON salaires_loyer
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique UPDATE: tous les utilisateurs authentifiés peuvent modifier
CREATE POLICY "Authenticated users can update salaires_loyer"
  ON salaires_loyer
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique DELETE: tous les utilisateurs authentifiés peuvent supprimer
CREATE POLICY "Authenticated users can delete salaires_loyer"
  ON salaires_loyer
  FOR DELETE
  TO authenticated
  USING (true);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_salaires_loyer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS update_salaires_loyer_updated_at_trigger ON salaires_loyer;
CREATE TRIGGER update_salaires_loyer_updated_at_trigger
  BEFORE UPDATE ON salaires_loyer
  FOR EACH ROW
  EXECUTE FUNCTION update_salaires_loyer_updated_at();