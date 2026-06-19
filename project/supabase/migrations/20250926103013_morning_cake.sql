/*
  # Supprimer la colonne montant_credit de la table rapport

  1. Modifications
    - Supprimer la colonne `montant_credit` de la table rapport
    - Cette colonne n'est plus nécessaire car les crédits sont gérés séparément
    - Les montants de crédit sont enregistrés dans la table liste_credits
    - Dans rapport, seul le montant négatif du crédit est enregistré

  2. Sécurité
    - Suppression sécurisée de la colonne
    - Pas d'impact sur les autres fonctionnalités
*/

-- Supprimer la colonne montant_credit de la table rapport
ALTER TABLE rapport DROP COLUMN IF EXISTS montant_credit;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Colonne montant_credit supprimée de la table rapport';
    RAISE NOTICE '   - Les crédits sont maintenant gérés uniquement dans liste_credits';
    RAISE NOTICE '   - Dans rapport, seul le montant négatif du crédit est enregistré';
END $$;
