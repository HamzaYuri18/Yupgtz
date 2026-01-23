/*
  # Ajout contrainte unique sur date_session

  1. Modifications
    - Ajoute une contrainte unique sur la colonne `date_session` de la table `sessions`
    - Empêche la création de sessions en double pour la même date
  
  2. Sécurité
    - Garantit qu'une seule session existe par date
    - Évite les doublons de sessions
*/

-- Supprimer les doublons existants (garder le plus récent)
DO $$
BEGIN
  DELETE FROM sessions a
  USING sessions b
  WHERE a.date_session = b.date_session
    AND a.id < b.id;
END $$;

-- Ajouter contrainte unique sur date_session si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_date_session_unique'
  ) THEN
    ALTER TABLE sessions
    ADD CONSTRAINT sessions_date_session_unique UNIQUE (date_session);
  END IF;
END $$;