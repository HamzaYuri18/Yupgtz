/*
  # Ajouter les politiques de suppression manquantes

  1. Modifications
    - Ajouter une politique DELETE pour la table Avenant_Changement_véhicule
    - Ajouter une politique DELETE pour la table encaissement_autre_code
  
  2. Sécurité
    - Permettre la suppression publique (anonymous) pour ces tables
    - Cohérent avec les autres politiques existantes
*/

-- Ajouter politique DELETE pour Avenant_Changement_véhicule
CREATE POLICY "Allow public delete to Avenant_Changement_véhicule"
  ON "Avenant_Changement_véhicule"
  FOR DELETE
  TO anon
  USING (true);

-- Ajouter politique DELETE pour encaissement_autre_code
CREATE POLICY "Allow public delete to encaissement_autre_code"
  ON encaissement_autre_code
  FOR DELETE
  TO anon
  USING (true);
