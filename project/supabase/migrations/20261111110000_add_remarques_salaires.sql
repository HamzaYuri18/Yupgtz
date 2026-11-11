/*
  # Ajout de remarques_salaires a salaires_loyer

  1. Changes
    - `salaires_loyer.remarques_salaires` (text, nullable) : note libre
      saisie par l'utilisateur dans le tableau "Salaires et Loyer",
      affichee aussi dans le detail des salaires de la rubrique Etat des
      Commissions (clic sur la colonne Salaires).
*/

ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS remarques_salaires text;
