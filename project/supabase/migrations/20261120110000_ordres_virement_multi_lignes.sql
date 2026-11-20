/*
  # Ordres de virement multi-lignes (plusieurs beneficiaires par ordre)

  1. Changements
    - `ordres_virement` devient l'enveloppe de l'ordre (emetteur + date
      + createur uniquement) : les colonnes propres a un beneficiaire
      (beneficiaire, numero_compte_beneficiaire, banque_beneficiaire,
      montant, objet) sont retirees de cette table si elles existent
      (migration depuis la version a un seul beneficiaire par ordre).
    - Nouvelle table `lignes_virement_bancaire` : une ligne par
      beneficiaire au sein d'un ordre (beneficiaire, numero de compte,
      banque, montant, objet), liee a `ordres_virement` par `ordre_id`
      avec suppression en cascade.

  2. Securite
    - RLS active sur `lignes_virement_bancaire`, acces complet
      (lecture/ecriture) pour authenticated et anon, au meme titre que
      le reste de l'application.

  Note : si la precedente migration (ordre a un seul beneficiaire)
  n'a pas encore ete executee, les DROP COLUMN IF EXISTS ci-dessous
  sont sans effet et ne posent aucun probleme.
*/

ALTER TABLE ordres_virement DROP COLUMN IF EXISTS beneficiaire;
ALTER TABLE ordres_virement DROP COLUMN IF EXISTS numero_compte_beneficiaire;
ALTER TABLE ordres_virement DROP COLUMN IF EXISTS banque_beneficiaire;
ALTER TABLE ordres_virement DROP COLUMN IF EXISTS montant;
ALTER TABLE ordres_virement DROP COLUMN IF EXISTS objet;

CREATE TABLE IF NOT EXISTS lignes_virement_bancaire (
  id bigserial PRIMARY KEY,
  ordre_id bigint NOT NULL REFERENCES ordres_virement(id) ON DELETE CASCADE,
  beneficiaire text NOT NULL,
  numero_compte_beneficiaire text NOT NULL,
  banque_beneficiaire text NOT NULL,
  montant numeric NOT NULL,
  objet text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lignes_virement_bancaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON lignes_virement_bancaire;
DROP POLICY IF EXISTS "Allow anonymous all" ON lignes_virement_bancaire;
CREATE POLICY "Allow authenticated access" ON lignes_virement_bancaire
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous all" ON lignes_virement_bancaire
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lignes_virement_bancaire_ordre_id
  ON lignes_virement_bancaire(ordre_id);
