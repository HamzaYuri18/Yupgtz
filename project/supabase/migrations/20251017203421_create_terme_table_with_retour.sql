/*
  # Créer la table terme avec colonnes de retour

  1. Nouvelle table
    - `terme` - Table pour stocker les contrats de type "Terme"
      - `id` (serial, primary key)
      - `numero_contrat` (text, not null)
      - `prime` (decimal, not null)
      - `assure` (text, not null)
      - `branche` (text, not null) - Auto, Vie, Santé, IRDS
      - `echeance` (date, not null) - Date d'échéance du terme
      - `date_paiement` (date, default current_date) - Date de paiement effectif
      - `retour` (text, nullable) - Type de retour: "Technique" ou "Contentieux"
      - `prime_avant_retour` (decimal, nullable) - Prime originale avant modification
      - `created_at` (timestamptz, default now)

  2. Contraintes
    - Unique constraint sur (numero_contrat, echeance) pour éviter les doublons
    - Check constraint sur branche pour valider les valeurs
    - Check constraint sur retour pour valider "Technique" ou "Contentieux"

  3. Index
    - Index sur numero_contrat
    - Index sur echeance
    - Index composite sur (numero_contrat, echeance)
    - Index sur branche
    - Index sur retour
    - Index sur created_at

  4. Sécurité
    - RLS activé
    - Politique de lecture publique
    - Politique d'insertion publique
*/

-- Créer la table terme
CREATE TABLE IF NOT EXISTS terme (
  id SERIAL PRIMARY KEY,
  numero_contrat TEXT NOT NULL,
  prime DECIMAL(10,2) NOT NULL DEFAULT 0,
  assure TEXT NOT NULL,
  branche TEXT NOT NULL CHECK (branche IN ('Auto', 'Vie', 'Santé', 'IRDS')),
  echeance DATE NOT NULL,
  date_paiement DATE DEFAULT CURRENT_DATE,
  retour TEXT CHECK (retour IS NULL OR retour IN ('Technique', 'Contentieux')),
  prime_avant_retour DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer RLS sur la table terme
ALTER TABLE terme ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'terme' AND policyname = 'Allow read access'
  ) THEN
    CREATE POLICY "Allow read access" ON terme
    FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'terme' AND policyname = 'Allow insert access'
  ) THEN
    CREATE POLICY "Allow insert access" ON terme
    FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;
END $$;

-- Créer les index
CREATE INDEX IF NOT EXISTS terme_numero_contrat_idx ON terme (numero_contrat);
CREATE INDEX IF NOT EXISTS terme_echeance_idx ON terme (echeance);
CREATE INDEX IF NOT EXISTS terme_numero_echeance_idx ON terme (numero_contrat, echeance);
CREATE INDEX IF NOT EXISTS terme_branche_idx ON terme (branche);
CREATE INDEX IF NOT EXISTS terme_retour_idx ON terme (retour);
CREATE INDEX IF NOT EXISTS terme_created_at_idx ON terme (created_at);

-- Ajouter la contrainte unique sur (numero_contrat, echeance)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'terme_numero_echeance_unique'
  ) THEN
    ALTER TABLE terme 
    ADD CONSTRAINT terme_numero_echeance_unique 
    UNIQUE (numero_contrat, echeance);
  END IF;
END $$;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Table terme créée avec succès';
    RAISE NOTICE '   - Colonnes de base: numero_contrat, prime, assure, branche, echeance, date_paiement';
    RAISE NOTICE '   - Colonnes de retour: retour (Technique/Contentieux), prime_avant_retour';
    RAISE NOTICE '   - Contrainte unique sur (numero_contrat, echeance)';
    RAISE NOTICE '   - RLS activé avec politiques publiques';
    RAISE NOTICE '   - Index créés pour optimiser les performances';
END $$;
