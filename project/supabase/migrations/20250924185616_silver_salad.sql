@@ .. @@
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
 BEGIN
     SELECT array_agg(table_name ORDER BY table_name)
     INTO table_names
-    FROM information_schema.tables
-    WHERE table_schema = 'public'
-    AND table_name LIKE 'table_terme_%'
-    AND table_type = 'BASE TABLE';
+    FROM information_schema.tables t
+    WHERE t.table_schema = 'public'
+    AND t.table_name LIKE 'table_terme_%'
+    AND t.table_type = 'BASE TABLE';
