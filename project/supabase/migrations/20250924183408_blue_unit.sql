@@ .. @@
 -- Fonction pour créer une table mensuelle
-CREATE OR REPLACE FUNCTION create_monthly_table(table_name text)
+CREATE OR REPLACE FUNCTION create_monthly_table(p_table_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
@@ .. @@
 BEGIN
     -- Nettoyer et valider le nom de la table
-    safe_table_name := regexp_replace(table_name, '[^a-zA-Z0-9_]', '', 'g');
+    safe_table_name := regexp_replace(p_table_name, '[^a-zA-Z0-9_]', '', 'g');
     
     -- Vérifier que le nom commence par 'table_terme_'
     IF NOT safe_table_name ~ '^table_terme_[a-zA-Z0-9_]+$' THEN
-        RAISE EXCEPTION 'Nom de table invalide: %', table_name;
+        RAISE EXCEPTION 'Nom de table invalide: %', p_table_name;
     END IF;
