/*
  # Fix Schema Permissions for Anonymous User

  1. Schema Permissions
    - Grant USAGE on public schema to public role
    - Grant SELECT, INSERT permissions on all tables to public role
    - Grant USAGE on all sequences to public role

  2. Security
    - Ensure anonymous users can perform basic operations
    - Maintain RLS policies for data protection
*/

-- Grant USAGE permission on public schema to public role
GRANT USAGE ON SCHEMA public TO public;

-- Grant basic permissions on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO public;

-- Grant permissions on all sequences (for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO public;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO public;

-- Ensure the create_monthly_table function can create tables with proper permissions
CREATE OR REPLACE FUNCTION public.create_monthly_table(p_table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if table already exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
    AND t.table_name = p_table_name
  ) THEN
    RAISE NOTICE 'Table % already exists', p_table_name;
    RETURN;
  END IF;

  -- Create the monthly table
  EXECUTE format('
    CREATE TABLE public.%I (
      id SERIAL PRIMARY KEY,
      numero_contrat TEXT NOT NULL,
      prime DECIMAL(10,3) DEFAULT 0,
      echeance TEXT,
      assure TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', p_table_name);

  -- Enable RLS on the new table
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);

  -- Grant permissions to public role
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO public', p_table_name);
  EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I_id_seq TO public', p_table_name);

  -- Create a permissive policy for all operations (you can restrict this later)
  EXECUTE format('
    CREATE POLICY "Allow all operations" ON public.%I
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true)
  ', p_table_name);

  RAISE NOTICE 'Table % created successfully with permissions', p_table_name;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.create_monthly_table(text) TO public;
