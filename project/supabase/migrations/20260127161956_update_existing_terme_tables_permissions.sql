/*
  # Update permissions for existing terme tables
  
  1. Changes
    - Add full permissions for anonymous users to all existing table_terme_* tables
    - This ensures existing tables have the same permissions as newly created ones
  
  2. Security
    - Anonymous users need full access for the application to work
    - All operations are allowed through RLS policies
*/

DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'table_terme_%'
  LOOP
    -- Drop old policies if they exist
    EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous all" ON %I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access" ON %I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous read access" ON %I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous write access" ON %I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous insert" ON %I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous update" ON %I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous delete" ON %I', table_record.tablename);

    -- Create policy for authenticated users
    EXECUTE format('
      CREATE POLICY "Allow authenticated access" 
      ON %I 
      FOR ALL 
      TO authenticated 
      USING (true) 
      WITH CHECK (true)
    ', table_record.tablename);

    -- Create policy for anonymous users (full access)
    EXECUTE format('
      CREATE POLICY "Allow anonymous all" 
      ON %I 
      FOR ALL 
      TO anon 
      USING (true) 
      WITH CHECK (true)
    ', table_record.tablename);

    RAISE NOTICE 'Updated permissions for table %', table_record.tablename;
  END LOOP;
END $$;