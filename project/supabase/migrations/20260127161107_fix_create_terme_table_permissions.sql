/*
  # Fix create_terme_table function permissions
  
  1. Changes
    - Add SECURITY DEFINER to create_terme_table function
    - This allows the function to execute with elevated privileges
    - Necessary for creating tables and policies dynamically
  
  2. Security
    - The function is safe because it only creates terme tables with a specific structure
    - Table names are sanitized using format(%I) which prevents SQL injection
*/

-- Recreate the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_terme_table(table_suffix text)
RETURNS void AS $$
DECLARE
  full_table_name text := 'table_terme_' || table_suffix;
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id BIGSERIAL PRIMARY KEY,
      numero_contrat TEXT NOT NULL,
      assure TEXT NOT NULL,
      prime NUMERIC NOT NULL,
      echeance DATE NOT NULL,
      num_tel TEXT,
      num_tel_2 TEXT,
      statut TEXT DEFAULT ''non payé'',
      created_at TIMESTAMPTZ DEFAULT now()
    )', full_table_name);

  -- Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', full_table_name);

  -- Create policy for authenticated users
  EXECUTE format('
    DROP POLICY IF EXISTS "Allow authenticated access" ON %I;
    CREATE POLICY "Allow authenticated access" 
    ON %I 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true)
  ', full_table_name, full_table_name);

  -- Create policy for anonymous users
  EXECUTE format('
    DROP POLICY IF EXISTS "Allow anonymous read access" ON %I;
    CREATE POLICY "Allow anonymous read access" 
    ON %I 
    FOR SELECT 
    TO anon 
    USING (true)
  ', full_table_name, full_table_name);

  RAISE NOTICE 'Table % created successfully with statut column', full_table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;