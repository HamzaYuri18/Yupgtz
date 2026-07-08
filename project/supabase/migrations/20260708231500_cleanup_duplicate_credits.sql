-- Nettoyer les doublons de crédits dans la table liste_credits
-- S'il y a des doublons pour un même numéro de contrat (normalisé),
-- on garde en priorité celui qui est marqué comme payé, ou qui a déjà reçu un paiement,
-- ou à défaut le premier inséré (plus petit id).

WITH CTE AS (
  SELECT id,
         ROW_NUMBER() OVER(
           PARTITION BY TRIM(UPPER(numero_contrat))
           ORDER BY
             CASE WHEN statut IN ('Payé', 'Payé en total', 'Payé partiellement') THEN 1 ELSE 2 END,
             CASE WHEN paiement > 0 THEN 1 ELSE 2 END,
             id ASC
         ) as rn
  FROM liste_credits
)
DELETE FROM liste_credits
WHERE id IN (
  SELECT id FROM CTE WHERE rn > 1
);
