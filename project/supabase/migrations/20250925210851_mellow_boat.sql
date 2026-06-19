/*
  # Création des tables pour la gestion financière

  1. Nouvelles tables
    - `depenses` - Table pour stocker les dépenses
    - `recettes_exceptionnelles` - Table pour stocker les recettes exceptionnelles
    - `ristournes` - Table pour stocker les ristournes
    - `sinistres` - Table pour stocker les sinistres

  2. Sécurité
    - Enable RLS sur toutes les tables
    - Politiques pour permettre la lecture et l'insertion publique
    - Index pour optimiser les performances
*/

-- Table Dépenses
CREATE TABLE IF NOT EXISTS depenses (
  id SERIAL PRIMARY KEY,
  type_depense TEXT NOT NULL CHECK (type_depense IN (
    'Frais Bureau', 
    'Frais de Ménage', 
    'STEG', 
    'SONED', 
    'A/S Ahlem', 
    'A/S Islem', 
    'Reprise sur Avance Client', 
    'Versement Bancaire'
    'Remise'
  )),
  montant DECIMAL(10,2) NOT NULL DEFAULT 0,
  date_depense DATE DEFAULT CURRENT_DATE,
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Recettes Exceptionnelles
CREATE TABLE IF NOT EXISTS recettes_exceptionnelles (
  id SERIAL PRIMARY KEY,
  type_recette TEXT NOT NULL CHECK (type_recette IN (
    'Hamza', 
    'Récupération A/S Ahlem', 
    'Récupération A/S Islem', 
    'Avance Client'
  )),
  montant DECIMAL(10,2) NOT NULL DEFAULT 0,
  date_recette DATE DEFAULT CURRENT_DATE,
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Ristournes
CREATE TABLE IF NOT EXISTS ristournes (
  id SERIAL PRIMARY KEY,
  numero_contrat TEXT NOT NULL,
  client TEXT NOT NULL,
  montant_ristourne DECIMAL(10,2) NOT NULL DEFAULT 0,
  date_ristourne DATE DEFAULT CURRENT_DATE,
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Sinistres
CREATE TABLE IF NOT EXISTS sinistres (
  id SERIAL PRIMARY KEY,
  numero_sinistre TEXT NOT NULL UNIQUE,
  montant DECIMAL(10,2) NOT NULL DEFAULT 0,
  client TEXT NOT NULL,
  date_sinistre DATE DEFAULT CURRENT_DATE,
  cree_par TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer RLS sur toutes les tables
ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recettes_exceptionnelles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ristournes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinistres ENABLE ROW LEVEL SECURITY;

-- Politiques pour la table depenses
CREATE POLICY "Allow read access" ON depenses
FOR SELECT TO public USING (true);

CREATE POLICY "Allow insert access" ON depenses
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow update access" ON depenses
FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access" ON depenses
FOR DELETE TO public USING (true);

-- Politiques pour la table recettes_exceptionnelles
CREATE POLICY "Allow read access" ON recettes_exceptionnelles
FOR SELECT TO public USING (true);

CREATE POLICY "Allow insert access" ON recettes_exceptionnelles
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow update access" ON recettes_exceptionnelles
FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access" ON recettes_exceptionnelles
FOR DELETE TO public USING (true);

-- Politiques pour la table ristournes
CREATE POLICY "Allow read access" ON ristournes
FOR SELECT TO public USING (true);

CREATE POLICY "Allow insert access" ON ristournes
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow update access" ON ristournes
FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access" ON ristournes
FOR DELETE TO public USING (true);

-- Politiques pour la table sinistres
CREATE POLICY "Allow read access" ON sinistres
FOR SELECT TO public USING (true);

CREATE POLICY "Allow insert access" ON sinistres
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow update access" ON sinistres
FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access" ON sinistres
FOR DELETE TO public USING (true);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS depenses_type_depense_idx ON depenses (type_depense);
CREATE INDEX IF NOT EXISTS depenses_date_depense_idx ON depenses (date_depense);
CREATE INDEX IF NOT EXISTS depenses_cree_par_idx ON depenses (cree_par);

CREATE INDEX IF NOT EXISTS recettes_exceptionnelles_type_recette_idx ON recettes_exceptionnelles (type_recette);
CREATE INDEX IF NOT EXISTS recettes_exceptionnelles_date_recette_idx ON recettes_exceptionnelles (date_recette);
CREATE INDEX IF NOT EXISTS recettes_exceptionnelles_cree_par_idx ON recettes_exceptionnelles (cree_par);

CREATE INDEX IF NOT EXISTS ristournes_numero_contrat_idx ON ristournes (numero_contrat);
CREATE INDEX IF NOT EXISTS ristournes_client_idx ON ristournes (client);
CREATE INDEX IF NOT EXISTS ristournes_date_ristourne_idx ON ristournes (date_ristourne);
CREATE INDEX IF NOT EXISTS ristournes_cree_par_idx ON ristournes (cree_par);

CREATE INDEX IF NOT EXISTS sinistres_numero_sinistre_idx ON sinistres (numero_sinistre);
CREATE INDEX IF NOT EXISTS sinistres_client_idx ON sinistres (client);
CREATE INDEX IF NOT EXISTS sinistres_date_sinistre_idx ON sinistres (date_sinistre);
CREATE INDEX IF NOT EXISTS sinistres_cree_par_idx ON sinistres (cree_par);

-- Contrainte unique pour éviter les doublons de ristournes
ALTER TABLE ristournes 
ADD CONSTRAINT ristournes_unique_contrat_date_montant_client 
UNIQUE (numero_contrat, date_ristourne, montant_ristourne, client);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Tables de gestion financière créées avec succès';
    RAISE NOTICE '   - Table depenses avec 8 types de dépenses';
    RAISE NOTICE '   - Table recettes_exceptionnelles avec 4 types de recettes';
    RAISE NOTICE '   - Table ristournes avec contrainte unique';
    RAISE NOTICE '   - Table sinistres avec numéro unique';
    RAISE NOTICE '   - RLS activé avec politiques publiques complètes';
    RAISE NOTICE '   - Index créés pour optimiser les performances';
END $$;
