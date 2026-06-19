/*
  # Create attestations table and carnet management system

  1. New Tables
    - `attestations`
      - `id` (bigserial, primary key)
      - `numero` (integer, unique, required) - Numéro d'attestation
      - `carnet_id` (integer, required) - ID du carnet (1 à N)
      - `position_dans_carnet` (integer, required) - Position 1 à 50
      - `statut` (text, default 'en_stock') - en_stock, servie, annulee
      - `date_servie` (timestamptz) - Date où l'attestation a été servie
      - `motif_annulation` (text) - PRG, TRUMAN, ou Annulé
      - `scan_barrée` (text) - URL ou chemin du scan si annulée
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
    
    - `attestations_annulees`
      - `id` (bigserial, primary key)
      - `numero_attestation` (integer, required)
      - `motif` (text, required) - PRG, TRUMAN, ou Annulé
      - `scan_barree` (text) - URL du scan si motif = Annulé
      - `created_at` (timestamptz, default now())
      - `user_created` (text, required)

  2. Security
    - Enable RLS on both tables
    - Allow authenticated and anonymous users full access for operations
    
  3. Functions
    - Function to get carnet statistics
    - Function to mark attestation as servie
    - Function to get next available attestation number
*/

-- Create attestations table
CREATE TABLE IF NOT EXISTS attestations (
  id BIGSERIAL PRIMARY KEY,
  numero INTEGER UNIQUE NOT NULL,
  carnet_id INTEGER NOT NULL,
  position_dans_carnet INTEGER NOT NULL CHECK (position_dans_carnet >= 1 AND position_dans_carnet <= 50),
  statut TEXT DEFAULT 'en_stock' CHECK (statut IN ('en_stock', 'servie', 'annulee')),
  date_servie TIMESTAMPTZ,
  motif_annulation TEXT,
  scan_barree TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create attestations_annulees table
CREATE TABLE IF NOT EXISTS attestations_annulees (
  id BIGSERIAL PRIMARY KEY,
  numero_attestation INTEGER NOT NULL,
  motif TEXT NOT NULL CHECK (motif IN ('PRG', 'TRUMAN', 'Annulé')),
  scan_barree TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_created TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestations_annulees ENABLE ROW LEVEL SECURITY;

-- Policies for attestations
CREATE POLICY "Allow authenticated full access to attestations"
  ON attestations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous read access to attestations"
  ON attestations
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous write access to attestations"
  ON attestations
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to attestations"
  ON attestations
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policies for attestations_annulees
CREATE POLICY "Allow authenticated full access to attestations_annulees"
  ON attestations_annulees
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous read access to attestations_annulees"
  ON attestations_annulees
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous write access to attestations_annulees"
  ON attestations_annulees
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Function to get carnet statistics
CREATE OR REPLACE FUNCTION get_carnet_statistics()
RETURNS TABLE (
  total_carnets INTEGER,
  carnets_accomplis INTEGER,
  carnets_en_cours INTEGER,
  total_attestations INTEGER,
  attestations_en_stock INTEGER,
  attestations_servies INTEGER,
  attestations_annulees INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH carnet_stats AS (
    SELECT 
      carnet_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE statut = 'servie') as servies
    FROM attestations
    GROUP BY carnet_id
  )
  SELECT
    (SELECT COUNT(DISTINCT carnet_id)::INTEGER FROM attestations),
    (SELECT COUNT(*)::INTEGER FROM carnet_stats WHERE servies = 50),
    (SELECT COUNT(*)::INTEGER FROM carnet_stats WHERE servies < 50),
    (SELECT COUNT(*)::INTEGER FROM attestations),
    (SELECT COUNT(*)::INTEGER FROM attestations WHERE statut = 'en_stock'),
    (SELECT COUNT(*)::INTEGER FROM attestations WHERE statut = 'servie'),
    (SELECT COUNT(*)::INTEGER FROM attestations WHERE statut = 'annulee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark attestation as servie
CREATE OR REPLACE FUNCTION mark_attestation_servie(attestation_numero INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE attestations
  SET statut = 'servie',
      date_servie = now(),
      updated_at = now()
  WHERE numero = attestation_numero;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if attestation exists and is available
CREATE OR REPLACE FUNCTION check_attestation_disponible(attestation_numero INTEGER)
RETURNS TABLE (
  existe BOOLEAN,
  disponible BOOLEAN,
  carnet_id INTEGER,
  pos_carnet INTEGER,
  statut_actuel TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as existe,
    (a.statut = 'en_stock') as disponible,
    a.carnet_id,
    a.position_dans_carnet as pos_carnet,
    a.statut as statut_actuel
  FROM attestations a
  WHERE a.numero = attestation_numero;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::INTEGER, NULL::INTEGER, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_attestations_numero ON attestations(numero);
CREATE INDEX IF NOT EXISTS idx_attestations_carnet_id ON attestations(carnet_id);
CREATE INDEX IF NOT EXISTS idx_attestations_statut ON attestations(statut);
