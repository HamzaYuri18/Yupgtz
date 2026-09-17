/*
  # Add delete policy to smsing

  1. Changes
    - Allow authenticated and anon users to delete rows from `smsing`.
      Deletion itself is restricted to Hamza at the application level
      (see SMSingHistory.tsx), consistent with how other Hamza-only
      actions are enforced in this app (no per-user Supabase Auth).
*/

CREATE POLICY "Allow authenticated users to delete SMS history"
  ON smsing
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anonymous users to delete SMS history"
  ON smsing
  FOR DELETE
  TO anon
  USING (true);
