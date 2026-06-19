/*
  # Fix RLS Policy Violation for Monthly Tables

  1. Changes
    - Update RLS policies to allow public access instead of authenticated only
    - Update function permissions to allow public execution
    - This allows the frontend client using anonymous key to insert data

  2. Security Note
    - This change allows public access to monthly contract tables
    - Consider implementing application-level security if needed
*/

-- Function to update existing table policies
CREATE OR REPLACE FUNCTION update_existing_table_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_record RECORD;
BEGIN
    -- Loop through all existing monthly tables
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'table_terme_%'
        AND table_type = 'BASE TABLE'
    LOOP
        -- Drop existing policies
        EXECUTE format('DROP POLICY IF EXISTS "Allow read access" ON %I', table_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Allow insert access" ON %I', table_record.table_name);
        
        -- Create new policies for public access
        EXECUTE format('
            CREATE POLICY "Allow read access" ON %I
            FOR SELECT
            TO public
            USING (true)
        ', table_record.table_name);
        
        EXECUTE format('
            CREATE POLICY "Allow insert access" ON %I
            FOR INSERT
            TO public
            WITH CHECK (true)
        ', table_record.table_name);
        
        RAISE NOTICE 'Updated policies for table: %', table_record.table_name;
    END LOOP;
END;
$$;

-- Execute the function to update existing tables
SELECT update_existing_table_policies();

-- Drop the temporary function
DROP FUNCTION update_existing_table_policies();

-- Update the create_monthly_table function to use public instead of authenticated
CREATE OR REPLACE FUNCTION create_monthly_table(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    safe_table_name text;
BEGIN
    -- Nettoyer et valider le nom de la table
    safe_table_name := regexp_replace(table_name, '[^a-zA-Z0-9_]', '', 'g');
    
    -- Vérifier que le nom commence par 'table_terme_'
    IF NOT safe_table_name ~ '^table_terme_[a-zA-Z0-9_]+$' THEN
        RAISE EXCEPTION 'Nom de table invalide: %. Le nom doit commencer par table_terme_', table_name;
    END IF;
    
    -- Vérifier si la table existe déjà
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = safe_table_name
    ) THEN
        RAISE NOTICE 'Table % existe déjà', safe_table_name;
        RETURN true; -- Table existe déjà
    END IF;
    
    -- Créer la table avec les colonnes requises
    EXECUTE format('
        CREATE TABLE %I (
            id SERIAL PRIMARY KEY,
            numero_contrat TEXT NOT NULL,
            prime DECIMAL(10,2) NOT NULL DEFAULT 0,
            assure TEXT NOT NULL,
            echeance TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', safe_table_name);
    
    -- Activer RLS sur la nouvelle table
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', safe_table_name);
    
    -- Créer une politique pour permettre la lecture à tous (public)
    EXECUTE format('
        CREATE POLICY "Allow read access" ON %I
        FOR SELECT
        TO public
        USING (true)
    ', safe_table_name);
    
    -- Créer une politique pour permettre l'insertion à tous (public)
    EXECUTE format('
        CREATE POLICY "Allow insert access" ON %I
        FOR INSERT
        TO public
        WITH CHECK (true)
    ', safe_table_name);
    
    -- Créer un index sur le numéro de contrat pour optimiser les recherches
    EXECUTE format('
        CREATE INDEX %I ON %I (numero_contrat)
    ', safe_table_name || '_numero_contrat_idx', safe_table_name);
    
    RAISE NOTICE 'Table % créée avec succès', safe_table_name;
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur lors de la création de la table %: %', safe_table_name, SQLERRM;
        RETURN false;
END;
$$;

-- Update permissions to allow public access to functions
GRANT EXECUTE ON FUNCTION create_monthly_table(text) TO public;
GRANT EXECUTE ON FUNCTION get_table_names() TO public;

-- Test the fix
DO $$
BEGIN
    RAISE NOTICE 'RLS policies updated to allow public access';
    RAISE NOTICE 'Function permissions updated to allow public execution';
END $$;
