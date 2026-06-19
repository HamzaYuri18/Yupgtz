/*
  # Fonctions RPC pour la gestion des tables mensuelles

  1. Nouvelles fonctions
    - `create_monthly_table` - Crée une table mensuelle avec les colonnes requises
    - `get_table_names` - Récupère la liste des tables commençant par 'table_terme_'

  2. Sécurité
    - Les fonctions sont accessibles aux utilisateurs authentifiés
    - Validation des noms de tables pour éviter l'injection SQL
*/

-- Fonction pour créer une table mensuelle
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
        RAISE EXCEPTION 'Nom de table invalide: %', table_name;
    END IF;
    
    -- Vérifier si la table existe déjà
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = safe_table_name
    ) THEN
        RETURN true; -- Table existe déjà
    END IF;
    
    -- Créer la table avec les colonnes requises
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I (
            id SERIAL PRIMARY KEY,
            numero_contrat TEXT NOT NULL,
            prime DECIMAL(10,2) NOT NULL DEFAULT 0,
            assure TEXT NOT NULL,
            echeance TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', safe_table_name);
    
    -- Activer RLS sur la nouvelle table
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', safe_table_name);
    
    -- Créer une politique pour permettre la lecture à tous les utilisateurs authentifiés
    EXECUTE format('
        CREATE POLICY "Allow read access" ON %I
        FOR SELECT
        TO authenticated
        USING (true)
    ', safe_table_name);
    
    -- Créer une politique pour permettre l'insertion aux utilisateurs authentifiés
    EXECUTE format('
        CREATE POLICY "Allow insert access" ON %I
        FOR INSERT
        TO authenticated
        WITH CHECK (true)
    ', safe_table_name);
    
    -- Créer un index sur le numéro de contrat pour optimiser les recherches
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON %I (numero_contrat)
    ', safe_table_name || '_numero_contrat_idx', safe_table_name);
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur lors de la création de la table %: %', safe_table_name, SQLERRM;
        RETURN false;
END;
$$;

-- Fonction pour récupérer la liste des tables mensuelles
CREATE OR REPLACE FUNCTION get_table_names()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_names text[];
BEGIN
    SELECT array_agg(table_name ORDER BY table_name)
    INTO table_names
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'table_terme_%'
    AND table_type = 'BASE TABLE';
    
    -- Retourner un tableau vide si aucune table n'est trouvée
    RETURN COALESCE(table_names, ARRAY[]::text[]);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur lors de la récupération des noms de tables: %', SQLERRM;
        RETURN ARRAY[]::text[];
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION create_monthly_table(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_names() TO authenticated;
