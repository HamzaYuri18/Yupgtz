import { supabase } from '../lib/supabase';

/**
 * Recherche flexible de crédits avec tolérance pour le nom et combinaison de critères
 *
 * @param numeroContrat - Numéro du contrat (optionnel)
 * @param assure - Nom de l'assuré (optionnel, avec tolérance majuscule/minuscule et fautes)
 * @param dateCredit - Date de création du crédit (optionnel)
 * @returns Liste des crédits correspondants
 */
export const searchCreditFlexible = async (
  numeroContrat: string | null,
  assure: string | null,
  dateCredit: string | null
): Promise<any[]> => {
  try {
    console.log('🔍 Recherche flexible de crédit...');
    console.log('Critères:', { numeroContrat, assure, dateCredit });

    let query = supabase.from('liste_credits').select('*');

    // Filtre par numéro de contrat (exact)
    if (numeroContrat) {
      query = query.eq('numero_contrat', numeroContrat);
    }

    // Filtre par date de création
    if (dateCredit) {
      const dateStart = `${dateCredit}T00:00:00`;
      const dateEnd = `${dateCredit}T23:59:59`;
      query = query.gte('created_at', dateStart).lte('created_at', dateEnd);
    }

    // Si on a le nom de l'assuré, on va faire une recherche avec tolérance
    if (assure) {
      // Recherche avec tolérance: utiliser ilike pour case-insensitive
      // et pg_trgm pour la similarité de texte
      const { data: allData, error } = await query;

      if (error) {
        console.error('❌ Erreur lors de la recherche:', error);
        return [];
      }

      if (!allData || allData.length === 0) {
        return [];
      }

      // Filtrer les résultats avec une fonction de similarité
      const results = allData.filter((credit) => {
        return isSimilarName(credit.assure, assure);
      });

      console.log('✅ Résultats trouvés:', results.length);
      return results;
    }

    // Si pas de nom d'assuré, exécuter la requête normale
    const { data, error } = await query;

    if (error) {
      console.error('❌ Erreur lors de la recherche:', error);
      return [];
    }

    console.log('✅ Résultats trouvés:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Erreur générale lors de la recherche:', error);
    return [];
  }
};

/**
 * Vérifie la similarité entre deux noms avec tolérance
 * - Ignore la casse (majuscules/minuscules)
 * - Accepte 1-2 lettres de différence (fautes de frappe)
 */
const isSimilarName = (name1: string, name2: string): boolean => {
  if (!name1 || !name2) return false;

  // Normaliser: minuscules et supprimer espaces multiples
  const normalize = (str: string) =>
    str.toLowerCase().trim().replace(/\s+/g, ' ');

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Correspondance exacte
  if (n1 === n2) return true;

  // Vérifier si l'un contient l'autre
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Calculer la distance de Levenshtein (nombre de modifications nécessaires)
  const distance = levenshteinDistance(n1, n2);

  // Accepter jusqu'à 2 caractères de différence
  return distance <= 2;
};

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * (nombre minimum d'opérations pour transformer une chaîne en l'autre)
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;

  // Créer une matrice de distance
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialiser la première ligne et colonne
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Remplir la matrice
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // Suppression
        matrix[i][j - 1] + 1, // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return matrix[len1][len2];
};
