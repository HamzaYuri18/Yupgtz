/*
  # Debug et test des fonctions de création de tables

  Ce script permet de tester et déboguer la création des tables mensuelles.
*/

-- Test de la fonction create_monthly_table
DO $$
BEGIN
    -- Tester la création d'une table de test
    IF create_monthly_table('table_terme_test_janvier_2025') THEN
        RAISE NOTICE 'Table de test créée avec succès';
    ELSE
        RAISE NOTICE 'Échec de la création de la table de test';
    END IF;
END $$;

-- Vérifier que la table a été créée
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'table_terme_test_janvier_2025'
ORDER BY ordinal_position;

-- Tester l'insertion de données
INSERT INTO table_terme_test_janvier_2025 (numero_contrat, prime, assure, echeance)
VALUES 
    ('TEST001', 1500.00, 'Test Assuré 1', '2025-12-31'),
    ('TEST002', 2000.00, 'Test Assuré 2', '2025-06-15');

-- Vérifier les données insérées
SELECT * FROM table_terme_test_janvier_2025;

-- Tester la fonction get_table_names
SELECT get_table_names() as tables_disponibles;

-- Nettoyer la table de test (optionnel)
-- DROP TABLE IF EXISTS table_terme_test_janvier_2025;
