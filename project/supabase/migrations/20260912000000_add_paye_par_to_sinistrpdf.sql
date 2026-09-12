/*
  # Add "Payé par" column to SinistrPDF

  1. Changes
    - `SinistrPDF."Payé par"` (text, nullable) - Nom de l'utilisateur (session
      applicative, voir src/utils/auth.ts) ayant marqué le sinistre comme payé.
      Renseigné automatiquement lors de l'enregistrement du paiement dans
      "Gestion Financière" > Sinistres.
*/

ALTER TABLE "SinistrPDF" ADD COLUMN IF NOT EXISTS "Payé par" text;
