/*
# Fix Terme Statut Sync — Case-Insensitive Matching

## Problem
The trigger `sync_terme_statut_on_rapport_insert` used case-sensitive comparison
(`numero_contrat = %L`) to update the `statut` column in monthly `table_terme_*` tables.
When a rapport entry had a lowercase contract number (e.g. `ci0554n00185333`) but the
monthly table had uppercase (`CI0554N00185333`), the trigger never matched and the
statut stayed "non payé" even though the terme was actually paid.

## Changes
1. Normalize all existing lowercase contract numbers in `rapport` to uppercase.
2. Fix all monthly `table_terme_*` tables: for any row whose `numero_contrat + echeance`
   matches a paid "Terme" entry in `rapport`, set `statut = 'payé'`.
3. Replace the trigger function `sync_terme_statut_on_rapport_insert` with a
   case-insensitive version that uses `LOWER()` comparison.
4. Also replace `sync_terme_statut_on_rapport_change` with case-insensitive version.

## Important Notes
- No data is deleted or lost — only `statut` columns are corrected and
  `numero_contrat` values are uppercased.
- The trigger now uses `LOWER(r.numero_contrat) = LOWER(...)` so case differences
  never cause a miss again.
*/

-- Step 1: Normalize lowercase contract numbers in rapport to uppercase
UPDATE rapport
SET numero_contrat = UPPER(numero_contrat)
WHERE numero_contrat != UPPER(numero_contrat);

-- Step 2: Fix all monthly table_terme_* tables — set statut to 'payé' for contracts
-- that have a matching "Terme" entry in rapport (case-insensitive, by echeance)
DO $$
DECLARE
    tbl record;
    update_count int;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE 'table\_terme\_%'
          AND table_name NOT LIKE '%\_paye'
    LOOP
        EXECUTE format(
            'UPDATE %I SET statut = ''payé''
             WHERE statut != ''payé''
               AND EXISTS (
                   SELECT 1 FROM rapport r
                   WHERE LOWER(r.numero_contrat) = LOWER(%I.numero_contrat)
                     AND r.echeance = %I.echeance
                     AND r.type = ''Terme''
               )',
            tbl.table_name, tbl.table_name, tbl.table_name
        );
        GET DIAGNOSTICS update_count = ROW_COUNT;
        IF update_count > 0 THEN
            RAISE NOTICE 'Fixed % rows in %', update_count, tbl.table_name;
        END IF;
    END LOOP;
END $$;

-- Step 3: Replace the trigger function with a case-insensitive version
CREATE OR REPLACE FUNCTION public.sync_terme_statut_on_rapport_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
             WHERE LOWER(numero_contrat) = LOWER(%L)
               AND echeance = %L
               AND statut = ''payé''
               AND NOT EXISTS (
                   SELECT 1 FROM rapport r2
                   WHERE LOWER(r2.numero_contrat) = LOWER(%L)
                     AND r2.echeance = %L
                     AND r2.type = ''Terme''
               )',
            v_table_name,
            v_contract, v_echeance,
            v_contract, v_echeance
        );
    ELSE
        EXECUTE format(
            'UPDATE %I SET statut = ''payé''
             WHERE LOWER(numero_contrat) = LOWER(%L)
               AND echeance = %L
               AND statut != ''payé''',
            v_table_name,
            v_contract, v_echeance
        );
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- Step 4: Also fix the other trigger function to be case-insensitive
CREATE OR REPLACE FUNCTION public.sync_terme_statut_on_rapport_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_table_name text;
    v_month_fr   text;
    v_month_num  int;
    v_year       text;
    v_has_other  bool;
BEGIN
    -- Handle NEW row (INSERT or UPDATE)
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
                        'UPDATE %I SET statut = %L
                         WHERE LOWER(numero_contrat) = LOWER(%L)
                           AND echeance = %L
                           AND statut != %L',
                        v_table_name, 'payé', NEW.numero_contrat, NEW.echeance, 'payé'
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    -- Handle OLD row (DELETE or UPDATE where key changed)
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        IF OLD.type = 'Terme' AND OLD.echeance IS NOT NULL AND OLD.numero_contrat IS NOT NULL THEN
            IF TG_OP = 'UPDATE'
               AND LOWER(OLD.numero_contrat) = LOWER(NEW.numero_contrat)
               AND OLD.echeance = NEW.echeance THEN
                -- key unchanged: nothing to revert
                NULL;
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
                        SELECT EXISTS (
                            SELECT 1 FROM rapport
                            WHERE LOWER(numero_contrat) = LOWER(OLD.numero_contrat)
                              AND echeance = OLD.echeance
                              AND type = 'Terme'
                        ) INTO v_has_other;
                        IF NOT v_has_other THEN
                            EXECUTE format(
                                'UPDATE %I SET statut = %L
                                 WHERE LOWER(numero_contrat) = LOWER(%L)
                                   AND echeance = %L
                                   AND statut != %L',
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
$function$;
