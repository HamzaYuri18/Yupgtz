@@ .. @@
     -- Vérifier que le nom commence par 'table_terme_'
     IF NOT safe_table_name ~ '^table_terme_[a-zA-Z0-9_]+$' THEN
-        RAISE EXCEPTION 'Nom de table invalide: %. Le nom doit commencer par table_terme_', p_table_name;
+        RAISE EXCEPTION 'Nom de table invalide: %. Le nom doit commencer par table_terme_', safe_table_name;
     END IF;
