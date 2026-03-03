/*
  # Supprimer le trigger updated_at de la table salaires_loyer
  
  1. Modifications
    - Supprimer le trigger `update_salaires_loyer_updated_at_trigger`
    - Supprimer la fonction associée si elle existe
  
  2. Raison
    - La table salaires_loyer n'a pas de colonne updated_at
    - Le trigger cause une erreur lors de l'insertion/mise à jour
*/

-- Supprimer le trigger
DROP TRIGGER IF EXISTS update_salaires_loyer_updated_at_trigger ON salaires_loyer;

-- Supprimer la fonction associée si elle existe
DROP FUNCTION IF EXISTS update_salaires_loyer_updated_at();
