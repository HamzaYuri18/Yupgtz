/*
  # Création de la table Cheques

  1. Nouvelle table
    - `cheques`
      - `id` (bigint, primary key, auto-increment)
      - `numero_contrat` (text) - Numéro du contrat
      - `assure` (text) - Nom de l'assuré
      - `numero_cheque` (text) - Numéro du chèque
      - `titulaire_cheque` (text) - Titulaire du chèque (nom de l'assuré)
      - `montant` (numeric) - Montant du chèque
      - `date_encaissement_prevue` (date) - Date prévue d'encaissement
      - `banque` (text) - Nom de la banque
      - `statut` (text) - Statut du chèque (défaut: "Non Encaissé")
      - `created_at` (timestamptz) - Date de création
      - `cree_par` (text) - Utilisateur qui a créé l'enregistrement

  2. Sécurité
    - Activer RLS sur la table `cheques`
    - Ajouter des politiques pour les utilisateurs authentifiés
*/

CREATE TABLE IF NOT EXISTS cheques (
  id bigserial PRIMARY KEY,
  numero_contrat text NOT NULL,
  assure text NOT NULL,
  numero_cheque text NOT NULL,
  titulaire_cheque text NOT NULL,
  montant numeric NOT NULL,
  date_encaissement_prevue date NOT NULL,
  banque text NOT NULL,
  statut text DEFAULT 'Non Encaissé' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  cree_par text NOT NULL
);

ALTER TABLE cheques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all cheques"
  ON cheques FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert cheques"
  ON cheques FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update cheques"
  ON cheques FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete cheques"
  ON cheques FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_cheques_numero_contrat ON cheques(numero_contrat);
CREATE INDEX IF NOT EXISTS idx_cheques_statut ON cheques(statut);
CREATE INDEX IF NOT EXISTS idx_cheques_date_encaissement ON cheques(date_encaissement_prevue);