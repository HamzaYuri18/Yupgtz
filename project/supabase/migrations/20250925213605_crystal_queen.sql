/*
  # Ajouter les colonnes financières à la table rapport

  1. Nouvelles colonnes
    - `date_depense` (date, nullable) - Pour les dépenses
    - `date_recette` (date, nullable) - Pour les recettes exceptionnelles
    - `date_ristourne` (date, nullable) - Pour les ristournes
    - `date_paiement_ristourne` (date, nullable) - Date de paiement des ristournes
    - `date_sinistre` (date, nullable) - Pour les sinistres
    - `date_paiement_sinistre` (date, nullable) - Date de paiement des sinistres
    - `numero_sinistre` (text, nullable) - Numéro du sinistre
    - `client` (text, nullable) - Client pour ristournes et sinistres
    - `type_depense` (text, nullable) - Type de dépense
    - `type_recette` (text, nullable) - Type de recette exceptionnelle

  2. Index
    - Index sur les nouvelles colonnes de dates pour optimiser les recherches
    - Index sur numero_sinistre et client

  3. Sécurité
    - Les colonnes sont nullables pour maintenir la compatibilité
    - Pas de contraintes CHECK pour permettre la flexibilité
*/

-- Ajouter les colonnes pour les dépenses
ALTER TABLE rapport 
ADD COLUMN IF NOT EXISTS date_depense DATE,
ADD COLUMN IF NOT EXISTS type_depense TEXT;

-- Ajouter les colonnes pour les recettes exceptionnelles
ALTER TABLE rapport 
ADD COLUMN IF NOT EXISTS date_recette DATE,
ADD COLUMN IF NOT EXISTS type_recette TEXT;

-- Ajouter les colonnes pour les ristournes
ALTER TABLE rapport 
ADD COLUMN IF NOT EXISTS date_ristourne DATE,
ADD COLUMN IF NOT EXISTS date_paiement_ristourne DATE,
ADD COLUMN IF NOT EXISTS client TEXT;

-- Ajouter les colonnes pour les sinistres
ALTER TABLE rapport 
ADD COLUMN IF NOT EXISTS date_sinistre DATE,
ADD COLUMN IF NOT EXISTS date_paiement_sinistre DATE,
ADD COLUMN IF NOT EXISTS numero_sinistre TEXT;

-- Créer des index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS rapport_date_depense_idx ON rapport (date_depense);
CREATE INDEX IF NOT EXISTS rapport_date_recette_idx ON rapport (date_recette);
CREATE INDEX IF NOT EXISTS rapport_date_ristourne_idx ON rapport (date_ristourne);
CREATE INDEX IF NOT EXISTS rapport_date_sinistre_idx ON rapport (date_sinistre);
CREATE INDEX IF NOT EXISTS rapport_numero_sinistre_idx ON rapport (numero_sinistre);
CREATE INDEX IF NOT EXISTS rapport_client_idx ON rapport (client);
CREATE INDEX IF NOT EXISTS rapport_type_depense_idx ON rapport (type_depense);
CREATE INDEX IF NOT EXISTS rapport_type_recette_idx ON rapport (type_recette);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Colonnes financières ajoutées à la table rapport avec succès';
    RAISE NOTICE '   - Colonnes dépenses: date_depense, type_depense';
    RAISE NOTICE '   - Colonnes recettes: date_recette, type_recette';
    RAISE NOTICE '   - Colonnes ristournes: date_ristourne, date_paiement_ristourne, client';
    RAISE NOTICE '   - Colonnes sinistres: date_sinistre, date_paiement_sinistre, numero_sinistre';
    RAISE NOTICE '   - Index créés pour optimiser les performances';
END $$;
