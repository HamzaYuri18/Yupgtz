/*
  # Mise à jour de la structure de la table rapport

  1. Clarification des colonnes
    - `prime` - Contient la valeur de la prime TTC saisie au formulaire
    - `montant_credit` - Contient la valeur du crédit saisie au formulaire
    - `montant` - Calculé automatiquement selon la logique métier

  2. Logique de calcul du montant
    - Pour les contrats normaux : montant = prime - montant_credit (si crédit existe)
    - Pour les contrats au comptant : montant = prime (montant_credit = NULL)
    - Pour les types financiers : montant selon le type (positif/négatif)

  3. Trigger mis à jour
    - Calcul automatique du montant selon le type et les valeurs saisies
    - Préservation des valeurs prime et montant_credit saisies
*/

-- Mettre à jour la fonction de calcul du montant
CREATE OR REPLACE FUNCTION calculate_rapport_montant()
RETURNS TRIGGER AS $$
BEGIN
    -- La colonne prime contient TOUJOURS la valeur de la prime TTC saisie au formulaire
    -- La colonne montant_credit contient TOUJOURS la valeur du crédit saisie au formulaire
    -- Ces valeurs ne sont JAMAIS modifiées par ce trigger
    
    -- Calculer le montant selon le type et la logique métier
    CASE NEW.type
        WHEN 'Terme', 'Affaire' THEN
            -- Pour les contrats normaux
            IF NEW.montant_credit IS NOT NULL AND NEW.montant_credit > 0 THEN
                NEW.montant := NEW.prime - NEW.montant_credit;
            ELSE
                NEW.montant := NEW.prime;
            END IF;
            
        WHEN 'Crédit' THEN
            -- Pour les entrées de crédit (toujours négatives)
            NEW.montant := -ABS(COALESCE(NEW.montant_credit, NEW.prime));
            
        WHEN 'Dépense', 'Ristourne', 'Sinistre' THEN
            -- Pour les sorties d'argent (toujours négatives)
            NEW.montant := -ABS(NEW.prime);
            
        WHEN 'Recette Exceptionnelle' THEN
            -- Pour les entrées d'argent (toujours positives)
            NEW.montant := ABS(NEW.prime);
            
        ELSE
            -- Par défaut, montant = prime
            NEW.montant := NEW.prime;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trigger_calculate_rapport_montant ON rapport;
CREATE TRIGGER trigger_calculate_rapport_montant
    BEFORE INSERT OR UPDATE ON rapport
    FOR EACH ROW
    EXECUTE FUNCTION calculate_rapport_montant();

-- Recalculer tous les montants existants avec la nouvelle logique
UPDATE rapport 
SET montant = CASE type
    WHEN 'Terme' THEN
        CASE 
            WHEN montant_credit IS NOT NULL AND montant_credit > 0 THEN prime - montant_credit
            ELSE prime
        END
    WHEN 'Affaire' THEN
        CASE 
            WHEN montant_credit IS NOT NULL AND montant_credit > 0 THEN prime - montant_credit
            ELSE prime
        END
    WHEN 'Crédit' THEN
        -ABS(COALESCE(montant_credit, prime))
    WHEN 'Dépense' THEN
        -ABS(prime)
    WHEN 'Ristourne' THEN
        -ABS(prime)
    WHEN 'Sinistre' THEN
        -ABS(prime)
    WHEN 'Recette Exceptionnelle' THEN
        ABS(prime)
    ELSE
        prime
END;

-- Ajouter des commentaires sur les colonnes pour clarifier leur usage
COMMENT ON COLUMN rapport.prime IS 'Valeur de la prime TTC saisie au formulaire (inchangée)';
COMMENT ON COLUMN rapport.montant_credit IS 'Valeur du crédit saisie au formulaire (inchangée)';
COMMENT ON COLUMN rapport.montant IS 'Montant calculé automatiquement selon la logique métier';

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Structure de la table rapport mise à jour';
    RAISE NOTICE '   - prime : Valeur de la prime TTC saisie au formulaire';
    RAISE NOTICE '   - montant_credit : Valeur du crédit saisie au formulaire';
    RAISE NOTICE '   - montant : Calculé automatiquement selon la logique métier';
    RAISE NOTICE '   - Trigger mis à jour pour tous les types de contrats';
    RAISE NOTICE '   - Tous les montants existants recalculés';
END $$;
