-- 1. Backfill echeancev from created_at for all rows where it is NULL
UPDATE liste_credits
  SET echeancev = (created_at AT TIME ZONE 'UTC')::date
  WHERE echeancev IS NULL AND created_at IS NOT NULL;

-- 2. Remove duplicate credits: same numero_contrat + echeancev, keeping the
--    oldest row (smallest id) in each group. Only touches groups with > 1 row.
DELETE FROM liste_credits
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY numero_contrat, echeancev
               ORDER BY id ASC
             ) AS rn
      FROM liste_credits
      WHERE echeancev IS NOT NULL
    ) t
    WHERE t.rn > 1
  );

-- 3. Safety: add a UNIQUE constraint to prevent future duplicates on
--    (numero_contrat, echeancev). Allow NULL echeancev pairs to coexist
--    (NULL != NULL in SQL), so use a partial index that only applies when
--    echeancev IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS liste_credits_num_echeancev_uniq
  ON liste_credits (numero_contrat, echeancev)
  WHERE echeancev IS NOT NULL;
