/*
  # Track rapport modifications to expire conformity keys

  ## Purpose
  When a conformity key is assigned to a session date in `keysconformity`,
  any subsequent modification (INSERT, UPDATE, or DELETE) to the `rapport` table
  for that same session date should expire the key. The user must then request
  a new key before generating the Fiche de Caisse (FC).

  ## Changes

  ### 1. New column on `keysconformity`
  - `rapport_modified_at` (timestamptz, nullable): timestamp of the last
    rapport modification that occurred AFTER the key was created. If this
    value is later than `created_at`, the key is considered expired.

  ### 2. Trigger function `track_rapport_modification_for_keysconformity`
  - Fires AFTER INSERT, UPDATE, or DELETE on the `rapport` table.
  - Extracts the session date from the affected row's `date_operation` column
    (or `date_depense` / `date_recette` / `date_ristourne` / `date_sinistre`
    depending on the operation type) and converts it to DD/MM/YYYY format
    to match `keysconformity.date_input`.
  - Updates `keysconformity.rapport_modified_at = now()` for all matching rows
    where `rapport_modified_at IS NULL` or `rapport_modified_at < now()`.

  ### 3. Trigger `trg_track_rapport_modification`
  - AFTER INSERT OR UPDATE OR DELETE on `rapport`
  - Calls the trigger function above.

  ## Security
  - No RLS policy changes — existing policies on `keysconformity` remain intact.
  - The trigger runs with SECURITY DEFINER so it can update `keysconformity`
    regardless of the caller's role.

  ## Important Notes
  1. The trigger uses `date_operation` as the primary session date field.
     For rows where `date_operation` is NULL, it falls back to other date columns.
  2. The `date_input` format in `keysconformity` is DD/MM/YYYY (text), so the
     trigger converts the date accordingly.
  3. Only keys where `created_at < now()` (i.e. already-created keys) are
     affected — new keys inserted after the modification will have
     `created_at >= rapport_modified_at` and remain valid.
*/

-- 1. Add rapport_modified_at column to keysconformity
ALTER TABLE keysconformity
  ADD COLUMN IF NOT EXISTS rapport_modified_at timestamptz;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION track_rapport_modification_for_keysconformity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_date text;
  v_raw_date date;
BEGIN
  -- Determine the session date from the affected row
  -- For INSERT/UPDATE: use NEW record; for DELETE: use OLD record
  IF (TG_OP = 'DELETE') THEN
    v_raw_date := COALESCE(
      OLD.date_operation,
      OLD.date_depense,
      OLD.date_recette,
      OLD.date_ristourne,
      OLD.date_sinistre,
      OLD.date_paiement_prevue
    );
  ELSE
    v_raw_date := COALESCE(
      NEW.date_operation,
      NEW.date_depense,
      NEW.date_recette,
      NEW.date_ristourne,
      NEW.date_sinistre,
      NEW.date_paiement_prevue
    );
  END IF;

  -- If no date found, skip
  IF v_raw_date IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Convert date to DD/MM/YYYY text format matching keysconformity.date_input
  v_session_date := to_char(v_raw_date, 'DD/MM/YYYY');

  -- Update all keysconformity rows for this session date
  -- Only update if the key was created before now (so the key is "active")
  -- and set rapport_modified_at to now() so it's later than created_at
  UPDATE keysconformity
    SET rapport_modified_at = now()
    WHERE date_input = v_session_date
      AND created_at < now()
      AND (rapport_modified_at IS NULL OR rapport_modified_at < now());

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Create the trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_track_rapport_modification ON rapport;
CREATE TRIGGER trg_track_rapport_modification
  AFTER INSERT OR UPDATE OR DELETE ON rapport
  FOR EACH ROW
  EXECUTE FUNCTION track_rapport_modification_for_keysconformity();
