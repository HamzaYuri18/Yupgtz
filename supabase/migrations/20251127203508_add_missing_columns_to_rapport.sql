/*
  # Add missing columns to rapport table

  1. Modifications
    - Ajout de la colonne `date_operation` à la table `rapport`
      - Type: DATE
      - Permet de tracker la date de l'opération pour les sessions
    
    - Ajout de la colonne `montant_recu` à la table `rapport`
      - Type: NUMERIC(10,2)
      - Permet de stocker le montant réellement reçu
      - Valeur par défaut: 0

  2. Index
    - Ajout d'un index sur `date_operation` pour optimiser les requêtes de session
*/

-- Ajouter la colonne date_operation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rapport' AND column_name = 'date_operation'
  ) THEN
    ALTER TABLE rapport 
    ADD COLUMN date_operation DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Ajouter la colonne montant_recu
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rapport' AND column_name = 'montant_recu'
  ) THEN
    ALTER TABLE rapport 
    ADD COLUMN montant_recu NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- Mettre à jour montant_recu avec la valeur de montant pour les lignes existantes
UPDATE rapport SET montant_recu = montant WHERE montant_recu = 0 OR montant_recu IS NULL;

-- Créer un index sur date_operation
CREATE INDEX IF NOT EXISTS rapport_date_operation_idx ON rapport (date_operation);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Colonnes ajoutées à la table rapport';
    RAISE NOTICE '   - date_operation: DATE pour tracker les opérations par session';
    RAISE NOTICE '   - montant_recu: NUMERIC pour le montant reçu';
    RAISE NOTICE '   - Index créé sur date_operation';
END $$;
