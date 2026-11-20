/*
  # Ordres de virement bancaire

  1. Nouvelles tables
    - `comptes_emetteurs_virement` : comptes emetteurs enregistres pour
      reutilisation (titulaire du compte + numero de compte + banque),
      unique par (titulaire, numero_compte).
    - `beneficiaires_virement` : beneficiaires enregistres pour
      reutilisation (nom + numero de compte + banque), unique par
      (nom, numero_compte).
    - `ordres_virement` : historique de tous les ordres de virement
      emis (emetteur, beneficiaire, montant, objet, date).

  2. Securite
    - RLS active sur les 3 tables, acces complet (lecture/ecriture)
      pour authenticated et anon, au meme titre que le reste de
      l'application.
*/

CREATE TABLE IF NOT EXISTS comptes_emetteurs_virement (
  id bigserial PRIMARY KEY,
  titulaire text NOT NULL,
  numero_compte text NOT NULL,
  banque text NOT NULL,
  cree_par text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (titulaire, numero_compte)
);

CREATE TABLE IF NOT EXISTS beneficiaires_virement (
  id bigserial PRIMARY KEY,
  nom text NOT NULL,
  numero_compte text NOT NULL,
  banque text NOT NULL,
  cree_par text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (nom, numero_compte)
);

CREATE TABLE IF NOT EXISTS ordres_virement (
  id bigserial PRIMARY KEY,
  titulaire_emetteur text NOT NULL,
  numero_compte_emetteur text NOT NULL,
  banque_emetteur text NOT NULL,
  beneficiaire text NOT NULL,
  numero_compte_beneficiaire text NOT NULL,
  banque_beneficiaire text NOT NULL,
  montant numeric NOT NULL,
  objet text NOT NULL,
  date_virement date NOT NULL,
  cree_par text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comptes_emetteurs_virement ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaires_virement ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordres_virement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON comptes_emetteurs_virement;
DROP POLICY IF EXISTS "Allow anonymous all" ON comptes_emetteurs_virement;
CREATE POLICY "Allow authenticated access" ON comptes_emetteurs_virement
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous all" ON comptes_emetteurs_virement
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access" ON beneficiaires_virement;
DROP POLICY IF EXISTS "Allow anonymous all" ON beneficiaires_virement;
CREATE POLICY "Allow authenticated access" ON beneficiaires_virement
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous all" ON beneficiaires_virement
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access" ON ordres_virement;
DROP POLICY IF EXISTS "Allow anonymous all" ON ordres_virement;
CREATE POLICY "Allow authenticated access" ON ordres_virement
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous all" ON ordres_virement
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ordres_virement_date ON ordres_virement(date_virement);
