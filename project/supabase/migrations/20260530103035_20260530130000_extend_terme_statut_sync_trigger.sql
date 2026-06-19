/*
  # Extend terme statut sync trigger to cover INSERT, UPDATE and DELETE on rapport

  ## Problem
  The existing trigger trg_sync_terme_statut only fired on INSERT into rapport.
  If a Terme payment row is updated (echeance or numero_contrat changes) or deleted,
  the corresponding terme table statut was never corrected.

  ## Fix
  Replace the trigger function and trigger to handle all three events:
  - INSERT  : set statut = 'payé' in the matching terme table
  - UPDATE  : mark new row as 'payé'; if the key changed, revert old row to
              'non payé' when no other rapport entry still covers it
  - DELETE  : revert to 'non payé' when no other rapport entry still covers it

  ## Tables affected
  - rapport (trigger source — INSERT/UPDATE/DELETE)
  - table_terme_<mois>_<year> (dynamic, updated automatically)
*/

CREATE OR REPLACE FUNCTION sync_terme_statut_on_rapport_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_name text;
  v_month_fr   text;
  v_month_num  int;
  v_year       text;
  v_has_other  bool;
BEGIN

  /* ---- helper: build table name from echeance ---- */
  /* (inlined twice below for NEW and OLD rows)       */

  -- ================================================================
  -- Handle NEW row (INSERT or UPDATE)
  -- ================================================================
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.type = 'Terme' AND NEW.echeance IS NOT NULL AND NEW.numero_contrat IS NOT NULL THEN
      v_month_num := EXTRACT(MONTH FROM NEW.echeance)::int;
      v_year      := EXTRACT(YEAR  FROM NEW.echeance)::text;
      v_month_fr  := CASE v_month_num
        WHEN 1  THEN 'janvier'   WHEN 2  THEN 'fevrier'
        WHEN 3  THEN 'mars'      WHEN 4  THEN 'avril'
        WHEN 5  THEN 'mai'       WHEN 6  THEN 'juin'
        WHEN 7  THEN 'juillet'   WHEN 8  THEN 'aout'
        WHEN 9  THEN 'septembre' WHEN 10 THEN 'octobre'
        WHEN 11 THEN 'novembre'  WHEN 12 THEN 'decembre'
        ELSE NULL
      END;
      IF v_month_fr IS NOT NULL THEN
        v_table_name := 'table_terme_' || v_month_fr || '_' || v_year;
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = v_table_name
        ) THEN
          EXECUTE format(
            'UPDATE %I SET statut = %L WHERE numero_contrat = %L AND echeance = %L AND statut != %L',
            v_table_name, 'payé', NEW.numero_contrat, NEW.echeance, 'payé'
          );
        END IF;
      END IF;
    END IF;
  END IF;

  -- ================================================================
  -- Handle OLD row (DELETE or UPDATE where key changed)
  -- ================================================================
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    IF OLD.type = 'Terme' AND OLD.echeance IS NOT NULL AND OLD.numero_contrat IS NOT NULL THEN
      -- On UPDATE, only revert old row if the key (contrat+echeance) actually changed
      IF TG_OP = 'UPDATE'
         AND OLD.numero_contrat = NEW.numero_contrat
         AND OLD.echeance = NEW.echeance THEN
        -- key unchanged: nothing to revert
      ELSE
        v_month_num := EXTRACT(MONTH FROM OLD.echeance)::int;
        v_year      := EXTRACT(YEAR  FROM OLD.echeance)::text;
        v_month_fr  := CASE v_month_num
          WHEN 1  THEN 'janvier'   WHEN 2  THEN 'fevrier'
          WHEN 3  THEN 'mars'      WHEN 4  THEN 'avril'
          WHEN 5  THEN 'mai'       WHEN 6  THEN 'juin'
          WHEN 7  THEN 'juillet'   WHEN 8  THEN 'aout'
          WHEN 9  THEN 'septembre' WHEN 10 THEN 'octobre'
          WHEN 11 THEN 'novembre'  WHEN 12 THEN 'decembre'
          ELSE NULL
        END;
        IF v_month_fr IS NOT NULL THEN
          v_table_name := 'table_terme_' || v_month_fr || '_' || v_year;
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = v_table_name
          ) THEN
            -- Revert only when no other Terme entry still covers this contract+echeance
            SELECT EXISTS (
              SELECT 1 FROM rapport
              WHERE numero_contrat = OLD.numero_contrat
                AND echeance = OLD.echeance
                AND type = 'Terme'
            ) INTO v_has_other;
            IF NOT v_has_other THEN
              EXECUTE format(
                'UPDATE %I SET statut = %L WHERE numero_contrat = %L AND echeance = %L AND statut != %L',
                v_table_name, 'non payé', OLD.numero_contrat, OLD.echeance, 'non payé'
              );
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Replace old INSERT-only trigger with full INSERT/UPDATE/DELETE trigger
DROP TRIGGER IF EXISTS trg_sync_terme_statut ON rapport;

CREATE TRIGGER trg_sync_terme_statut
AFTER INSERT OR UPDATE OR DELETE ON rapport
FOR EACH ROW
EXECUTE FUNCTION sync_terme_statut_on_rapport_change();
