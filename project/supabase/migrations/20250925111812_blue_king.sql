/*
  # Création de la table rapport pour tous les contrats

  1. Nouvelle table
    - `rapport` - Table pour stocker tous les contrats (Terme et Affaire)
      - `id` (serial, primary key)
      - `type` (text, not null) - Terme ou Affaire
      - `branche` (text, not null) - Auto, Vie, Santé, IRDS
      - `numero_contrat` (text, not null)
      - `prime` (decimal, not null)
      - `assure` (text, not null)
      - `mode_paiement` (text, not null) - Espece, Cheque, Carte Bancaire
      - `type_paiement` (text, not null) - Au comptant, Crédit
      - `montant_credit` (decimal, nullable) - NULL si paiement au comptant
      - `date_paiement_prevue` (date, nullable) - NULL si paiement au comptant
      - `cree_par` (text, not null)
      - `created_at` (timestamptz, default now)

  2. Sécurité
    - Enable RLS sur la table rapport
    - Politique pour permettre la lecture et l'insertion publique
*/

-- Créer la table rapport
CREATE TABLE IF NOT EXISTS rapport (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('Terme', 'Affaire')),
  branche TEXT NOT NULL CHECK (branche IN ('Auto', 'Vie', 'Santé', 'IRDS')),
  numero_contrat TEXT NOT NULL,
  prime DECIMAL(10,2) NOT NULL DEFAULT 0,
  assure TEXT NOT NULL,
  mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('Espece', 'Cheque', 'Carte Bancaire')),
  type_paiement TEXT NOT NULL CHECK (type_paiement IN ('Au comptant', 'Crédit')),
  montant_credit DECIMAL(10,2), -- NULL si paiement au comptant
  date_paiement_prevue DATE, -- NULL si paiement au comptant
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer RLS sur la table rapport
ALTER TABLE rapport ENABLE ROW LEVEL SECURITY;

-- Créer une politique pour permettre la lecture publique
CREATE POLICY "Allow read access" ON rapport
FOR SELECT
TO public
USING (true);

-- Créer une politique pour permettre l'insertion publique
CREATE POLICY "Allow insert access" ON rapport
FOR INSERT
TO public
WITH CHECK (true);

-- Créer des index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS rapport_numero_contrat_idx ON rapport (numero_contrat);
CREATE INDEX IF NOT EXISTS rapport_type_idx ON rapport (type);
CREATE INDEX IF NOT EXISTS rapport_branche_idx ON rapport (branche);
CREATE INDEX IF NOT EXISTS rapport_type_paiement_idx ON rapport (type_paiement);
CREATE INDEX IF NOT EXISTS rapport_cree_par_idx ON rapport (cree_par);
CREATE INDEX IF NOT EXISTS rapport_created_at_idx ON rapport (created_at);

-- Créer un trigger pour gérer les valeurs NULL automatiquement
CREATE OR REPLACE FUNCTION handle_rapport_nulls()
RETURNS TRIGGER AS $$
BEGIN
    -- Si le type de paiement est "Au comptant", mettre les valeurs crédit à NULL
    IF NEW.type_paiement = 'Au comptant' THEN
        NEW.montant_credit := NULL;
        NEW.date_paiement_prevue := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
CREATE TRIGGER trigger_handle_rapport_nulls
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION handle_rapport_nulls();

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Table rapport créée avec succès';
    RAISE NOTICE '   - Gestion automatique des valeurs NULL pour paiement au comptant';
    RAISE NOTICE '   - Index créés pour optimiser les performances';
    RAISE NOTICE '   - RLS activé avec politiques publiques';
    RAISE NOTICE '   - Trigger pour gérer les valeurs NULL automatiquement';
END $$;
