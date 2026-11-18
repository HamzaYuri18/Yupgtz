/*
  # Table de detail des encaissements partiels de cheques

  1. Nouvelle table
    - `details_cheques_encaisses_partiellement`
      - `id` (bigserial, cle primaire)
      - `cheque_id` (bigint, cle etrangere vers "Cheques"(id))
      - `montant` (numeric) : montant de cet encaissement partiel
      - `date_encaissement` (date) : date de cet encaissement partiel
      - `created_at` (timestamptz)

  2. Lien avec la table Cheques
    - ON DELETE CASCADE / ON UPDATE CASCADE : si un cheque est supprime
      ou que son id est modifie, les lignes de detail associees suivent
      automatiquement.

  3. Securite
    - RLS active, acces complet (lecture/ecriture) pour authenticated
      et anon, au meme titre que la table Cheques.
*/

CREATE TABLE IF NOT EXISTS details_cheques_encaisses_partiellement (
  id bigserial PRIMARY KEY,
  cheque_id bigint NOT NULL REFERENCES "Cheques"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  montant numeric NOT NULL,
  date_encaissement date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE details_cheques_encaisses_partiellement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON details_cheques_encaisses_partiellement;
DROP POLICY IF EXISTS "Allow anonymous all" ON details_cheques_encaisses_partiellement;

CREATE POLICY "Allow authenticated access"
  ON details_cheques_encaisses_partiellement
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous all"
  ON details_cheques_encaisses_partiellement
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_details_cheques_partiel_cheque_id
  ON details_cheques_encaisses_partiellement(cheque_id);
