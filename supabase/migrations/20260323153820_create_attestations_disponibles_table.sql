/*
  # Créer la table des attestations disponibles à la réutilisation

  1. Nouvelle Table
    - `attestations_disponibles`
      - `id` (serial, primary key)
      - `numero_attestation` (text, unique, not null) - Le numéro d'attestation disponible
      - `libere_le` (timestamptz, default now) - Date de libération
      - `libere_par` (text) - Utilisateur qui a libéré l'attestation
      - `motif_liberation` (text) - Motif de suppression du contrat
      - `ancien_numero_contrat` (text) - Numéro du contrat supprimé
      - `ancien_assure` (text) - Nom de l'assuré du contrat supprimé
      - `reutilise` (boolean, default false) - Si l'attestation a été réutilisée
      - `reutilise_le` (timestamptz) - Date de réutilisation
      - `reutilise_par` (text) - Utilisateur qui a réutilisé
      - `nouveau_numero_contrat` (text) - Numéro du nouveau contrat

  2. Sécurité
    - Enable RLS sur `attestations_disponibles`
    - Politique permettant à tous les utilisateurs de lire et modifier
*/

CREATE TABLE IF NOT EXISTS attestations_disponibles (
  id serial PRIMARY KEY,
  numero_attestation text UNIQUE NOT NULL,
  libere_le timestamptz DEFAULT now(),
  libere_par text,
  motif_liberation text,
  ancien_numero_contrat text,
  ancien_assure text,
  reutilise boolean DEFAULT false,
  reutilise_le timestamptz,
  reutilise_par text,
  nouveau_numero_contrat text
);

ALTER TABLE attestations_disponibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permettre lecture des attestations disponibles"
  ON attestations_disponibles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permettre insertion des attestations disponibles"
  ON attestations_disponibles
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permettre modification des attestations disponibles"
  ON attestations_disponibles
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permettre suppression des attestations disponibles"
  ON attestations_disponibles
  FOR DELETE
  TO public
  USING (true);