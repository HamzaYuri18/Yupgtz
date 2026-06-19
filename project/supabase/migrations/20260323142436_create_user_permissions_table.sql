/*
  # Create user_permissions table

  ## Summary
  Creates a table to store per-user access permissions for each dashboard section.
  Only Hamza (admin) can manage these permissions through the Gestion Acces interface.

  ## New Tables
  - `user_permissions`
    - `id` (uuid, primary key)
    - `username` (text, unique) - the user this permission set belongs to
    - `permissions` (jsonb) - map of tab keys to boolean access flags
    - `updated_by` (text) - who last updated these permissions
    - `updated_at` (timestamptz) - when permissions were last changed
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Anyone can read permissions (needed for access checks on login)
  - Only anon/authenticated can insert/update (enforced by app logic for Hamza only)
*/

CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text DEFAULT 'Hamza',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user_permissions"
  ON user_permissions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert user_permissions"
  ON user_permissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update user_permissions"
  ON user_permissions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Insert default permissions for existing users
-- All tabs are accessible by default (true) to preserve existing behavior
INSERT INTO user_permissions (username, permissions, updated_by)
VALUES 
  ('Ahlem', '{
    "home": true,
    "contract": true,
    "reports": true,
    "statistics": true,
    "credits": true,
    "financial": true,
    "payment": true,
    "terme": true,
    "transactions": true,
    "encaissement": true,
    "reporting": true
  }'::jsonb, 'Hamza'),
  ('Islem', '{
    "home": true,
    "contract": true,
    "reports": true,
    "statistics": true,
    "credits": true,
    "financial": true,
    "payment": true,
    "terme": true,
    "transactions": true,
    "encaissement": true,
    "reporting": true
  }'::jsonb, 'Hamza'),
  ('Rouae', '{
    "home": true,
    "contract": true,
    "reports": true,
    "statistics": true,
    "credits": true,
    "financial": true,
    "payment": true,
    "terme": true,
    "transactions": true,
    "encaissement": true,
    "reporting": true
  }'::jsonb, 'Hamza')
ON CONFLICT (username) DO NOTHING;
