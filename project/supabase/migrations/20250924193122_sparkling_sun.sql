/*
  # Création de la table Affaire

  1. Nouvelle table
    - `affaire` - Table pour stocker tous les contrats de type "Affaire"
      - `id` (serial, primary key)
      - `numero_contrat` (text, not null)
      - `prime` (decimal, not null)
      - `assure` (text, not null)
      - `branche` (text, not null) - Auto, Vie, Santé, IRDS
      - `mode_paiement` (text, not null) - Espece, Cheque, Carte Bancaire
      - `type_paiement` (text, not null) - Au comptant, Crédit
      - `montant_credit` (decimal, nullable)
      - `date_paiement` (date, nullable)
      - `cree_par` (text, not null)
      - `created_at` (timestamptz, default now)

  2. Sécurité
    - Enable RLS sur la table affaire
    - Politique pour permettre la lecture et l'insertion publique
*/

-- Créer la table affaire
CREATE TABLE IF NOT EXISTS affaire (
  id SERIAL PRIMARY KEY,
  numero_contrat TEXT NOT NULL,
  prime DECIMAL(10,2) NOT NULL DEFAULT 0,
  assure TEXT NOT NULL,
  branche TEXT NOT NULL CHECK (branche IN ('Auto', 'Vie', 'Santé', 'IRDS')),
  mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('Espece', 'Cheque', 'Carte Bancaire')),
  type_paiement TEXT NOT NULL CHECK (type_paiement IN ('Au comptant', 'Crédit')),
  montant_credit DECIMAL(10,2),
  date_paiement DATE,
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer RLS sur la table affaire
ALTER TABLE affaire ENABLE ROW LEVEL SECURITY;

-- Créer une politique pour permettre la lecture publique
CREATE POLICY "Allow read access" ON affaire
FOR SELECT
TO public
USING (true);

-- Créer une politique pour permettre l'insertion publique
CREATE POLICY "Allow insert access" ON affaire
FOR INSERT
TO public
WITH CHECK (true);

-- Créer des index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS affaire_numero_contrat_idx ON affaire (numero_contrat);
CREATE INDEX IF NOT EXISTS affaire_branche_idx ON affaire (branche);
CREATE INDEX IF NOT EXISTS affaire_cree_par_idx ON affaire (cree_par);
CREATE INDEX IF NOT EXISTS affaire_created_at_idx ON affaire (created_at);

-- Insérer quelques données de test (optionnel)
INSERT INTO affaire (numero_contrat, prime, assure, branche, mode_paiement, type_paiement, cree_par)
VALUES 
  ('AFF-001', 1200.00, 'Test Assuré Affaire 1', 'Auto', 'Espece', 'Au comptant', 'System'),
  ('AFF-002', 1800.50, 'Test Assuré Affaire 2', 'Vie', 'Cheque', 'Crédit', 'System')
ON CONFLICT DO NOTHING;
