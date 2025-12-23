/*
  # Update create_terme_table function to include phone numbers

  1. Changes
    - Updates the `create_terme_table` function to include NUM_TEL and NUM_TEL_2 columns
    - These columns store phone numbers for contracts
    - Both columns are optional (nullable)
    
  2. New Columns
    - `num_tel` (text, nullable) - Primary phone number
    - `num_tel_2` (text, nullable) - Secondary phone number
*/

-- Update function to dynamically create terme tables with phone numbers
CREATE OR REPLACE FUNCTION create_terme_table(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Create the table
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id SERIAL PRIMARY KEY,
      numero_contrat TEXT NOT NULL,
      prime NUMERIC(10,2) NOT NULL DEFAULT 0,
      assure TEXT NOT NULL,
      echeance DATE NOT NULL,
      num_tel TEXT,
      num_tel_2 TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', table_name);

  -- Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

  -- Create policies
  EXECUTE format('DROP POLICY IF EXISTS "Allow read access" ON %I', table_name);
  EXECUTE format('
    CREATE POLICY "Allow read access" ON %I
    FOR SELECT TO public USING (true)', table_name);

  EXECUTE format('DROP POLICY IF EXISTS "Allow insert access" ON %I', table_name);
  EXECUTE format('
    CREATE POLICY "Allow insert access" ON %I
    FOR INSERT TO public WITH CHECK (true)', table_name);

  EXECUTE format('DROP POLICY IF EXISTS "Allow update access" ON %I', table_name);
  EXECUTE format('
    CREATE POLICY "Allow update access" ON %I
    FOR UPDATE TO public USING (true) WITH CHECK (true)', table_name);

  EXECUTE format('DROP POLICY IF EXISTS "Allow delete access" ON %I', table_name);
  EXECUTE format('
    CREATE POLICY "Allow delete access" ON %I
    FOR DELETE TO public USING (true)', table_name);

  RAISE NOTICE 'Table % created successfully', table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;