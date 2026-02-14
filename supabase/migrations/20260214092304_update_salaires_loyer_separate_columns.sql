/*
  # Modifier la table salaires_loyer pour séparer salaires et loyer
  
  1. Modifications
    - Supprimer les anciennes colonnes: statut, mode_liquidation, date_liquidation
    - Ajouter les colonnes pour les salaires:
      - `montant_salaires` (decimal) - Montant des salaires
      - `statut_salaires` (boolean, default false) - Statut de liquidation des salaires
      - `mode_liquidation_salaires` (text, nullable) - Mode de liquidation des salaires
      - `date_liquidation_salaires` (date, nullable) - Date de liquidation des salaires
    - Ajouter les colonnes pour le loyer:
      - `montant_loyer` (decimal) - Montant du loyer
      - `statut_loyer` (boolean, default false) - Statut de liquidation du loyer
      - `mode_liquidation_loyer` (text, nullable) - Mode de liquidation du loyer
      - `date_liquidation_loyer` (date, nullable) - Date de liquidation du loyer
  
  2. Notes Importantes
    - Les montants sont en decimal(10,2) pour supporter les valeurs avec 2 décimales
    - Chaque type (salaires/loyer) a son propre statut et mode de liquidation
    - Les contraintes de validation s'appliquent séparément à chaque type
*/

-- Supprimer l'ancienne contrainte
ALTER TABLE salaires_loyer DROP CONSTRAINT IF EXISTS statut_coherence;
ALTER TABLE salaires_loyer DROP CONSTRAINT IF EXISTS valid_mode_liquidation;

-- Supprimer les anciennes colonnes
ALTER TABLE salaires_loyer DROP COLUMN IF EXISTS statut;
ALTER TABLE salaires_loyer DROP COLUMN IF EXISTS mode_liquidation;
ALTER TABLE salaires_loyer DROP COLUMN IF EXISTS date_liquidation;

-- Ajouter les colonnes pour les salaires
ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS montant_salaires decimal(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS statut_salaires boolean DEFAULT false NOT NULL;
ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS mode_liquidation_salaires text;
ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS date_liquidation_salaires date;

-- Ajouter les colonnes pour le loyer
ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS montant_loyer decimal(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS statut_loyer boolean DEFAULT false NOT NULL;
ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS mode_liquidation_loyer text;
ALTER TABLE salaires_loyer ADD COLUMN IF NOT EXISTS date_liquidation_loyer date;

-- Contraintes pour les salaires
ALTER TABLE salaires_loyer ADD CONSTRAINT valid_mode_liquidation_salaires CHECK (
  mode_liquidation_salaires IS NULL OR 
  mode_liquidation_salaires IN ('Compensation sur commission', 'Virement', 'Cheque')
);

ALTER TABLE salaires_loyer ADD CONSTRAINT statut_salaires_coherence CHECK (
  (statut_salaires = false AND mode_liquidation_salaires IS NULL AND date_liquidation_salaires IS NULL) OR
  (statut_salaires = true)
);

-- Contraintes pour le loyer
ALTER TABLE salaires_loyer ADD CONSTRAINT valid_mode_liquidation_loyer CHECK (
  mode_liquidation_loyer IS NULL OR 
  mode_liquidation_loyer IN ('Compensation sur commission', 'Virement', 'Cheque')
);

ALTER TABLE salaires_loyer ADD CONSTRAINT statut_loyer_coherence CHECK (
  (statut_loyer = false AND mode_liquidation_loyer IS NULL AND date_liquidation_loyer IS NULL) OR
  (statut_loyer = true)
);