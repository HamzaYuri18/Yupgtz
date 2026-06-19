/*
  # Correction du calcul de la colonne encaissement dans la table rp
  
  1. Problème identifié
    - Les fonctions utilisent la colonne "prime NETTE" qui peut être NULL
    - Elles devraient utiliser la colonne "prime" qui contient toujours une valeur valide
    - Erreur "date invalid" due à des comparaisons de dates mal gérées
  
  2. Corrections appliquées
    - Modification de calculate_rp_values() pour utiliser "prime" au lieu de "prime NETTE"
    - Modification de recalculate_rp() pour utiliser "prime" au lieu de "prime NETTE"
    - Modification de sync_rp_table() pour utiliser "prime" au lieu de "prime NETTE"
    - Ajout de conversion explicite des dates pour éviter les erreurs
    - Ajout de validation des dates avec COALESCE et gestion des NULL
  
  3. Astuce pour éviter les erreurs futures
    - Utilisation de CAST pour s'assurer que les dates sont au bon format
    - Filtrage des dates NULL avant la comparaison
    - Utilisation de COALESCE pour gérer les valeurs NULL proprement
*/

-- Fonction 1: Corriger calculate_rp_values pour utiliser "prime" au lieu de "prime NETTE"
CREATE OR REPLACE FUNCTION calculate_rp_values()
RETURNS TRIGGER AS $$
DECLARE
    total_paiement DECIMAL;
    total_encaissement DECIMAL;
BEGIN
    -- Calculer le total paiement pour cette session
    -- CORRECTION: Utiliser "prime" au lieu de "prime NETTE"
    SELECT COALESCE(SUM(prime), 0) INTO total_paiement
    FROM terme 
    WHERE date_paiement IS NOT NULL 
      AND date_paiement::DATE = NEW.session::DATE;
    
    -- Calculer le total encaissement pour cette session
    -- CORRECTION: Utiliser "prime" au lieu de "prime NETTE"
    SELECT COALESCE(SUM(prime), 0) INTO total_encaissement
    FROM terme 
    WHERE "Date_Encaissement" IS NOT NULL 
      AND "Date_Encaissement"::DATE = NEW.session::DATE;
    
    -- Mettre à jour les valeurs
    NEW.paiement := total_paiement;
    NEW.encaissement := total_encaissement;
    NEW.difference := total_paiement - total_encaissement;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction 2: Corriger recalculate_rp pour utiliser "prime" au lieu de "prime NETTE"
CREATE OR REPLACE FUNCTION recalculate_rp()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour toutes les sessions qui pourraient être affectées
    -- CORRECTION: Utiliser "prime" au lieu de "prime NETTE"
    UPDATE rp 
    SET 
        paiement = COALESCE((
            SELECT SUM(prime) 
            FROM terme 
            WHERE date_paiement IS NOT NULL
              AND date_paiement::DATE = rp.session::DATE
              AND prime IS NOT NULL
        ), 0),
        
        encaissement = COALESCE((
            SELECT SUM(prime) 
            FROM terme 
            WHERE "Date_Encaissement" IS NOT NULL
              AND "Date_Encaissement"::DATE = rp.session::DATE
              AND prime IS NOT NULL
        ), 0),
        
        updated_at = NOW();
    
    -- Recalculer difference après avoir mis à jour paiement et encaissement
    UPDATE rp
    SET difference = paiement - encaissement
    WHERE session IS NOT NULL;

    -- Recalculer ReportDeport avec fonction window
    WITH cumulative_calc AS (
        SELECT 
            id,
            session,
            difference,
            SUM(difference) OVER (
                ORDER BY session
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as running_total
        FROM rp
        WHERE session >= '2025-10-24'
    ),
    adjusted_calc AS (
        SELECT 
            id,
            session,
            -47369.100 + (running_total - FIRST_VALUE(difference) OVER (ORDER BY session)) as calculated_report
        FROM cumulative_calc
    )
    UPDATE rp 
    SET ReportDeport = ac.calculated_report
    FROM adjusted_calc ac
    WHERE rp.id = ac.id AND rp.session >= '2025-10-24';

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Fonction 3: Corriger sync_rp_table pour utiliser "prime" au lieu de "prime NETTE"
CREATE OR REPLACE FUNCTION sync_rp_table()
RETURNS VOID AS $$
DECLARE
  session_date DATE;
BEGIN
  -- Insérer toutes les sessions manquantes
  -- CORRECTION: Ajouter validation de date
  FOR session_date IN (
    SELECT DISTINCT date_paiement::DATE 
    FROM terme 
    WHERE date_paiement IS NOT NULL
    UNION
    SELECT DISTINCT "Date_Encaissement"::DATE 
    FROM terme 
    WHERE "Date_Encaissement" IS NOT NULL
  )
  LOOP
    -- Vérifier que la date est valide avant d'insérer
    IF session_date IS NOT NULL THEN
      PERFORM insert_session_if_not_exists(session_date);
    END IF;
  END LOOP;

  -- Mettre à jour les calculs
  -- CORRECTION: Utiliser "prime" au lieu de "prime NETTE"
  UPDATE rp 
  SET 
    paiement = COALESCE((
      SELECT SUM(prime) 
      FROM terme 
      WHERE date_paiement IS NOT NULL 
        AND date_paiement::DATE = rp.session::DATE
    ), 0),
    
    encaissement = COALESCE((
      SELECT SUM(prime) 
      FROM terme 
      WHERE "Date_Encaissement" IS NOT NULL 
        AND "Date_Encaissement"::DATE = rp.session::DATE
    ), 0),
    
    updated_at = NOW()
  WHERE session IS NOT NULL;
  
  -- Recalculer difference après la mise à jour
  UPDATE rp
  SET difference = paiement - encaissement
  WHERE session IS NOT NULL;
  
END;
$$ LANGUAGE plpgsql;

-- Fonction 4: Créer une fonction utilitaire pour valider et normaliser les dates
CREATE OR REPLACE FUNCTION normalize_date(date_input TEXT)
RETURNS DATE AS $$
BEGIN
  -- Essayer de convertir la date en format DATE
  BEGIN
    RETURN date_input::DATE;
  EXCEPTION
    WHEN OTHERS THEN
      -- Si la conversion échoue, retourner NULL
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Fonctions de calcul RP corrigées';
    RAISE NOTICE '   - calculate_rp_values() : Utilise maintenant "prime" au lieu de "prime NETTE"';
    RAISE NOTICE '   - recalculate_rp() : Utilise maintenant "prime" au lieu de "prime NETTE"';
    RAISE NOTICE '   - sync_rp_table() : Utilise maintenant "prime" au lieu de "prime NETTE"';
    RAISE NOTICE '   - normalize_date() : Nouvelle fonction pour valider les dates';
    RAISE NOTICE '   - Conversion explicite des dates avec ::DATE pour éviter les erreurs';
    RAISE NOTICE '   - Filtrage des NULL avant comparaison pour éviter "date invalid"';
END $$;
