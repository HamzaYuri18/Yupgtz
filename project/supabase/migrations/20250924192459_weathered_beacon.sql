@@ .. @@
 -- Update the create_monthly_table function to use public instead of authenticated
-CREATE OR REPLACE FUNCTION create_monthly_table(table_name text)
+CREATE OR REPLACE FUNCTION create_monthly_table(p_table_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
@@ .. @@
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
@@ .. @@
 -- Update permissions to allow public access to functions
-GRANT EXECUTE ON FUNCTION create_monthly_table(text) TO public;
+GRANT EXECUTE ON FUNCTION create_monthly_table(p_table_name text) TO public;
 GRANT EXECUTE ON FUNCTION get_table_names() TO public;
