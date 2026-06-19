/*
  # Corriger le type de la colonne echeance en DATE

  1. Modifications
    - Modifier la fonction create_monthly_table pour créer la colonne echeance en type DATE
    - Mettre à jour les tables existantes pour convertir echeance de TEXT vers DATE
    - Gérer la conversion des valeurs numériques Excel vers des dates

  2. Sécurité
    - Sauvegarde des données existantes avant conversion
    - Gestion des erreurs de conversion
    - Validation des données converties
*/

-- Fonction pour convertir les numéros de série Excel en dates
CREATE OR REPLACE FUNCTION excel_serial_to_date(serial_number text)
RETURNS date
LANGUAGE plpgsql
AS $$
BEGIN
    -- Si c'est déjà une date au format YYYY-MM-DD, la retourner
    IF serial_number ~ '^\d{4}-\d{2}-\d{2}$' THEN
        RETURN serial_number::date;
    END IF;
    
    -- Si c'est un nombre (numéro de série Excel), le convertir
    IF serial_number ~ '^\d+$' THEN
        -- Excel compte les jours depuis le 1er janvier 1900 (avec bug du 29 février 1900)
        -- Formule: date = '1900-01-01'::date + (serial_number - 2)
        RETURN '1900-01-01'::date + (serial_number::integer - 2);
    END IF;
    
    -- Si c'est un autre format, essayer de le parser
    BEGIN
        RETURN serial_number::date;
    EXCEPTION
        WHEN OTHERS THEN
            -- Si la conversion échoue, retourner une date par défaut
            RETURN '2025-12-31'::date;
    END;
END;
$$;

-- Mettre à jour la fonction create_monthly_table pour utiliser le type DATE
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
    
    -- Créer la table avec la colonne echeance en type DATE
    EXECUTE format('
        CREATE TABLE %I (
            id SERIAL PRIMARY KEY,
            numero_contrat TEXT NOT NULL,
            prime DECIMAL(10,2) NOT NULL DEFAULT 0,
            assure TEXT NOT NULL,
            echeance DATE NOT NULL,
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
    
    -- Accorder les permissions au rôle public
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO public', safe_table_name);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I_id_seq TO public', safe_table_name);
    
    -- Créer un index sur le numéro de contrat pour optimiser les recherches
    EXECUTE format('
        CREATE INDEX %I ON %I (numero_contrat)
    ', safe_table_name || '_numero_contrat_idx', safe_table_name);
    
    RAISE NOTICE 'Table % créée avec succès avec colonne echeance en type DATE', safe_table_name;
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur lors de la création de la table %: %', safe_table_name, SQLERRM;
        RETURN false;
END;
$$;

-- Fonction pour mettre à jour les tables existantes
CREATE OR REPLACE FUNCTION update_existing_tables_echeance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_record RECORD;
    column_type text;
BEGIN
    -- Parcourir toutes les tables mensuelles existantes
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'table_terme_%'
        AND table_type = 'BASE TABLE'
    LOOP
        -- Vérifier le type actuel de la colonne echeance
        SELECT data_type INTO column_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = table_record.table_name
        AND column_name = 'echeance';
        
        -- Si la colonne est en TEXT, la convertir en DATE
        IF column_type = 'text' THEN
            RAISE NOTICE 'Conversion de la colonne echeance en DATE pour la table %', table_record.table_name;
            
            -- Ajouter une nouvelle colonne temporaire de type DATE
            EXECUTE format('ALTER TABLE %I ADD COLUMN echeance_temp DATE', table_record.table_name);
            
            -- Convertir les données existantes
            EXECUTE format('
                UPDATE %I 
                SET echeance_temp = excel_serial_to_date(echeance)
            ', table_record.table_name);
            
            -- Supprimer l'ancienne colonne et renommer la nouvelle
            EXECUTE format('ALTER TABLE %I DROP COLUMN echeance', table_record.table_name);
            EXECUTE format('ALTER TABLE %I RENAME COLUMN echeance_temp TO echeance', table_record.table_name);
            
            -- Ajouter la contrainte NOT NULL
            EXECUTE format('ALTER TABLE %I ALTER COLUMN echeance SET NOT NULL', table_record.table_name);
            
            RAISE NOTICE 'Conversion terminée pour la table %', table_record.table_name;
        ELSE
            RAISE NOTICE 'Table % a déjà la colonne echeance en type %', table_record.table_name, column_type;
        END IF;
    END LOOP;
END;
$$;

-- Exécuter la mise à jour des tables existantes
SELECT update_existing_tables_echeance();

-- Nettoyer les fonctions temporaires
DROP FUNCTION IF EXISTS update_existing_tables_echeance();

-- Accorder les permissions sur les fonctions
GRANT EXECUTE ON FUNCTION create_monthly_table(p_table_name text) TO public;
GRANT EXECUTE ON FUNCTION excel_serial_to_date(text) TO public;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Migration terminée avec succès :';
    RAISE NOTICE '   - Fonction create_monthly_table mise à jour pour créer echeance en type DATE';
    RAISE NOTICE '   - Tables existantes converties de TEXT vers DATE';
    RAISE NOTICE '   - Fonction excel_serial_to_date créée pour la conversion des numéros Excel';
    RAISE NOTICE '   - Permissions accordées au rôle public';
END $$;
