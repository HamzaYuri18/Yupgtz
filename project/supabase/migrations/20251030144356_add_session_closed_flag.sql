/*
  # Add session closed flag and shared session logic

  1. Modifications
    - Ajout de la colonne `session_fermee` à la table `sessions`
      - Type: BOOLEAN
      - Valeur par défaut: false
      - Indique si la session a été fermée (déconnexion officielle)
    
  2. Index
    - Ajout d'un index sur `session_fermee` pour optimiser les recherches
*/

-- Ajouter la colonne session_fermee
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'session_fermee'
  ) THEN
    ALTER TABLE sessions 
    ADD COLUMN session_fermee BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Créer un index sur session_fermee
CREATE INDEX IF NOT EXISTS sessions_session_fermee_idx ON sessions (session_fermee);
