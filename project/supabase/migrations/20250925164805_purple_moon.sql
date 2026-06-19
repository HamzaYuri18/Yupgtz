/*
  # Création de la table Terme et ajout de la colonne echeance à la table rapport

  1. Nouvelle table
    - `terme` - Table pour stocker les contrats de type "Terme" avec date de paiement
      - `id` (serial, primary key)
      - `numero_contrat` (text, not null)
      - `prime` (decimal, not null)
      - `assure` (text, not null)
      - `branche` (text, not null)
      - `echeance` (date, not null)
      - `date_paiement` (date, default current_date)
      - `cree_par` (text, not null)
      - `created_at` (timestamptz, default now)

  2. Modification table rapport
    - Ajouter la colonne `echeance` (date, nullable)
    - NULL pour les contrats Affaire, date pour les contrats Terme

  3. Sécurité
    - Enable RLS sur la table terme
    - Politiques pour permettre la lecture et l'insertion publique
    - Index pour optimiser les recherches
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
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer RLS sur la table terme
ALTER TABLE terme ENABLE ROW LEVEL SECURITY;

-- Créer une politique pour permettre la lecture publique
CREATE POLICY "Allow read access" ON terme
FOR SELECT
TO public
USING (true);

-- Créer une politique pour permettre l'insertion publique
CREATE POLICY "Allow insert access" ON terme
FOR INSERT
TO public
WITH CHECK (true);

-- Créer des index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS terme_numero_contrat_idx ON terme (numero_contrat);
CREATE INDEX IF NOT EXISTS terme_echeance_idx ON terme (echeance);
CREATE INDEX IF NOT EXISTS terme_numero_echeance_idx ON terme (numero_contrat, echeance);
CREATE INDEX IF NOT EXISTS terme_branche_idx ON terme (branche);
CREATE INDEX IF NOT EXISTS terme_cree_par_idx ON terme (cree_par);
CREATE INDEX IF NOT EXISTS terme_created_at_idx ON terme (created_at);

-- Ajouter la colonne echeance à la table rapport
ALTER TABLE rapport 
ADD COLUMN IF NOT EXISTS echeance DATE;

-- Créer un index sur la nouvelle colonne echeance dans rapport
CREATE INDEX IF NOT EXISTS rapport_echeance_idx ON rapport (echeance);

-- Créer une contrainte unique sur numero_contrat + echeance dans la table terme
ALTER TABLE terme 
ADD CONSTRAINT terme_numero_echeance_unique 
UNIQUE (numero_contrat, echeance);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Table terme créée avec succès';
    RAISE NOTICE '   - Contrainte unique sur numero_contrat + echeance';
    RAISE NOTICE '   - Date de paiement par défaut = date courante';
    RAISE NOTICE '   - Index créés pour optimiser les performances';
    RAISE NOTICE '   - RLS activé avec politiques publiques';
    RAISE NOTICE '✅ Colonne echeance ajoutée à la table rapport';
    RAISE NOTICE '   - NULL pour contrats Affaire, date pour contrats Terme';
END $$;
