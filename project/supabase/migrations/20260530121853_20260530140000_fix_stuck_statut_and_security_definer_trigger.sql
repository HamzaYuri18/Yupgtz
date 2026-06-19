/*
  # Fix stuck statut in all terme tables and improve trigger security

  ## Problem
  1. 45 contracts in table_terme_mai_2026 remain stuck at 'non payé' despite having
     matching entries in rapport (type='Terme', same numero_contrat + echeance).
     Previous migrations did not resolve these.

  2. The trigger function sync_terme_statut_on_rapport_insert executes with the
     calling user's privileges. If RLS or permission issues prevent the UPDATE,
     the trigger silently fails.

  ## Fix
  1. Directly update all stuck records across ALL existing terme tables using
     rapport as the source of truth.

  2. Recreate the trigger function with SECURITY DEFINER so it always runs with
     the owner's privileges, bypassing RLS on the dynamic terme tables.

  ## Tables affected
  - table_terme_mai_2026 (and any other table_terme_* tables that exist)
  - rapport (trigger updated)
*/

-- ============================================================
-- PART 1: Fix all stuck records across all terme tables
-- ============================================================

DO $$
DECLARE
  v_table text;
  v_count int;
BEGIN
  FOR v_table IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'table_terme_%'
  LOOP
    EXECUTE format(
      'UPDATE %I t SET statut = ''payé''
       WHERE t.statut = ''non payé''
         AND EXISTS (
           SELECT 1 FROM rapport r
           WHERE r.numero_contrat = t.numero_contrat
             AND r.echeance = t.echeance
             AND r.type = ''Terme''
         )',
      v_table
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE 'Fixed % stuck records in %', v_count, v_table;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- PART 2: Recreate trigger function with SECURITY DEFINER
-- so it bypasses RLS and always has permission to update terme tables
-- ============================================================

CREATE OR REPLACE FUNCTION sync_terme_statut_on_rapport_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_name text;
  v_month_fr   text;
  v_year       text;
  v_month_num  int;
  v_contract   text;
  v_echeance   date;
BEGIN
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
    EXECUTE format(
      'UPDATE %I SET statut = ''non payé''
       WHERE numero_contrat = %L AND echeance = %L AND statut = ''payé''
         AND NOT EXISTS (
           SELECT 1 FROM rapport r2
           WHERE r2.numero_contrat = %L AND r2.echeance = %L AND r2.type = ''Terme''
         )',
      v_table_name,
      v_contract,
      v_echeance,
      v_contract,
      v_echeance
    );
  ELSE
    EXECUTE format(
      'UPDATE %I SET statut = ''payé''
       WHERE numero_contrat = %L AND echeance = %L AND statut != ''payé''',
      v_table_name,
      v_contract,
      v_echeance
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Recreate the trigger (keep same name, same events)
DROP TRIGGER IF EXISTS trg_sync_terme_statut ON rapport;

CREATE TRIGGER trg_sync_terme_statut
AFTER INSERT OR UPDATE OR DELETE ON rapport
FOR EACH ROW
EXECUTE FUNCTION sync_terme_statut_on_rapport_insert();
