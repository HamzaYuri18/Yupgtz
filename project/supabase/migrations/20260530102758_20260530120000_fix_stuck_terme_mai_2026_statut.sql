/*
  # Fix stuck "non payé" statut in table_terme_mai_2026

  ## Problem
  45 records in table_terme_mai_2026 have statut = 'non payé' despite having a
  matching payment entry in the rapport table (type = 'Terme', same numero_contrat
  and echeance). The previous migration missed these because payments were recorded
  after that migration ran.

  ## Fix
  Update all such stuck records to statut = 'payé' by matching on numero_contrat
  and echeance between table_terme_mai_2026 and rapport, without any date filter
  on date_operation so no future entries are missed.

  ## Tables affected
  - table_terme_mai_2026: up to 45 rows updated
*/

UPDATE table_terme_mai_2026 t
SET statut = 'payé'
WHERE t.statut = 'non payé'
  AND EXISTS (
    SELECT 1 FROM rapport r
    WHERE r.numero_contrat = t.numero_contrat
      AND r.echeance = t.echeance
      AND r.type = 'Terme'
  );
