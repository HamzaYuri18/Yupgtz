/*
  # Fix anonymous permissions for terme tables
  
  1. Changes
    - Grant full permissions to anonymous users on terme tables
    - This allows the XLSX upload to work with ANON key
  
  2. Security
    - Anonymous users can read, insert, update, and delete
    - This is needed for the application to function with the ANON key
*/

-- Update the create_terme_table function with complete anonymous permissions
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
      remarque TEXT,
      date_remarque TIMESTAMPTZ,
      user_remarque TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )', full_table_name);

  -- Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', full_table_name);

  -- Drop existing policies
  EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access" ON %I', full_table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous read access" ON %I', full_table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous write access" ON %I', full_table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous insert" ON %I', full_table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous update" ON %I', full_table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous delete" ON %I', full_table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous all" ON %I', full_table_name);

  -- Create policy for authenticated users (full access)
  EXECUTE format('
    CREATE POLICY "Allow authenticated access" 
    ON %I 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true)
  ', full_table_name);

  -- Create policy for anonymous users (full access)
  EXECUTE format('
    CREATE POLICY "Allow anonymous all" 
    ON %I 
    FOR ALL 
    TO anon 
    USING (true) 
    WITH CHECK (true)
  ', full_table_name);

  RAISE NOTICE 'Table % created successfully with complete permissions', full_table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;