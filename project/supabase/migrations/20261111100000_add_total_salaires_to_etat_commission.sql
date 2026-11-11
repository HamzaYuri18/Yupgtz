/*
  # Ajout de total_salaires a etat_commission

  1. Changes
    - `etat_commission.total_salaires` (numeric) : somme des salaires
      (salaires_loyer.montant_salaires) dont la date_liquidation_salaires
      tombe dans la quinzaine. Deduit de la commission nette au meme
      titre que les charges et les depenses.
*/

ALTER TABLE etat_commission ADD COLUMN IF NOT EXISTS total_salaires numeric(10,3) DEFAULT 0;
