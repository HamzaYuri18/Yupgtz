/*
  # Fix create_terme_table function with all required columns
  
  1. Changes
    - Update create_terme_table to include all required columns
    - Add remarque, date_remarque, and user_remarque columns
    - Ensure consistency with existing table structure
  
  2. Columns
    - id (bigserial, primary key)
    - numero_contrat (text, required)
    - assure (text, required)
    - prime (numeric, required)
    - echeance (date, required)
    - num_tel (text, optional)
    - num_tel_2 (text, optional)
    - statut (text, default 'non payé')
    - remarque (text, optional)
    - date_remarque (timestamptz, optional)
    - user_remarque (text, optional)
    - created_at (timestamptz, default now())
  
  3. Security
    - Function uses SECURITY DEFINER for elevated privileges
    - RLS enabled on all tables
    - Public access policies for authenticated and anonymous users
*/

-- Recreate the function with all columns
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

  -- Create policy for anonymous users to write
  EXECUTE format('
    DROP POLICY IF EXISTS "Allow anonymous write access" ON %I;
    CREATE POLICY "Allow anonymous write access" 
    ON %I 
    FOR INSERT 
    TO anon 
    WITH CHECK (true)
  ', full_table_name, full_table_name);

  RAISE NOTICE 'Table % created successfully with all columns', full_table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;