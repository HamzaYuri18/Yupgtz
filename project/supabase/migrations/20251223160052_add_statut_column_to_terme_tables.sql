/*
  # Add Statut Column to Terme Tables
  
  1. Changes
    - Add 'statut' column to all existing terme tables with default value 'non payé'
    - Update the create_terme_table function to include the statut column
  
  2. Details
    - Column type: TEXT
    - Default value: 'non payé'
    - Possible values: 'non payé', 'payé'
    - This allows tracking payment status for each terme contract
*/

-- Function to add statut column to all existing terme tables
DO $$
DECLARE
  terme_table_name TEXT;
BEGIN
  FOR terme_table_name IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename LIKE 'table_terme_%'
  LOOP
    -- Check if column doesn't exist before adding
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = terme_table_name 
      AND column_name = 'statut'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN statut TEXT DEFAULT ''non payé''', terme_table_name);
      RAISE NOTICE 'Added statut column to %', terme_table_name;
    END IF;
  END LOOP;
END $$;

-- Drop and recreate the create_terme_table function to include statut column
DROP FUNCTION IF EXISTS create_terme_table(text);

CREATE FUNCTION create_terme_table(table_suffix text)
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
$$ LANGUAGE plpgsql;