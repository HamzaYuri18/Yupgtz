
CREATE TABLE IF NOT EXISTS suivie_realisations (
  id SERIAL PRIMARY KEY,
  numero_contrat TEXT NOT NULL,
  type_contrat TEXT NOT NULL,
  branche TEXT NOT NULL,
  assure TEXT NOT NULL,
  prime_ttc DECIMAL(10,2) NOT NULL DEFAULT 0,
  prime_nette DECIMAL(10,2) NOT NULL DEFAULT 0,
  prime_brute DECIMAL(10,2) GENERATED ALWAYS AS ((prime_nette - 3) / 1.12) STORED,
  utilisateur TEXT NOT NULL,
  date_realisation DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suivie_realisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_suivie_realisations" ON suivie_realisations FOR SELECT TO public USING (true);
CREATE POLICY "insert_suivie_realisations" ON suivie_realisations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "update_suivie_realisations" ON suivie_realisations FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "delete_suivie_realisations" ON suivie_realisations FOR DELETE TO public USING (true);

CREATE INDEX IF NOT EXISTS suivie_realisations_utilisateur_idx ON suivie_realisations (utilisateur);
CREATE INDEX IF NOT EXISTS suivie_realisations_date_idx ON suivie_realisations (date_realisation);
CREATE INDEX IF NOT EXISTS suivie_realisations_type_contrat_idx ON suivie_realisations (type_contrat);
CREATE INDEX IF NOT EXISTS suivie_realisations_numero_contrat_idx ON suivie_realisations (numero_contrat);
