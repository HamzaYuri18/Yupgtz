/*
  # Correction des politiques RLS pour la table Cheques - Support anon et authenticated

  1. Modifications
    - Suppression des politiques existantes
    - Ajout de politiques qui fonctionnent pour anon ET authenticated
    - Permet l'insertion, la lecture, la mise à jour et la suppression

  2. Sécurité
    - Permet aux utilisateurs anon et authenticated d'effectuer toutes les opérations
    - Nécessaire car l'application utilise la clé anon de Supabase
*/

-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "Read" ON "Cheques";
DROP POLICY IF EXISTS "Delete_Cheque" ON "Cheques";
DROP POLICY IF EXISTS "Users can insert cheques" ON "Cheques";
DROP POLICY IF EXISTS "Users can update cheques" ON "Cheques";

-- Créer des politiques pour SELECT (anon et authenticated)
CREATE POLICY "Anyone can view cheques"
  ON "Cheques"
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Créer des politiques pour INSERT (anon et authenticated)
CREATE POLICY "Anyone can insert cheques"
  ON "Cheques"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Créer des politiques pour UPDATE (anon et authenticated)
CREATE POLICY "Anyone can update cheques"
  ON "Cheques"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Créer des politiques pour DELETE (anon et authenticated)
CREATE POLICY "Anyone can delete cheques"
  ON "Cheques"
  FOR DELETE
  TO anon, authenticated
  USING (true);
