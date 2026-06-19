/*
  # Ajout du champ statut à la table sessions

  1. Modifications
    - Ajout du champ `statut` avec valeur par défaut 'non versée'
  
  2. Sécurité
    - Maintien de l'accès via JWT
*/

-- Ajouter le champ statut s'il n'existe pas déjà
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'sessions' 
    AND column_name = 'statut'
  ) THEN
    ALTER TABLE sessions
    ADD COLUMN statut TEXT DEFAULT 'non versée';
  END IF;
END $$;