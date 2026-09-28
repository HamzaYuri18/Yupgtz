/*
  # Add statut and date_paiement to prolongation

  1. Changes
    - Add `statut` (text, nullable) and `date_paiement` (date, nullable)
      to `prolongation`.
    - When a "Reprise sur Avance Client" dépense is saved, the app looks
      up the prolongation row matching (numero_contrat, date_echeance)
      and marks it statut = 'payée' with date_paiement = today, unless
      it's already marked payée.
    - Only Hamza can also edit these two fields manually from the
      "Liste des prolongations" screen.
*/

ALTER TABLE prolongation ADD COLUMN IF NOT EXISTS statut text;
ALTER TABLE prolongation ADD COLUMN IF NOT EXISTS date_paiement date;
