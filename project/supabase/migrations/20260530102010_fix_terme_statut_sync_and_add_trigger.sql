/*
  # Fix terme statut sync: correct 44 stuck records + add auto-sync trigger

  ## Problem
  When a "Terme" payment is recorded in the `rapport` table, the corresponding
  row in `table_terme_mai_2026` (matched by numero_contrat + echeance) was never
  updated to "payé". The two tables were completely disconnected.

  44 contracts are currently showing "non payé" in table_terme_mai_2026 despite
  having a matching paid entry in rapport (type=Terme, date_operation 01-30/05/2026).

  ## Fix Part 1: Correct existing stuck records
  Update all 44 rows in table_terme_mai_2026 where a matching rapport entry exists.

  ## Fix Part 2: Auto-sync trigger
  Create a trigger on rapport that fires after INSERT and automatically sets
  statut = 'payé' in the corresponding terme table (matched dynamically by
  echeance month/year to find the right table name).

  ## Tables affected
  - table_terme_mai_2026 (direct fix + indirect via trigger)
  - rapport (trigger source)
*/

-- ============================================================
-- PART 1: Fix existing 44 stuck records in table_terme_mai_2026
-- ============================================================

UPDATE table_terme_mai_2026 t
SET statut = 'payé'
WHERE t.statut = 'non payé'
  AND EXISTS (
    SELECT 1 FROM rapport r
    WHERE r.numero_contrat = t.numero_contrat
      AND r.echeance = t.echeance
      AND r.type = 'Terme'
      AND r.date_operation >= '2026-05-01'
      AND r.date_operation <= '2026-05-30'
  );

-- ============================================================
-- PART 2: Create auto-sync trigger function
-- Fires after every INSERT on rapport where type = 'Terme'
-- Finds the correct terme table based on echeance month/year
-- and updates the statut to 'payé'
-- ============================================================

CREATE OR REPLACE FUNCTION sync_terme_statut_on_rapport_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_name text;
  v_month_fr   text;
  v_year       text;
  v_month_num  int;
BEGIN
  -- Only process Terme type entries
  IF NEW.type != 'Terme' OR NEW.echeance IS NULL OR NEW.numero_contrat IS NULL THEN
    RETURN NEW;
  END IF;

  v_month_num := EXTRACT(MONTH FROM NEW.echeance)::int;
  v_year      := EXTRACT(YEAR  FROM NEW.echeance)::text;

  -- Map month number to French name used in table naming
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
    RETURN NEW;
  END IF;

  v_table_name := 'table_terme_' || v_month_fr || '_' || v_year;

  -- Check the table exists before attempting update
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = v_table_name
  ) THEN
    RETURN NEW;
  END IF;

  -- Update statut to payé where numero_contrat + echeance match
  EXECUTE format(
    'UPDATE %I SET statut = %L WHERE numero_contrat = %L AND echeance = %L AND statut != %L',
    v_table_name,
    'payé',
    NEW.numero_contrat,
    NEW.echeance,
    'payé'
  );

  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists to allow clean re-creation
DROP TRIGGER IF EXISTS trg_sync_terme_statut ON rapport;

CREATE TRIGGER trg_sync_terme_statut
AFTER INSERT ON rapport
FOR EACH ROW
EXECUTE FUNCTION sync_terme_statut_on_rapport_insert();
