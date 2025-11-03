import { supabase } from '../lib/supabase';

// Types pour les données financières
export interface Depense {
  id?: number;
  type_depense: string;
  montant: number;
  date_depense?: string;
  cree_par: string;
  created_at?: string;
  Numero_Contrat?: string;
  Client?: string;
}

export interface RecetteExceptionnelle {
  id?: number;
  type_recette: string;
  montant: number;
  date_recette?: string;
  cree_par: string;
  created_at?: string;
  Numero_Contrat?: string;
  Echeance?: string;
  Assure?: string;
}

export interface Ristourne {
  id?: number;
  numero_contrat: string;
  client: string;
  montant_ristourne: number;
  date_ristourne?: string;
  date_paiement_ristourne?: string;
  type_paiement?: 'Espece' | 'Cheque' | 'Banque';
  cree_par: string;
  created_at?: string;
}

export interface Sinistre {
  id?: number;
  numero_sinistre: string;
  montant: number;
  client: string;
  date_sinistre?: string;
  date_paiement_sinistre?: string;
  cree_par: string;
  created_at?: string;
}