/*
  # Add reportingtache column to taches

  1. Changes
    - Add `reportingtache` (text, nullable) to `taches`: the mandatory
      reporting a user must write when marking a task as "Accomplie",
      so it's kept alongside the task for later review.
*/

ALTER TABLE taches ADD COLUMN IF NOT EXISTS reportingtache text;
