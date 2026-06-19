@@ .. @@
+-- Drop existing functions first to avoid conflicts
+DROP FUNCTION IF EXISTS create_monthly_table(text);
+DROP FUNCTION IF EXISTS create_monthly_table(p_table_name text);
+DROP FUNCTION IF EXISTS get_table_names();
+
 -- Grant USAGE permission on public schema to public role
