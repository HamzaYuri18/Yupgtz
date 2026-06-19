/*
  # Correction du calcul de la colonne reportdeport dans la table rp
  
  1. Problème identifié
    - Le reportdeport est calculé avec une formule complexe qui ne suit pas la logique métier
    - La logique correcte est: reportdeport_session = reportdeport_session_precedente + difference_session
    - Plusieurs sessions ont des valeurs incorrectes (identifiées par audit)
  
  2. Solution
    - Nouvelle fonction calculate_reportdeport_cumulative() qui calcule le reportdeport séquentiellement
    - Pour chaque session (triée par date):
      * Si c'est la première session (2025-10-24): reportdeport = valeur initiale (-47369.10) + difference
      * Sinon: reportdeport = reportdeport_session_precedente + difference_session
    - Cette fonction garantit que le calcul est toujours correct
  
  3. Astuce pour éviter les erreurs futures
    - Trigger automatique qui recalcule le reportdeport à chaque modification de la table rp
    - Fonction de vérification pour auditer les incohérences
    - Utilisation de ORDER BY session pour garantir l'ordre chronologique
    - Calcul itératif au lieu de window functions complexes
*/

-- Fonction pour calculer le reportdeport de manière cumulative et correcte
CREATE OR REPLACE FUNCTION calculate_reportdeport_cumulative()
RETURNS VOID AS $$
DECLARE
  session_record RECORD;
  previous_reportdeport DECIMAL := -47369.10; -- Valeur initiale pour la première session
  is_first_session BOOLEAN := TRUE;
BEGIN
  -- Parcourir toutes les sessions dans l'ordre chronologique
  FOR session_record IN (
    SELECT id, session, difference 
    FROM rp 
    ORDER BY session ASC
  )
  LOOP
    IF is_first_session THEN
      -- Pour la première session, le reportdeport = valeur initiale + difference
      UPDATE rp 
      SET reportdeport = previous_reportdeport + session_record.difference
      WHERE id = session_record.id;
      
      previous_reportdeport := previous_reportdeport + session_record.difference;
      is_first_session := FALSE;
    ELSE
      -- Pour les sessions suivantes: reportdeport = reportdeport_precedent + difference
      UPDATE rp 
      SET reportdeport = previous_reportdeport + session_record.difference
      WHERE id = session_record.id;
      
      previous_reportdeport := previous_reportdeport + session_record.difference;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Reportdeport recalculé pour toutes les sessions';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour recalculer TOUS les champs de la table RP de manière cohérente
CREATE OR REPLACE FUNCTION recalculate_all_rp_fields()
RETURNS VOID AS $$
BEGIN
  -- Étape 1: Recalculer paiement, encaissement et difference pour toutes les sessions
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
    
    updated_at = NOW()
  WHERE session IS NOT NULL;
  
  -- Étape 2: Recalculer la difference (paiement - encaissement)
  UPDATE rp
  SET difference = paiement - encaissement
  WHERE session IS NOT NULL;
  
  -- Étape 3: Recalculer le reportdeport de manière cumulative
  PERFORM calculate_reportdeport_cumulative();
  
  RAISE NOTICE 'Tous les champs de la table RP recalculés';
END;
$$ LANGUAGE plpgsql;

-- Modifier la fonction recalculate_rp pour utiliser la nouvelle logique
CREATE OR REPLACE FUNCTION recalculate_rp()
RETURNS TRIGGER AS $$
BEGIN
  -- Appeler la fonction qui recalcule tous les champs correctement
  PERFORM recalculate_all_rp_fields();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier la cohérence des calculs de reportdeport
CREATE OR REPLACE FUNCTION audit_reportdeport()
RETURNS TABLE(
  session DATE,
  reportdeport_actuel DECIMAL,
  reportdeport_attendu DECIMAL,
  difference_calcul DECIMAL,
  statut TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.session,
    rp.reportdeport as reportdeport_actuel,
    LAG(rp.reportdeport) OVER (ORDER BY rp.session) + rp.difference as reportdeport_attendu,
    rp.reportdeport - (LAG(rp.reportdeport) OVER (ORDER BY rp.session) + rp.difference) as difference_calcul,
    CASE 
      WHEN rp.reportdeport = LAG(rp.reportdeport) OVER (ORDER BY rp.session) + rp.difference THEN 'OK'
      WHEN LAG(rp.reportdeport) OVER (ORDER BY rp.session) IS NULL THEN 'INITIAL'
      ELSE 'ERREUR'
    END as statut
  FROM rp
  ORDER BY rp.session;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour recalculer automatiquement le reportdeport après modification de la table terme
-- Note: Ce trigger existe déjà, mais nous nous assurons qu'il utilise la bonne fonction
DROP TRIGGER IF EXISTS trigger_recalculate_rp_after_terme ON terme;

CREATE TRIGGER trigger_recalculate_rp_after_terme
AFTER INSERT OR UPDATE OR DELETE ON terme
FOR EACH STATEMENT
EXECUTE FUNCTION recalculate_rp();

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Fonctions de calcul reportdeport corrigées';
    RAISE NOTICE '   - calculate_reportdeport_cumulative() : Calcul séquentiel correct';
    RAISE NOTICE '   - recalculate_all_rp_fields() : Recalcul complet de tous les champs';
    RAISE NOTICE '   - recalculate_rp() : Mise à jour pour utiliser la nouvelle logique';
    RAISE NOTICE '   - audit_reportdeport() : Fonction de vérification des calculs';
    RAISE NOTICE '   - Trigger automatique activé sur la table terme';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ASTUCE: Pour recalculer les valeurs existantes, exécutez:';
    RAISE NOTICE '   SELECT recalculate_all_rp_fields();';
END $$;
