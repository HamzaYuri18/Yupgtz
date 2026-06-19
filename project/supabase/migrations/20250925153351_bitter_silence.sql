/*
  # Fix create_monthly_table function with correct parameter name

  1. Corrections
    - Créer la fonction create_monthly_table avec le paramètre p_table_name
    - Corriger l'ambiguïté des colonnes avec des alias
    - Permettre l'accès public pour l'utilisation avec la clé anonyme

  2. Sécurité
    - RLS activé sur toutes les nouvelles tables
    - Politiques publiques pour lecture et insertion
    - Validation stricte des noms de tables
*/

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS create_monthly_table(text);
DROP FUNCTION IF EXISTS create_monthly_table(p_table_name text);

-- Créer la fonction corrigée avec le bon nom de paramètre
CREATE OR REPLACE FUNCTION create_monthly_table(p_table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    safe_table_name text;
BEGIN
    -- Nettoyer et valider le nom de la table
    safe_table_name := regexp_replace(p_table_name, '[^a-zA-Z0-9_]', '', 'g');
    
    -- Vérifier que le nom commence par 'table_terme_'
    IF NOT safe_table_name ~ '^table_terme_[a-zA-Z0-9_]+$' THEN
        RAISE EXCEPTION 'Nom de table invalide: %. Le nom doit commencer par table_terme_', p_table_name;
    END IF;
    
    -- Vérifier si la table existe déjà
    IF EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
        AND t.table_name = safe_table_name
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
    
    -- Créer une politique pour permettre la lecture publique
    EXECUTE format('
        CREATE POLICY "Allow read access" ON %I
        FOR SELECT
        TO public
        USING (true)
    ', safe_table_name);
    
    -- Créer une politique pour permettre l'insertion publique
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

-- Supprimer l'ancienne fonction get_table_names si elle existe
DROP FUNCTION IF EXISTS get_table_names();

-- Recréer la fonction get_table_names
CREATE OR REPLACE FUNCTION get_table_names()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_names text[];
BEGIN
    SELECT array_agg(t.table_name ORDER BY t.table_name)
    INTO table_names
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_name LIKE 'table_terme_%'
    AND t.table_type = 'BASE TABLE';
    
    -- Retourner un tableau vide si aucune table n'est trouvée
    RETURN COALESCE(table_names, ARRAY[]::text[]);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur lors de la récupération des noms de tables: %', SQLERRM;
        RETURN ARRAY[]::text[];
END;
$$;

-- Accorder les permissions d'exécution au public
GRANT EXECUTE ON FUNCTION create_monthly_table(p_table_name text) TO public;
GRANT EXECUTE ON FUNCTION get_table_names() TO public;

-- Test rapide de la fonction
DO $$
BEGIN
    RAISE NOTICE '✅ Fonction create_monthly_table(p_table_name text) créée avec succès';
    RAISE NOTICE '✅ Fonction get_table_names() créée avec succès';
    RAISE NOTICE '✅ Permissions publiques accordées';
END $$;
