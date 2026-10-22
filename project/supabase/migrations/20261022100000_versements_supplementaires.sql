/*
  # Versements supplémentaires (table UI "Versements par date")

  1. New Table
    - `versements_supplementaires` — un versement additionnel saisi
      manuellement pour une date de versement + banque donnée, avec son
      libellé. Vient s'ajouter au total/nombre affichés dans le tableau
      groupé "Versements par date", sans être lié à une session précise.

  2. Security
    - Enable RLS, politiques permissives anon/authenticated (l'app
      n'utilise pas l'authentification Supabase), comme le reste du
      projet.
*/

CREATE TABLE IF NOT EXISTS versements_supplementaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_versement date NOT NULL,
  banque text NOT NULL,
  montant numeric NOT NULL,
  libelle text NOT NULL,
  cree_par text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE versements_supplementaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read versements_supplementaires" ON versements_supplementaires;
CREATE POLICY "Allow read versements_supplementaires"
  ON versements_supplementaires FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert versements_supplementaires" ON versements_supplementaires;
CREATE POLICY "Allow insert versements_supplementaires"
  ON versements_supplementaires FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete versements_supplementaires" ON versements_supplementaires;
CREATE POLICY "Allow delete versements_supplementaires"
  ON versements_supplementaires FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_versements_supplementaires_date_banque
  ON versements_supplementaires(date_versement, banque);
