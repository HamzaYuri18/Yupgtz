/*
  # Correction des politiques RLS pour la table Cheques

  1. Modifications
    - Suppression de la politique d'insertion existante pour le rôle 'anon'
    - Ajout d'une politique d'insertion pour le rôle 'authenticated'
    - Ajout d'une politique de mise à jour pour le rôle 'authenticated'

  2. Sécurité
    - Permet aux utilisateurs authentifiés d'insérer des chèques
    - Permet aux utilisateurs authentifiés de mettre à jour des chèques
    - Les politiques de lecture et suppression restent inchangées
*/

-- Supprimer l'ancienne politique d'insertion
DROP POLICY IF EXISTS "Insert Cheque" ON "Cheques";

-- Créer une nouvelle politique d'insertion pour les utilisateurs authentifiés
CREATE POLICY "Users can insert cheques"
  ON "Cheques"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ajouter une politique de mise à jour pour les utilisateurs authentifiés
CREATE POLICY "Users can update cheques"
  ON "Cheques"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
