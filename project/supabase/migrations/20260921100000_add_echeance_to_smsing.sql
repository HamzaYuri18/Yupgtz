/*
  # Add echeance column to smsing

  1. Changes
    - Add `echeance` (date, nullable) to `smsing`: the due date of the
      term the SMS was sent about. Needed to look up how many SMS were
      sent for a specific (numero_contrat, echeance) term — the same
      contract number can have several different échéances (one per
      month), each tracked separately.
    - Index on (numero_contrat, echeance) for that lookup.
*/

ALTER TABLE smsing ADD COLUMN IF NOT EXISTS echeance date;

CREATE INDEX IF NOT EXISTS idx_smsing_numero_contrat_echeance ON smsing(numero_contrat, echeance);
