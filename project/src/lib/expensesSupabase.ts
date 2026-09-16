import { createClient } from '@supabase/supabase-js';

// Projet Supabase distinct (séparé du projet principal de l'application),
// utilisé uniquement pour consulter le détail des charges d'une session
// (rubrique Versement Bancaire). La clé ci-dessous est une clé "publishable"
// (lecture seule côté client), donc sans risque à exposer dans le code front.
const EXPENSES_SUPABASE_URL = 'https://divwfzqvfpdfbydtlibc.supabase.co';
const EXPENSES_SUPABASE_KEY = 'sb_publishable_8mltxBRbDmrrpc0J4Yo8yQ_HZYBAMGr';

export const expensesSupabase = createClient(EXPENSES_SUPABASE_URL, EXPENSES_SUPABASE_KEY);

export interface ExpenseDetail {
  id: string;
  expense_date: string;
  description: string | null;
  category: string | null;
  amount: number;
  source: string | null;
  created_at: string;
}
