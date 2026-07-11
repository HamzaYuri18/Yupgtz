/*
# Add echeanceV column to liste_credits

1. New Columns
- `echeanceV` (date) on `liste_credits`: stores the created_at value converted
  to a date in YYYY-MM-DD format. This column is used to match credits between
  `rapport` (using date_operation) and `liste_credits` (using echeanceV).

2. Data Backfill
- Populate echeanceV for all existing rows from created_at::date.

3. Notes
- The column is nullable to avoid issues with rows that may have NULL created_at.
- No RLS policy changes needed; the table already has policies.
*/

ALTER TABLE liste_credits
  ADD COLUMN IF NOT EXISTS echeanceV date;

UPDATE liste_credits
  SET echeanceV = (created_at AT TIME ZONE 'UTC')::date
  WHERE echeanceV IS NULL AND created_at IS NOT NULL;
