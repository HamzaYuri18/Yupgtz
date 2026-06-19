/*
  # Create dynamic table function for monthly terme tables

  1. Function
    - `create_terme_table(table_name TEXT)` - Creates a new terme table dynamically
      - Creates table with columns: id, numero_contrat, prime, assure, echeance, created_at
      - Enables RLS
      - Creates public access policies
*/

-- Create function to dynamically create terme tables
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
