/*
  # Add statut column to smsing table

  Ajoute une colonne statut à la table smsing pour tracker l'état de l'envoi des SMS
  (Envoyé ou Non envoyé)
*/

ALTER TABLE smsing
ADD COLUMN IF NOT EXISTS statut text DEFAULT 'Envoyé' CHECK (statut IN ('Envoyé', 'Non envoyé'));
