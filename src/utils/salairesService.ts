import { supabase } from '../lib/supabase';

export interface SalaireLoyer {
  id?: string;
  mois: string;
  montant_salaires: number;
  statut_salaires: boolean;
  mode_liquidation_salaires: string | null;
  date_liquidation_salaires: string | null;
  montant_loyer: number;
  statut_loyer: boolean;
  mode_liquidation_loyer: string | null;
  date_liquidation_loyer: string | null;
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

const findQuinzaineForDate = async (dateLiquidation: string): Promise<{ annee: number; mois: number; quinzaine: number } | null> => {
  try {
    const liquidationDate = new Date(dateLiquidation);

    const { data, error } = await supabase
      .from('etat_commission')
      .select('*')
      .lte('date_debut', dateLiquidation)
      .gte('date_fin', dateLiquidation)
      .maybeSingle();

    if (error) {
      console.error('Erreur lors de la recherche de quinzaine:', error);
      return null;
    }

    if (data) {
      return {
        annee: data.annee,
        mois: data.mois,
        quinzaine: data.quinzaine
      };
    }

    return null;
  } catch (error) {
    console.error('Erreur générale lors de la recherche de quinzaine:', error);
    return null;
  }
};

const updateCommissionNette = async (
  annee: number,
  mois: number,
  quinzaine: number,
  montantSalaire: number,
  moisSalaire: string
): Promise<boolean> => {
  try {
    const { data: currentData, error: fetchError } = await supabase
      .from('etat_commission')
      .select('commission_nette, remarques')
      .eq('annee', annee)
      .eq('mois', mois)
      .eq('quinzaine', quinzaine)
      .maybeSingle();

    if (fetchError) {
      console.error('Erreur lors de la récupération de la commission:', fetchError);
      return false;
    }

    if (!currentData) {
      console.error('Quinzaine introuvable dans etat_commission');
      return false;
    }

    const nouvelleCommissionNette = (currentData.commission_nette || 0) - montantSalaire;

    const [anneeStr, moisStr] = moisSalaire.split('-');
    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const nomMois = moisNoms[parseInt(moisStr) - 1];
    const remarquesSalaire = `Salaires de ${nomMois} ${anneeStr} liquidé`;

    const remarquesExistantes = currentData.remarques ? currentData.remarques.split('\n') : [];
    if (!remarquesExistantes.includes(remarquesSalaire)) {
      remarquesExistantes.push(remarquesSalaire);
    }
    const nouvellesRemarques = remarquesExistantes.join('\n');

    const { error: updateError } = await supabase
      .from('etat_commission')
      .update({
        commission_nette: nouvelleCommissionNette,
        remarques: nouvellesRemarques,
        updated_at: new Date().toISOString()
      })
      .eq('annee', annee)
      .eq('mois', mois)
      .eq('quinzaine', quinzaine);

    if (updateError) {
      console.error('Erreur lors de la mise à jour de la commission nette:', updateError);
      return false;
    }

    console.log(`✅ Commission nette mise à jour: ${nouvelleCommissionNette.toFixed(3)} (${annee}-${mois} Q${quinzaine})`);
    console.log(`✅ Remarque ajoutée: ${remarquesSalaire}`);
    return true;
  } catch (error) {
    console.error('Erreur générale lors de la mise à jour de la commission nette:', error);
    return false;
  }
};

export const upsertSalaireLoyer = async (salaire: SalaireLoyer): Promise<boolean> => {
  try {
    const insertData: any = {
      mois: salaire.mois,
      montant_salaires: salaire.montant_salaires,
      statut_salaires: salaire.statut_salaires,
      mode_liquidation_salaires: salaire.statut_salaires ? salaire.mode_liquidation_salaires : null,
      date_liquidation_salaires: salaire.statut_salaires ? salaire.date_liquidation_salaires : null,
      montant_loyer: salaire.montant_loyer,
      statut_loyer: salaire.statut_loyer,
      mode_liquidation_loyer: salaire.statut_loyer ? salaire.mode_liquidation_loyer : null,
      date_liquidation_loyer: salaire.statut_loyer ? salaire.date_liquidation_loyer : null,
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

    if (salaire.statut_salaires &&
        salaire.date_liquidation_salaires &&
        salaire.mode_liquidation_salaires === 'Compensation sur commission') {

      console.log(`🔍 Recherche de la quinzaine pour la date ${salaire.date_liquidation_salaires}...`);

      const quinzaineInfo = await findQuinzaineForDate(salaire.date_liquidation_salaires);

      if (quinzaineInfo) {
        console.log(`✅ Quinzaine trouvée: ${quinzaineInfo.annee}-${quinzaineInfo.mois} Q${quinzaineInfo.quinzaine}`);

        await updateCommissionNette(
          quinzaineInfo.annee,
          quinzaineInfo.mois,
          quinzaineInfo.quinzaine,
          salaire.montant_salaires,
          salaire.mois
        );
      } else {
        console.warn('⚠️ Aucune quinzaine trouvée pour la date de liquidation');
      }
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
        montant_salaires: 0,
        statut_salaires: false,
        mode_liquidation_salaires: null,
        date_liquidation_salaires: null,
        montant_loyer: 0,
        statut_loyer: false,
        mode_liquidation_loyer: null,
        date_liquidation_loyer: null
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
