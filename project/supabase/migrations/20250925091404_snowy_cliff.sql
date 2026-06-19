/*
  # Création de la table Liste des Crédits

  1. Nouvelle table
    - `liste_credits` - Table pour stocker tous les crédits
      - `id` (serial, primary key)
      - `numero_contrat` (text, not null)
      - `prime` (decimal, not null)
      - `assure` (text, not null)
      - `branche` (text, not null)
      - `montant_credit` (decimal, not null)
      - `date_paiement_prevue` (date, nullable)
      - `cree_par` (text, not null)
      - `statut` (text, default 'Non payé')
      - `date_paiement_effectif` (date, nullable)
      - `created_at` (timestamptz, default now)

  2. Sécurité
    - Enable RLS sur la table liste_credits
    - Politique pour permettre la lecture et l'insertion publique
*/

-- Créer la table liste_credits
CREATE TABLE IF NOT EXISTS liste_credits (
  id SERIAL PRIMARY KEY,
  numero_contrat TEXT NOT NULL,
  prime DECIMAL(10,2) NOT NULL DEFAULT 0,
  assure TEXT NOT NULL,
  branche TEXT NOT NULL CHECK (branche IN ('Auto', 'Vie', 'Santé', 'IRDS')),
  montant_credit DECIMAL(10,2) NOT NULL,
  date_paiement_prevue DATE,
  cree_par TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'Non payé' CHECK (statut IN ('Non payé', 'Payé', 'En retard')),
  date_paiement_effectif DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer RLS sur la table liste_credits
ALTER TABLE liste_credits ENABLE ROW LEVEL SECURITY;

-- Créer une politique pour permettre la lecture publique
CREATE POLICY "Allow read access" ON liste_credits
FOR SELECT
TO public
USING (true);

-- Créer une politique pour permettre l'insertion publique
CREATE POLICY "Allow insert access" ON liste_credits
FOR INSERT
TO public
WITH CHECK (true);

-- Créer une politique pour permettre la mise à jour publique
CREATE POLICY "Allow update access" ON liste_credits
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Créer des index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS liste_credits_numero_contrat_idx ON liste_credits (numero_contrat);
CREATE INDEX IF NOT EXISTS liste_credits_statut_idx ON liste_credits (statut);
CREATE INDEX IF NOT EXISTS liste_credits_branche_idx ON liste_credits (branche);
CREATE INDEX IF NOT EXISTS liste_credits_cree_par_idx ON liste_credits (cree_par);
CREATE INDEX IF NOT EXISTS liste_credits_created_at_idx ON liste_credits (created_at);
