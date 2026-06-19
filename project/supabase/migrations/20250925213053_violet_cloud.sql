/*
  # Ajouter 'Financier' à la contrainte branche de la table rapport

  1. Modifications
    - Supprimer l'ancienne contrainte CHECK sur la colonne branche
    - Ajouter une nouvelle contrainte CHECK incluant 'Financier'

  2. Valeurs autorisées
    - Auto, Vie, Santé, IRDS, Financier
*/

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE rapport DROP CONSTRAINT IF EXISTS rapport_branche_check;

-- Ajouter la nouvelle contrainte CHECK avec 'Financier'
ALTER TABLE rapport ADD CONSTRAINT rapport_branche_check 
CHECK (branche IN ('Auto', 'Vie', 'Santé', 'IRDS', 'Financier'));

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Contrainte branche mise à jour avec succès';
    RAISE NOTICE '   - Valeurs autorisées: Auto, Vie, Santé, IRDS, Financier';
END $$;
