/*
  # Fix terme statut sync using rapport as source of truth

  ## Problem
  table_terme_mai_2026 has 45 contracts showing statut='non payé' despite having
  a matching payment entry in the rapport table (type='Terme'). The previous
  trigger-based approach didn't retroactively fix pre-existing rapport entries.

  Also fixes the verify function logic: the frontend was reading from the `terme`
  table (a different table used for other purposes) instead of `rapport` to determine
  paid status. This caused paid contracts to be reset to 'non payé' on every page load.

  ## Fix Part 1: Correct all stuck records in table_terme_mai_2026
  Update any row in table_terme_mai_2026 that has a matching paid entry in rapport.

  ## Fix Part 2: Update the trigger to also handle DELETE on rapport
  If a rapport entry of type Terme is deleted, the corresponding terme table row
  should be reverted to 'non payé' (unless another rapport entry still covers it).

  ## Tables affected
  - table_terme_mai_2026 (direct fix)
  - rapport (trigger update)
*/

-- Fix all stuck non-payé records in table_terme_mai_2026
UPDATE table_terme_mai_2026 t
SET statut = 'payé'
WHERE t.statut = 'non payé'
  AND EXISTS (
    SELECT 1 FROM rapport r
    WHERE r.numero_contrat = t.numero_contrat
      AND r.echeance = t.echeance
      AND r.type = 'Terme'
  );

-- Also revert any 'payé' records that have no matching rapport entry
-- (safety: don't mark as paid if rapport entry was deleted)
UPDATE table_terme_mai_2026 t
SET statut = 'non payé'
WHERE t.statut = 'payé'
  AND NOT EXISTS (
    SELECT 1 FROM rapport r
    WHERE r.numero_contrat = t.numero_contrat
      AND r.echeance = t.echeance
      AND r.type = 'Terme'
  );

-- Update the sync trigger function to also handle DELETE on rapport
CREATE OR REPLACE FUNCTION sync_terme_statut_on_rapport_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_name text;
  v_month_fr   text;
  v_year       text;
  v_month_num  int;
  v_contract   text;
  v_echeance   date;
BEGIN
  -- Determine which record to act on (NEW for INSERT/UPDATE, OLD for DELETE)
  IF TG_OP = 'DELETE' THEN
    v_contract := OLD.numero_contrat;
    v_echeance := OLD.echeance;
    IF OLD.type != 'Terme' OR OLD.echeance IS NULL OR OLD.numero_contrat IS NULL THEN
      RETURN OLD;
    END IF;
  ELSE
    v_contract := NEW.numero_contrat;
    v_echeance := NEW.echeance;
    IF NEW.type != 'Terme' OR NEW.echeance IS NULL OR NEW.numero_contrat IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  v_month_num := EXTRACT(MONTH FROM v_echeance)::int;
  v_year      := EXTRACT(YEAR  FROM v_echeance)::text;

  v_month_fr := CASE v_month_num
    WHEN 1  THEN 'janvier'
    WHEN 2  THEN 'fevrier'
    WHEN 3  THEN 'mars'
    WHEN 4  THEN 'avril'
    WHEN 5  THEN 'mai'
    WHEN 6  THEN 'juin'
    WHEN 7  THEN 'juillet'
    WHEN 8  THEN 'aout'
    WHEN 9  THEN 'septembre'
    WHEN 10 THEN 'octobre'
    WHEN 11 THEN 'novembre'
    WHEN 12 THEN 'decembre'
    ELSE NULL
  END;

  IF v_month_fr IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  v_table_name := 'table_terme_' || v_month_fr || '_' || v_year;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = v_table_name
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Only revert to non payé if no other rapport entry covers this contract+echeance
    EXECUTE format(
      'UPDATE %I SET statut = %L
       WHERE numero_contrat = %L AND echeance = %L AND statut = %L
         AND NOT EXISTS (
           SELECT 1 FROM rapport r2
           WHERE r2.numero_contrat = %L AND r2.echeance = %L AND r2.type = %L
         )',
      v_table_name,
      'non payé',
      v_contract,
      v_echeance,
      'payé',
      v_contract,
      v_echeance,
      'Terme'
    );
  ELSE
    EXECUTE format(
      'UPDATE %I SET statut = %L WHERE numero_contrat = %L AND echeance = %L AND statut != %L',
      v_table_name,
      'payé',
      v_contract,
      v_echeance,
      'payé'
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Recreate trigger to also handle DELETE
DROP TRIGGER IF EXISTS trg_sync_terme_statut ON rapport;

CREATE TRIGGER trg_sync_terme_statut
AFTER INSERT OR UPDATE OR DELETE ON rapport
FOR EACH ROW
EXECUTE FUNCTION sync_terme_statut_on_rapport_insert();
