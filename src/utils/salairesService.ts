import { supabase } from '../lib/supabase';

export interface SalaireLoyer {
  id?: string;
  mois: string;
  statut: boolean;
  mode_liquidation: string | null;
  date_liquidation: string | null;
  created_at?: string;
  updated_at?: string;
}

export const getSalairesLoyers = async (startMonth: string, endMonth: string): Promise<SalaireLoyer[]> => {
  try {
    const { data, error } = await supabase
      .from('salaires_loyer')
      .select('*')
      .gte('mois', startMonth)
      .lte('mois', endMonth)
      .order('mois', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération des salaires/loyers:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erreur générale lors de la récupération des salaires/loyers:', error);
    return [];
  }
};

export const upsertSalaireLoyer = async (salaire: SalaireLoyer): Promise<boolean> => {
  try {
    const insertData: any = {
      mois: salaire.mois,
      statut: salaire.statut,
      mode_liquidation: salaire.statut ? salaire.mode_liquidation : null,
      date_liquidation: salaire.statut ? salaire.date_liquidation : null,
    };

    if (salaire.id) {
      insertData.id = salaire.id;
    }

    const { error } = await supabase
      .from('salaires_loyer')
      .upsert([insertData], {
        onConflict: 'mois'
      });

    if (error) {
      console.error('Erreur lors de la sauvegarde du salaire/loyer:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erreur générale lors de la sauvegarde du salaire/loyer:', error);
    return false;
  }
};

export const generateMonthsList = (startMonth: string, count: number): string[] => {
  const months: string[] = [];
  const [year, month] = startMonth.split('-').map(Number);

  for (let i = 0; i < count; i++) {
    const currentMonth = month + i;
    const currentYear = year + Math.floor((currentMonth - 1) / 12);
    const normalizedMonth = ((currentMonth - 1) % 12) + 1;

    const monthStr = `${currentYear}-${normalizedMonth.toString().padStart(2, '0')}`;
    months.push(monthStr);
  }

  return months;
};

export const formatMonthDisplay = (monthStr: string): string => {
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  return `${monthNames[parseInt(month) - 1]} ${year}`;
};

export const initializeMissingMonths = async (months: string[]): Promise<void> => {
  try {
    const existingData = await getSalairesLoyers(months[0], months[months.length - 1]);
    const existingMonths = new Set(existingData.map(s => s.mois));

    const missingMonths = months.filter(m => !existingMonths.has(m));

    if (missingMonths.length > 0) {
      const insertData = missingMonths.map(mois => ({
        mois,
        statut: false,
        mode_liquidation: null,
        date_liquidation: null
      }));

      const { error } = await supabase
        .from('salaires_loyer')
        .insert(insertData);

      if (error) {
        console.error('Erreur lors de l\'initialisation des mois manquants:', error);
      }
    }
  } catch (error) {
    console.error('Erreur générale lors de l\'initialisation des mois:', error);
  }
};
