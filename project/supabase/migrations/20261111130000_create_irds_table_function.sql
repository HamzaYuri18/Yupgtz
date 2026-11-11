/*
  # Import IRDS - table de registre + fonction de creation dynamique

  1. Nouvelle table
    - `irds_imports` : registre des fichiers IRDS importes
      - `nom_fichier` (text, unique) : nom saisi par l'utilisateur (ex: IRDS_Juin_2026)
      - `table_name` (text) : nom reel de la table Supabase creee
      - `nb_lignes` (integer) : nombre de lignes importees
      - `created_at` (timestamptz)

  2. Nouvelle fonction RPC
    - `create_irds_table(table_name text)` : cree dynamiquement une table
      avec les colonnes souscripteur, police, date_echeance, montant_ttc,
      si elle n'existe pas encore. Le nom de la table est celui fourni par
      le frontend (deja assaini cote client), re-assaini par securite dans
      la fonction elle-meme (SECURITY DEFINER + format(%I) anti-injection).

  3. Securite
    - RLS active sur irds_imports et sur chaque table IRDS creee
    - Acces complet (lecture/ecriture) pour authenticated et anon,
      au meme titre que les tables table_terme_* existantes
*/

-- Registre des imports IRDS
CREATE TABLE IF NOT EXISTS irds_imports (
  id bigserial PRIMARY KEY,
  nom_fichier text UNIQUE NOT NULL,
  table_name text NOT NULL,
  nb_lignes integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE irds_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access" ON irds_imports;
DROP POLICY IF EXISTS "Allow anonymous all" ON irds_imports;

CREATE POLICY "Allow authenticated access"
  ON irds_imports
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous all"
  ON irds_imports
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Fonction de creation dynamique d'une table IRDS
CREATE OR REPLACE FUNCTION create_irds_table(table_name text)
RETURNS void AS $$
DECLARE
  safe_table_name text;
BEGIN
  safe_table_name := regexp_replace(table_name, '[^a-zA-Z0-9_]', '_', 'g');
  IF safe_table_name !~ '^[a-zA-Z_]' THEN
    safe_table_name := 'irds_' || safe_table_name;
  END IF;
  safe_table_name := substring(safe_table_name from 1 for 63);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id BIGSERIAL PRIMARY KEY,
      souscripteur TEXT NOT NULL,
      police TEXT NOT NULL,
      date_echeance DATE,
      montant_ttc NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )', safe_table_name);

  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', safe_table_name);

  EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access" ON %I', safe_table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous all" ON %I', safe_table_name);

  EXECUTE format('
    CREATE POLICY "Allow authenticated access"
    ON %I
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true)
  ', safe_table_name);

  EXECUTE format('
    CREATE POLICY "Allow anonymous all"
    ON %I
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true)
  ', safe_table_name);

  RAISE NOTICE 'Table IRDS % created successfully', safe_table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_irds_table(text) TO public;
