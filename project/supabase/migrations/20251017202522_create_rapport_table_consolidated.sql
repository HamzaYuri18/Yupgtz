/*
  # Création consolidée de la table rapport
  
  1. Nouvelle table
    - `rapport` - Table pour stocker tous les contrats (Terme et Affaire)
      - `id` (serial, primary key)
      - `type` (text, not null) - Terme ou Affaire
      - `branche` (text, not null) - Auto, Vie, Santé, IRDS
      - `numero_contrat` (text, not null)
      - `prime` (decimal, not null, default 0)
      - `assure` (text, not null)
      - `mode_paiement` (text, not null) - Espece, Cheque, Carte Bancaire
      - `type_paiement` (text, not null) - Au comptant, Crédit
      - `montant_credit` (decimal, nullable) - NULL si paiement au comptant
      - `montant` (decimal, not null, default 0) - Montant calculé
      - `date_paiement_prevue` (date, nullable) - NULL si paiement au comptant
      - `cree_par` (text, not null)
      - `created_at` (timestamptz, default now)
  
  2. Sécurité
    - Enable RLS sur la table rapport
    - Politiques pour permettre l'accès public (lecture, insertion, modification, suppression)
  
  3. Triggers
    - Trigger pour gérer les valeurs NULL automatiquement
    - Trigger pour calculer le montant selon le type de paiement
*/

-- Créer la table rapport si elle n'existe pas
CREATE TABLE IF NOT EXISTS rapport (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('Terme', 'Affaire')),
  branche TEXT NOT NULL CHECK (branche IN ('Auto', 'Vie', 'Santé', 'IRDS')),
  numero_contrat TEXT NOT NULL,
  prime DECIMAL(10,2) NOT NULL DEFAULT 0,
  assure TEXT NOT NULL,
  mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('Espece', 'Cheque', 'Carte Bancaire')),
  type_paiement TEXT NOT NULL CHECK (type_paiement IN ('Au comptant', 'Crédit')),
  montant_credit DECIMAL(10,2),
  montant DECIMAL(10,2) NOT NULL DEFAULT 0,
  date_paiement_prevue DATE,
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer RLS sur la table rapport
ALTER TABLE rapport ENABLE ROW LEVEL SECURITY;

-- Créer des politiques pour permettre l'accès public
CREATE POLICY "Allow read access" ON rapport
FOR SELECT TO public USING (true);

CREATE POLICY "Allow insert access" ON rapport
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow update access" ON rapport
FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access" ON rapport
FOR DELETE TO public USING (true);

-- Créer des index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS rapport_numero_contrat_idx ON rapport (numero_contrat);
CREATE INDEX IF NOT EXISTS rapport_type_idx ON rapport (type);
CREATE INDEX IF NOT EXISTS rapport_branche_idx ON rapport (branche);
CREATE INDEX IF NOT EXISTS rapport_type_paiement_idx ON rapport (type_paiement);
CREATE INDEX IF NOT EXISTS rapport_cree_par_idx ON rapport (cree_par);
CREATE INDEX IF NOT EXISTS rapport_created_at_idx ON rapport (created_at);
CREATE INDEX IF NOT EXISTS rapport_montant_idx ON rapport (montant);

-- Fonction pour calculer le montant selon le type de paiement
CREATE OR REPLACE FUNCTION calculate_montant_rapport()
RETURNS TRIGGER AS $$
BEGIN
    -- Logique de calcul selon le type de paiement
    IF NEW.type_paiement = 'Crédit' AND NEW.montant_credit IS NOT NULL AND NEW.montant_credit > 0 THEN
        -- Pour les crédits : montant = prime - montant_credit
        NEW.montant := NEW.prime - NEW.montant_credit;
    ELSE
        -- Pour les paiements au comptant : montant = prime
        NEW.montant := NEW.prime;
    END IF;
    
    -- Gérer les valeurs NULL pour les paiements au comptant
    IF NEW.type_paiement = 'Au comptant' THEN
        NEW.montant_credit := NULL;
        NEW.date_paiement_prevue := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour calculer le montant
CREATE TRIGGER trigger_calculate_montant_rapport
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION calculate_montant_rapport();
