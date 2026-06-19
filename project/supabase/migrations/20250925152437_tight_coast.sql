@@ .. @@
 -- Fonction pour créer une table mensuelle
-CREATE OR REPLACE FUNCTION create_monthly_table(table_name text)
+CREATE OR REPLACE FUNCTION create_monthly_table(p_table_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
 DECLARE
     safe_table_name text;
 BEGIN
     -- Nettoyer et valider le nom de la table
-    safe_table_name := regexp_replace(table_name, '[^a-zA-Z0-9_]', '', 'g');
+    safe_table_name := regexp_replace(p_table_name, '[^a-zA-Z0-9_]', '', 'g');
     
     -- Vérifier que le nom commence par 'table_terme_'
     IF NOT safe_table_name ~ '^table_terme_[a-zA-Z0-9_]+$' THEN
-        RAISE EXCEPTION 'Nom de table invalide: %. Le nom doit commencer par table_terme_', table_name;
+        RAISE EXCEPTION 'Nom de table invalide: %. Le nom doit commencer par table_terme_', p_table_name;
     END IF;
     
     -- Vérifier si la table existe déjà
     IF EXISTS (
-        SELECT 1 FROM information_schema.tables 
-        WHERE table_schema = 'public' 
-        AND table_name = safe_table_name
+        SELECT 1 FROM information_schema.tables t
+        WHERE t.table_schema = 'public' 
+        AND t.table_name = safe_table_name
     ) THEN
         RAISE NOTICE 'Table % existe déjà', safe_table_name;
         RETURN true; -- Table existe déjà
@@ .. @@
 -- Accorder les permissions d'exécution aux utilisateurs authentifiés
-GRANT EXECUTE ON FUNCTION create_monthly_table(text) TO authenticated;
+GRANT EXECUTE ON FUNCTION create_monthly_table(p_table_name text) TO authenticated;
 GRANT EXECUTE ON FUNCTION get_table_names() TO authenticated;
