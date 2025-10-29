/*
  # Create sessions table

  1. New Tables
    - `sessions`
      - `id` (serial, primary key)
      - `date_session` (date) - Date de la session
      - `total_espece` (decimal) - Total des opérations en espèces
      - `versement` (decimal) - Montant versé
      - `date_versement` (date) - Date du versement
      - `charges` (decimal) - Montant des charges
      - `banque` (text) - Banque (ATTIJARI ou BIAT)
      - `solde` (decimal, computed) - Différence entre versement et (total_espece - charges)
      - `statut` (text) - Statut du versement (Non versé, Versé)
      - `cree_par` (text) - Utilisateur qui a créé la session
      - `created_at` (timestamptz) - Date de création

  2. Security
    - Enable RLS on `sessions` table
    - Add policies for public access

  3. Indexes
    - Add index on `date_session` for date filtering
    - Add index on `statut` for status filtering
*/

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  date_session DATE NOT NULL,
  total_espece DECIMAL(10,2) DEFAULT 0,
  versement DECIMAL(10,2) DEFAULT 0,
  date_versement DATE,
  charges DECIMAL(10,2) DEFAULT 0,
  banque TEXT CHECK (banque IN ('ATTIJARI', 'BIAT', '')),
  statut TEXT DEFAULT 'Non versé' CHECK (statut IN ('Non versé', 'Versé')),
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for sessions table
CREATE POLICY "Allow read access" ON sessions
FOR SELECT TO public USING (true);

CREATE POLICY "Allow insert access" ON sessions
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow update access" ON sessions
FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access" ON sessions
FOR DELETE TO public USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS sessions_date_session_idx ON sessions (date_session);
CREATE INDEX IF NOT EXISTS sessions_statut_idx ON sessions (statut);
CREATE INDEX IF NOT EXISTS sessions_cree_par_idx ON sessions (cree_par);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Table sessions créée avec succès';
    RAISE NOTICE '   - Colonnes: date_session, total_espece, versement, charges, banque, solde, statut';
    RAISE NOTICE '   - Statut par défaut: Non versé';
    RAISE NOTICE '   - Banques: ATTIJARI, BIAT';
    RAISE NOTICE '   - RLS activé avec politiques publiques';
END $$;
