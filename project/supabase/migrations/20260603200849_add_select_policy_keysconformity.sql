/*
  # Add SELECT policy to keysconformity

  Currently only INSERT is allowed for anon users, so reads return nothing.
  This adds a SELECT policy so the frontend can verify the clôture key.
*/

CREATE POLICY "allow_select_anon"
  ON keysconformity
  FOR SELECT
  TO anon
  USING (true);
