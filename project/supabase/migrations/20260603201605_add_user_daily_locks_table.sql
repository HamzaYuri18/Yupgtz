/*
  # Création de la table user_daily_locks

  ## Objectif
  Gérer le blocage journalier des utilisateurs Ahlem et Rouae après déconnexion ou génération de FC.

  ## Nouvelles Tables
  - `user_daily_locks`
    - `id` (serial, primary key)
    - `username` (text) : nom de l'utilisateur bloqué
    - `lock_date` (date) : date du blocage (jour où la déconnexion a eu lieu)
    - `locked_at` (timestamptz) : horodatage exact du blocage
    - `reason` (text) : raison du blocage ('logout' ou 'fc_generated')
    - UNIQUE sur (username, lock_date)

  ## Sécurité
  - RLS activé avec accès public (anon) pour lecture et écriture
    car l'application utilise l'authentification locale (non Supabase Auth)
*/

CREATE TABLE IF NOT EXISTS user_daily_locks (
  id serial PRIMARY KEY,
  username text NOT NULL,
  lock_date date NOT NULL DEFAULT CURRENT_DATE,
  locked_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'logout',
  UNIQUE (username, lock_date)
);

ALTER TABLE user_daily_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read user_daily_locks"
  ON user_daily_locks
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert user_daily_locks"
  ON user_daily_locks
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update user_daily_locks"
  ON user_daily_locks
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
