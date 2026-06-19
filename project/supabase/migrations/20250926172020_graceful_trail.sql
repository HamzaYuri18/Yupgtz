/*
  # Corriger la contrainte type de la table rapport pour inclure 'Crédit'

  1. Modifications
    - Supprimer l'ancienne contrainte CHECK sur la colonne type
    - Ajouter une nouvelle contrainte CHECK incluant 'Crédit'

  2. Valeurs autorisées
    - Terme, Affaire, Crédit (types de contrats)
    - Dépense, Recette Exceptionnelle, Ristourne, Sinistre (types financiers)
*/

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE rapport DROP CONSTRAINT IF EXISTS rapport_type_check;

-- Ajouter la nouvelle contrainte CHECK avec 'Crédit'
ALTER TABLE rapport ADD CONSTRAINT rapport_type_check
CHECK (type IN ('Terme', 'Affaire', 'Crédit', 'Dépense', 'Recette Exceptionnelle', 'Ristourne', 'Sinistre'));

-- Vérifier que la contrainte a été appliquée
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'rapport_type_check' 
        AND check_clause LIKE '%Crédit%'
    ) THEN
        RAISE NOTICE '✅ Contrainte type mise à jour avec succès';
        RAISE NOTICE '   - Valeurs autorisées: Terme, Affaire, Crédit, Dépense, Recette Exceptionnelle, Ristourne, Sinistre';
    ELSE
        RAISE EXCEPTION '❌ Échec de la mise à jour de la contrainte';
    END IF;
END $$;
