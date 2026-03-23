import React, { useState } from 'react';
import { Calendar, Download, TrendingUp, DollarSign, FileText, CreditCard, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSession, getSessionDate } from '../utils/auth';
import * as XLSX from 'xlsx';
import DeleteMotifModal from './DeleteMotifModal';

interface Transaction {
  id: number;
  type: string;
  branche: string;
  numero_contrat: string;
  prime: number;
  assure: string;
  mode_paiement: string;
  type_paiement: string;
  montant_credit: number | null;
  montant: number;
  date_paiement_prevue: string | null;
  cree_par: string;
  created_at: string;
  echeance?: string;
  retour_type?: string | null;
  prime_avant_retour?: number | null;
  date_depense?: string | null;
  date_recette?: string | null;
  date_ristourne?: string | null;
  date_sinistre?: string | null;
  numero_sinistre?: string | null;
  numero_attestation?: string | null;
}

interface Statistics {
  totalTransactions: number;
  totalPrime: number;
  totalMontant: number;
  totalCredit: number;
  totalEspecesNet: number;
  totalCheque: number;
  totalDepenses: number;
  totalPaiementCredits: number;
  totalRistournes: number;
  totalSinistres: number;
  totalRecettes: number;
  countEspeces: number;
  countCheque: number;
  countDepenses: number;
  countPaiementCredits: number;
  countRistournes: number;
  countSinistres: number;
  countRecettes: number;
  countCredits: number;
  byBranche: { [key: string]: { montant: number; count: number } };
  byModePaiement: { [key: string]: { montant: number; count: number } };
  byTypePaiement: { [key: string]: { montant: number; count: number } };
  byType: { [key: string]: { montant: number; count: number } };
  byBanque: { [key: string]: { montant: number; count: number } };
}

const TransactionReport: React.FC = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<Transaction | null>(null);

  const calculateStatistics = (data: Transaction[]): Statistics => {
    const stats: Statistics = {
      totalTransactions: data.length,
      totalPrime: 0,
      totalMontant: 0,
      totalCredit: 0,
      totalEspecesNet: 0,
      totalCheque: 0,
      totalDepenses: 0,
      totalPaiementCredits: 0,
      totalRistournes: 0,
      totalSinistres: 0,
      totalRecettes: 0,
      countEspeces: 0,
      countCheque: 0,
      countDepenses: 0,
      countPaiementCredits: 0,
      countRistournes: 0,
      countSinistres: 0,
      countRecettes: 0,
      countCredits: 0,
      byBranche: {},
      byModePaiement: {},
      byTypePaiement: {},
      byType: {},
      byBanque: {}
    };

    data.forEach(transaction => {
      const prime = transaction.prime || 0;
      const montant = transaction.montant || 0;

      if (prime > 0) {
        stats.totalPrime += prime;
      }

      if (transaction.mode_paiement === 'Espece') {
        stats.totalMontant += montant;
      }

      if (transaction.montant_credit) {
        stats.totalCredit += transaction.montant_credit;
        stats.countCredits++;
      }

      if (transaction.mode_paiement === 'Espece' && montant > 0) {
        stats.countEspeces++;
        stats.totalEspecesNet += montant;
      }

      if (transaction.mode_paiement === 'Cheque' && montant > 0) {
        stats.totalCheque += montant;
        stats.countCheque++;
      }

      if (transaction.type === 'Dépense') {
        stats.totalDepenses += montant;
        stats.countDepenses++;
      }

      if (transaction.type === 'Paiement Crédit') {
        stats.totalPaiementCredits += montant;
        stats.countPaiementCredits++;
      }

      if (transaction.type === 'Ristourne') {
        stats.totalRistournes += montant;
        stats.countRistournes++;
      }

      if (transaction.type === 'Sinistre') {
        stats.totalSinistres += montant;
        stats.countSinistres++;
      }

      if (transaction.type === 'Recette') {
        stats.totalRecettes += montant;
        stats.countRecettes++;
      }

      if (!stats.byBranche[transaction.branche]) {
        stats.byBranche[transaction.branche] = { montant: 0, count: 0 };
      }
      stats.byBranche[transaction.branche].montant += prime;
      stats.byBranche[transaction.branche].count++;

      if (!stats.byModePaiement[transaction.mode_paiement]) {
        stats.byModePaiement[transaction.mode_paiement] = { montant: 0, count: 0 };
      }
      stats.byModePaiement[transaction.mode_paiement].montant += prime;
      stats.byModePaiement[transaction.mode_paiement].count++;

      if (!stats.byTypePaiement[transaction.type_paiement]) {
        stats.byTypePaiement[transaction.type_paiement] = { montant: 0, count: 0 };
      }
      if (transaction.type_paiement === 'Au comptant') {
        if (montant > 0) {
          stats.byTypePaiement[transaction.type_paiement].montant += montant;
          stats.byTypePaiement[transaction.type_paiement].count++;
        }
      } else if (transaction.type_paiement === 'Crédit') {
        stats.byTypePaiement[transaction.type_paiement].montant += (prime - montant);
        stats.byTypePaiement[transaction.type_paiement].count++;
      } else {
        stats.byTypePaiement[transaction.type_paiement].montant += prime;
        stats.byTypePaiement[transaction.type_paiement].count++;
      }

      if (!stats.byType[transaction.type]) {
        stats.byType[transaction.type] = { montant: 0, count: 0 };
      }
      stats.byType[transaction.type].montant += prime;
      stats.byType[transaction.type].count++;

      if (transaction.mode_paiement === 'Cheque' && transaction.type_paiement) {
        const banque = transaction.type_paiement || 'Non spécifié';
        if (!stats.byBanque[banque]) {
          stats.byBanque[banque] = { montant: 0, count: 0 };
        }
        stats.byBanque[banque].montant += montant;
        stats.byBanque[banque].count++;
      }
    });

    return stats;
  };

  const handleSearch = async () => {
    if (!dateFrom || !dateTo) {
      setError('Veuillez saisir les dates de début et de fin');
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      setError('La date de début doit être antérieure à la date de fin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('rapport')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const filteredData = (data || []).filter(transaction => {
        const transactionDateStr = transaction.created_at.split('T')[0];
        return transactionDateStr >= dateFrom && transactionDateStr <= dateTo;
      });

      const enrichedData = await Promise.all(
        filteredData.map(async (transaction) => {
          if (transaction.type === 'Terme' && transaction.numero_contrat && transaction.echeance) {
            try {
              const echeanceDate = new Date(transaction.echeance);
              const echeanceISO = echeanceDate.toISOString().split('T')[0];

              const { data: termeData, error: termeError } = await supabase
                .from('terme')
                .select('"Retour", "Prime avant retour", "Numero Attestation"')
                .eq('numero_contrat', transaction.numero_contrat)
                .eq('echeance', echeanceISO)
                .maybeSingle();

              if (termeError) {
                console.error('Erreur lors de la récupération des infos de retour:', termeError);
              }

              if (termeData) {
                return {
                  ...transaction,
                  retour_type: termeData.Retour || null,
                  prime_avant_retour: termeData['Prime avant retour'] || null,
                  numero_attestation: termeData['Numero Attestation'] || null
                };
              }
            } catch (error) {
              console.error('Erreur lors du traitement du retour:', error);
            }
          }

          if (transaction.type === 'Affaire' && transaction.numero_contrat) {
            try {
              const createdDate = new Date(transaction.created_at);
              const createdISO = createdDate.toISOString().split('T')[0];

              const { data: affaireData } = await supabase
                .from('affaire')
                .select('"Numero Attestation"')
                .eq('numero_contrat', transaction.numero_contrat)
                .gte('created_at', `${createdISO}T00:00:00`)
                .lt('created_at', `${createdISO}T23:59:59`)
                .maybeSingle();

              if (affaireData) {
                return {
                  ...transaction,
                  numero_attestation: affaireData['Numero Attestation'] || null
                };
              }
            } catch (error) {
              console.error('Erreur lors de la récupération du numéro d\'attestation affaire:', error);
            }
          }

          return transaction;
        })
      );

      setTransactions(enrichedData);
      setStatistics(calculateStatistics(enrichedData));
    } catch (err) {
      console.error('Erreur lors de la recherche:', err);
      setError('Erreur lors de la recherche des transactions');
    } finally {
      setLoading(false);
    }
  };

  const initiateDelete = (transaction: Transaction) => {
    setPendingDeleteTransaction(transaction);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirmed = async (motif: string) => {
    setDeleteModalOpen(false);
    if (!pendingDeleteTransaction) return;

    const transaction = pendingDeleteTransaction;
    setPendingDeleteTransaction(null);

    await performDelete(transaction, motif);
  };

  const handleDeleteCancelled = () => {
    setDeleteModalOpen(false);
    setPendingDeleteTransaction(null);
  };

  const resetAttestationStatut = async (numeroAttestation: string | null | undefined) => {
    if (!numeroAttestation) return;

    const attestationNum = parseInt(numeroAttestation);
    if (isNaN(attestationNum)) return;

    try {
      const { data: carnetTables, error: carnetError } = await supabase
        .rpc('check_attestation_disponible', { attestation_numero: attestationNum });

      if (carnetError || !carnetTables || carnetTables.length === 0) return;

      const carnetTable = carnetTables[0]?.carnet_table;
      if (!carnetTable) return;

      await supabase
        .from(carnetTable)
        .update({ statut: null })
        .eq('numero_attestation', numeroAttestation.toString());

      console.log(`✅ Attestation ${numeroAttestation} remise à null dans ${carnetTable}`);
    } catch (err) {
      console.error('Erreur lors de la remise à null de l\'attestation:', err);
    }
  };

  const saveToReportingSuppression = async (transaction: Transaction, motif: string) => {
    const session = getSession();
    const currentUser = session?.username || 'inconnu';
    const sessionDate = getSessionDate();

    const { error } = await supabase
      .from('reporting_suppression')
      .insert({
        rapport_id: transaction.id,
        type: transaction.type,
        branche: transaction.branche,
        numero_contrat: transaction.numero_contrat,
        prime: transaction.prime,
        assure: transaction.assure,
        mode_paiement: transaction.mode_paiement,
        type_paiement: transaction.type_paiement,
        montant_credit: transaction.montant_credit,
        montant: transaction.montant,
        echeance: transaction.echeance || null,
        date_paiement_prevue: transaction.date_paiement_prevue || null,
        cree_par: transaction.cree_par,
        created_at_original: transaction.created_at,
        motif_suppression: motif,
        supprime_par: currentUser,
        supprime_le: new Date().toISOString(),
        numero_attestation: transaction.numero_attestation || null,
        session_date: sessionDate
      });

    if (error) {
      console.error('Erreur lors de la sauvegarde dans reporting_suppression:', error);
    }
  };

  const performDelete = async (transaction: Transaction, motif: string) => {
    try {
      await saveToReportingSuppression(transaction, motif);

      let sourceDeleteSuccess = false;

      switch (transaction.type) {
        case 'Terme':
          if (transaction.numero_contrat && transaction.echeance) {
            const echeanceDate = new Date(transaction.echeance);
            const echeanceISO = echeanceDate.toISOString().split('T')[0];

            const { data: termeRow } = await supabase
              .from('terme')
              .select('"Numero Attestation"')
              .eq('numero_contrat', transaction.numero_contrat)
              .eq('echeance', echeanceISO)
              .maybeSingle();

            const { error: termeError } = await supabase
              .from('terme')
              .delete()
              .eq('numero_contrat', transaction.numero_contrat)
              .eq('echeance', echeanceISO);

            sourceDeleteSuccess = !termeError;
            if (termeError) console.error('Erreur suppression terme:', termeError);

            if (sourceDeleteSuccess) {
              const attestationNum = termeRow?.['Numero Attestation'] || transaction.numero_attestation;
              await resetAttestationStatut(attestationNum);
            }
          }
          break;

        case 'Affaire':
          if (transaction.numero_contrat) {
            const createdDate = new Date(transaction.created_at);
            const createdISO = createdDate.toISOString().split('T')[0];

            const { data: affaireRow } = await supabase
              .from('affaire')
              .select('"Numero Attestation"')
              .eq('numero_contrat', transaction.numero_contrat)
              .gte('created_at', `${createdISO}T00:00:00`)
              .lt('created_at', `${createdISO}T23:59:59`)
              .maybeSingle();

            const { error: affaireError } = await supabase
              .from('affaire')
              .delete()
              .eq('numero_contrat', transaction.numero_contrat)
              .gte('created_at', `${createdISO}T00:00:00`)
              .lt('created_at', `${createdISO}T23:59:59`);

            sourceDeleteSuccess = !affaireError;
            if (affaireError) console.error('Erreur suppression affaire:', affaireError);

            if (sourceDeleteSuccess) {
              const attestationNum = affaireRow?.['Numero Attestation'] || transaction.numero_attestation;
              await resetAttestationStatut(attestationNum);
            }
          }
          break;

        case 'Dépense':
          if (transaction.date_depense && transaction.montant) {
            const { data: matchingDepenses, error: findError } = await supabase
              .from('depenses')
              .select('*')
              .eq('date_depense', transaction.date_depense)
              .eq('montant', Math.abs(transaction.montant))
              .limit(1);

            if (!findError && matchingDepenses && matchingDepenses.length > 0) {
              const { error: depenseError } = await supabase
                .from('depenses')
                .delete()
                .eq('id', matchingDepenses[0].id);

              sourceDeleteSuccess = !depenseError;
              if (depenseError) console.error('Erreur suppression dépense:', depenseError);
            }
          }
          break;

        case 'Recette Exceptionnelle':
        case 'Recette':
          if (transaction.date_recette && transaction.montant) {
            const { data: matchingRecettes, error: findError } = await supabase
              .from('recettes_exceptionnelles')
              .select('*')
              .eq('date_recette', transaction.date_recette)
              .eq('montant', transaction.montant)
              .limit(1);

            if (!findError && matchingRecettes && matchingRecettes.length > 0) {
              const { error: recetteError } = await supabase
                .from('recettes_exceptionnelles')
                .delete()
                .eq('id', matchingRecettes[0].id);

              sourceDeleteSuccess = !recetteError;
              if (recetteError) console.error('Erreur suppression recette:', recetteError);
            }
          }
          break;

        case 'Ristourne':
          if (transaction.numero_contrat && transaction.date_ristourne) {
            const { data: matchingRistournes, error: findError } = await supabase
              .from('ristournes')
              .select('*')
              .eq('date_ristourne', transaction.date_ristourne);

            if (!findError && matchingRistournes && matchingRistournes.length > 0) {
              const ristourneToDelete = matchingRistournes.find(r =>
                r.numero_contrat?.trim() === transaction.numero_contrat?.trim() ||
                parseFloat(r.montant_ristourne) === Math.abs(transaction.montant)
              );

              if (ristourneToDelete) {
                const { error: ristourneError } = await supabase
                  .from('ristournes')
                  .delete()
                  .eq('id', ristourneToDelete.id);

                sourceDeleteSuccess = !ristourneError;
                if (ristourneError) console.error('Erreur suppression ristourne:', ristourneError);
              }
            }
          }
          break;

        case 'Sinistre':
          if (transaction.numero_sinistre && transaction.date_sinistre) {
            const { data: matchingSinistres, error: findError } = await supabase
              .from('sinistres')
              .select('*')
              .eq('date_sinistre', transaction.date_sinistre);

            if (!findError && matchingSinistres && matchingSinistres.length > 0) {
              const sinistreToDelete = matchingSinistres.find(s =>
                s.numero_sinistre?.trim() === transaction.numero_sinistre?.trim() ||
                Math.abs(parseFloat(s.montant)) === Math.abs(transaction.montant)
              );

              if (sinistreToDelete) {
                const { error: sinistreError } = await supabase
                  .from('sinistres')
                  .delete()
                  .eq('id', sinistreToDelete.id);

                sourceDeleteSuccess = !sinistreError;
                if (sinistreError) console.error('Erreur suppression sinistre:', sinistreError);
              }
            }
          }
          break;

        case 'Paiement Crédit':
          sourceDeleteSuccess = true;
          break;

        case 'Encaissement pour autre code':
          if (transaction.numero_contrat && transaction.echeance) {
            const { error: encaissementError } = await supabase
              .from('encaissement_autre_code')
              .delete()
              .eq('numero_contrat', transaction.numero_contrat)
              .eq('echeance', transaction.echeance);

            sourceDeleteSuccess = !encaissementError;
            if (encaissementError) console.error('Erreur suppression encaissement:', encaissementError);
          }
          break;

        case 'Avenant':
          if (transaction.numero_contrat) {
            const createdDate = new Date(transaction.created_at);
            const createdISO = createdDate.toISOString().split('T')[0];

            const { error: avenantError } = await supabase
              .from('Avenant_Changement_véhicule')
              .delete()
              .eq('numero_contrat', transaction.numero_contrat)
              .gte('created_at', `${createdISO}T00:00:00`)
              .lt('created_at', `${createdISO}T23:59:59`);

            sourceDeleteSuccess = !avenantError;
            if (avenantError) console.error('Erreur suppression avenant:', avenantError);
          }
          break;

        default:
          sourceDeleteSuccess = true;
      }

      const { error: rapportError } = await supabase
        .from('rapport')
        .delete()
        .eq('id', transaction.id);

      if (rapportError) {
        console.error('Erreur suppression rapport:', rapportError);
        setError('Erreur lors de la suppression de la transaction');
        return;
      }

      setError('');
      void sourceDeleteSuccess;
      handleSearch();
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression de la transaction');
    }
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      setError('Aucune transaction à exporter');
      return;
    }

    const exportData = transactions.map(t => ({
      'ID': t.id,
      'Type': t.type,
      'Retour': t.retour_type ? (t.retour_type === 'Technique' ? 'RT' : 'RCX') : '',
      'Branche': t.branche,
      'Numéro Contrat': t.numero_contrat,
      'Prime': t.prime,
      'Prime Avant Retour': t.prime_avant_retour || '',
      'Assuré': t.assure,
      'Mode Paiement': t.mode_paiement,
      'Type Paiement': t.type_paiement,
      'Montant Crédit': t.montant_credit || '',
      'Montant': t.montant,
      'Date Paiement Prévue': t.date_paiement_prevue || '',
      'Créé Par': t.cree_par,
      'Date Création': new Date(t.created_at).toLocaleString('fr-FR')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const fileName = `rapport_transactions_${dateFrom}_au_${dateTo}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleExportEspecesNet = () => {
    if (transactions.length === 0) {
      setError('Aucune transaction à exporter');
      return;
    }

    const especesTransactions = transactions.filter(t => t.mode_paiement === 'Espece' && t.montant > 0);

    if (especesTransactions.length === 0) {
      setError('Aucune transaction en espèces à exporter');
      return;
    }

    const exportData = especesTransactions.map(t => ({
      'ID': t.id,
      'Type': t.type,
      'Retour': t.retour_type ? (t.retour_type === 'Technique' ? 'RT' : 'RCX') : '',
      'Branche': t.branche,
      'Numéro Contrat': t.numero_contrat,
      'Prime': t.prime,
      'Prime Avant Retour': t.prime_avant_retour || '',
      'Assuré': t.assure,
      'Mode Paiement': t.mode_paiement,
      'Type Paiement': t.type_paiement,
      'Montant Crédit': t.montant_credit || '',
      'Montant': t.montant,
      'Date Paiement Prévue': t.date_paiement_prevue || '',
      'Créé Par': t.cree_par,
      'Date Création': new Date(t.created_at).toLocaleString('fr-FR')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Espèces');

    const fileName = `especes_net_${dateFrom}_au_${dateTo}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleExportCheques = () => {
    if (transactions.length === 0) {
      setError('Aucune transaction à exporter');
      return;
    }

    const chequeTransactions = transactions.filter(t => t.mode_paiement === 'Cheque' && t.montant > 0);

    if (chequeTransactions.length === 0) {
      setError('Aucune transaction en chèques à exporter');
      return;
    }

    const exportData = chequeTransactions.map(t => ({
      'ID': t.id,
      'Type': t.type,
      'Retour': t.retour_type ? (t.retour_type === 'Technique' ? 'RT' : 'RCX') : '',
      'Branche': t.branche,
      'Numéro Contrat': t.numero_contrat,
      'Prime': t.prime,
      'Prime Avant Retour': t.prime_avant_retour || '',
      'Assuré': t.assure,
      'Mode Paiement': t.mode_paiement,
      'Type Paiement': t.type_paiement,
      'Montant Crédit': t.montant_credit || '',
      'Montant': t.montant,
      'Date Paiement Prévue': t.date_paiement_prevue || '',
      'Créé Par': t.cree_par,
      'Date Création': new Date(t.created_at).toLocaleString('fr-FR')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chèques');

    const fileName = `cheques_${dateFrom}_au_${dateTo}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleExportByCategory = (category: string, categoryName: string) => {
    if (transactions.length === 0) {
      setError('Aucune transaction à exporter');
      return;
    }

    let filteredTransactions: Transaction[] = [];
    let sheetName = '';
    let fileName = '';

    switch (category) {
      case 'totalTransactions':
        filteredTransactions = transactions;
        sheetName = 'Transactions';
        fileName = `toutes_transactions_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      case 'totalPrime':
        filteredTransactions = transactions;
        sheetName = 'Primes';
        fileName = `primes_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      case 'totalMontant':
        filteredTransactions = transactions;
        sheetName = 'Montants';
        fileName = `montants_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      case 'totalCredit':
        filteredTransactions = transactions.filter(t => t.montant_credit);
        sheetName = 'Crédits';
        fileName = `credits_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      case 'totalDepenses':
        filteredTransactions = transactions.filter(t => t.type === 'Dépense');
        sheetName = 'Dépenses';
        fileName = `depenses_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      case 'totalPaiementCredits':
        filteredTransactions = transactions.filter(t => t.type === 'Paiement Crédit');
        sheetName = 'Paiements Crédits';
        fileName = `paiements_credits_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      case 'totalRistournes':
        filteredTransactions = transactions.filter(t => t.type === 'Ristourne');
        sheetName = 'Ristournes';
        fileName = `ristournes_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      case 'totalSinistres':
        filteredTransactions = transactions.filter(t => t.type === 'Sinistre');
        sheetName = 'Sinistres';
        fileName = `sinistres_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      case 'totalRecettes':
        filteredTransactions = transactions.filter(t => t.type === 'Recette');
        sheetName = 'Recettes';
        fileName = `recettes_${dateFrom}_au_${dateTo}.xlsx`;
        break;
      default:
        return;
    }

    if (filteredTransactions.length === 0) {
      setError(`Aucune transaction ${categoryName} à exporter`);
      return;
    }

    const exportData = filteredTransactions.map(t => ({
      'ID': t.id,
      'Type': t.type,
      'Retour': t.retour_type ? (t.retour_type === 'Technique' ? 'RT' : 'RCX') : '',
      'Branche': t.branche,
      'Numéro Contrat': t.numero_contrat,
      'Prime': t.prime,
      'Prime Avant Retour': t.prime_avant_retour || '',
      'Assuré': t.assure,
      'Mode Paiement': t.mode_paiement,
      'Type Paiement': t.type_paiement,
      'Montant Crédit': t.montant_credit || '',
      'Montant': t.montant,
      'Date Paiement Prévue': t.date_paiement_prevue || '',
      'Créé Par': t.cree_par,
      'Date Création': new Date(t.created_at).toLocaleString('fr-FR')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, fileName);
  };

  const formatCurrency = (amount: number) => {
    return `${new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(amount)} DT`;
  };

  const getTransactionInfo = (t: Transaction) => {
    const parts = [];
    if (t.numero_contrat) parts.push(`N° ${t.numero_contrat}`);
    if (t.assure) parts.push(t.assure);
    if (t.prime) parts.push(`${t.prime} DT`);
    if (t.echeance) parts.push(`Échéance: ${t.echeance}`);
    return parts.join(' - ');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Rapport de Transactions</h2>
              <p className="text-sm text-gray-500">Rechercher et analyser les transactions par date</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Calendar className="w-4 h-4" />
            <span>{loading ? 'Recherche...' : 'Rechercher'}</span>
          </button>
          {transactions.length > 0 && (
            <button
              onClick={handleExport}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Exporter</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
      </div>

      {statistics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => handleExportByCategory('totalTransactions', 'transactions')}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter toutes les transactions"
            >
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{statistics.totalTransactions}</span>
              </div>
              <p className="text-blue-100 text-xs font-medium flex items-center justify-between">
                <span>Total Transactions</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={() => handleExportByCategory('totalPrime', 'primes')}
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les primes"
            >
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalPrime)}</span>
              </div>
              <p className="text-green-100 text-xs font-medium flex items-center justify-between">
                <span>Total Primes</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={() => handleExportByCategory('totalMontant', 'montants')}
              className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les montants"
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                <span className="text-xl font-bold">{formatCurrency(statistics.totalMontant)}</span>
              </div>
              <p className="text-emerald-100 text-xs font-medium flex items-center justify-between">
                <span>Total Montants</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={() => handleExportByCategory('totalCredit', 'crédits')}
              className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les crédits"
            >
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="w-6 h-6 opacity-80" />
                <div className="text-right">
                  <span className="text-xl font-bold block">{formatCurrency(statistics.totalCredit)}</span>
                  <span className="text-sm opacity-90">({statistics.countCredits} crédits)</span>
                </div>
              </div>
              <p className="text-orange-100 text-xs font-medium flex items-center justify-between">
                <span>Total Crédits</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={handleExportEspecesNet}
              className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les transactions en espèces"
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                <div className="text-right">
                  <span className="text-xl font-bold block">{formatCurrency(statistics.totalEspecesNet)}</span>
                  <span className="text-sm opacity-90">({statistics.countEspeces} opérations)</span>
                </div>
              </div>
              <p className="text-teal-100 text-xs font-medium flex items-center justify-between">
                <span>Total Espèces Net</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={handleExportCheques}
              className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les chèques"
            >
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="w-6 h-6 opacity-80" />
                <div className="text-right">
                  <span className="text-xl font-bold block">{formatCurrency(statistics.totalCheque)}</span>
                  <span className="text-sm opacity-90">({statistics.countCheque} chèques)</span>
                </div>
              </div>
              <p className="text-cyan-100 text-xs font-medium flex items-center justify-between">
                <span>Total Chèque</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={() => handleExportByCategory('totalDepenses', 'dépenses')}
              className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les dépenses"
            >
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 opacity-80" />
                <div className="text-right">
                  <span className="text-xl font-bold block">{formatCurrency(statistics.totalDepenses)}</span>
                  <span className="text-sm opacity-90">({statistics.countDepenses} dépenses)</span>
                </div>
              </div>
              <p className="text-red-100 text-xs font-medium flex items-center justify-between">
                <span>Total Dépenses</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={() => handleExportByCategory('totalPaiementCredits', 'paiements crédits')}
              className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les paiements crédits"
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                <div className="text-right">
                  <span className="text-xl font-bold block">{formatCurrency(statistics.totalPaiementCredits)}</span>
                  <span className="text-sm opacity-90">({statistics.countPaiementCredits} paiements)</span>
                </div>
              </div>
              <p className="text-amber-100 text-xs font-medium flex items-center justify-between">
                <span>Total Paiement Crédits</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={() => handleExportByCategory('totalRistournes', 'ristournes')}
              className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les ristournes"
            >
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 opacity-80" />
                <div className="text-right">
                  <span className="text-xl font-bold block">{formatCurrency(statistics.totalRistournes)}</span>
                  <span className="text-sm opacity-90">({statistics.countRistournes} ristournes)</span>
                </div>
              </div>
              <p className="text-violet-100 text-xs font-medium flex items-center justify-between">
                <span>Total Ristournes</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={() => handleExportByCategory('totalSinistres', 'sinistres')}
              className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les sinistres"
            >
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-6 h-6 opacity-80" />
                <div className="text-right">
                  <span className="text-xl font-bold block">{formatCurrency(statistics.totalSinistres)}</span>
                  <span className="text-sm opacity-90">({statistics.countSinistres} sinistres)</span>
                </div>
              </div>
              <p className="text-pink-100 text-xs font-medium flex items-center justify-between">
                <span>Total Sinistres</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>

            <div
              onClick={() => handleExportByCategory('totalRecettes', 'recettes')}
              className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl shadow-sm p-4 text-white cursor-pointer hover:scale-105 transition-transform hover:shadow-lg"
              title="Cliquer pour exporter les recettes"
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                <div className="text-right">
                  <span className="text-xl font-bold block">{formatCurrency(statistics.totalRecettes)}</span>
                  <span className="text-sm opacity-90">({statistics.countRecettes} recettes)</span>
                </div>
              </div>
              <p className="text-sky-100 text-xs font-medium flex items-center justify-between">
                <span>Total Recettes</span>
                <Download className="w-4 h-4 opacity-70" />
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Branche</h3>
              <div className="space-y-3">
                {Object.entries(statistics.byBranche).map(([branche, data]) => (
                  <div key={branche} className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{branche}</span>
                    <div className="text-right">
                      <span className="text-blue-600 font-bold block">{formatCurrency(data.montant)}</span>
                      <span className="text-xs text-gray-500">({data.count} transactions)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Mode de Paiement</h3>
              <div className="space-y-3">
                {Object.entries(statistics.byModePaiement).map(([mode, data]) => (
                  <div key={mode} className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{mode}</span>
                    <div className="text-right">
                      <span className="text-green-600 font-bold block">{formatCurrency(data.montant)}</span>
                      <span className="text-xs text-gray-500">({data.count} transactions)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Type de Paiement</h3>
              <div className="space-y-3">
                {Object.entries(statistics.byTypePaiement).map(([type, data]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{type}</span>
                    <div className="text-right">
                      <span className="text-emerald-600 font-bold block">{formatCurrency(data.montant)}</span>
                      <span className="text-xs text-gray-500">({data.count} transactions)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Type</h3>
              <div className="space-y-3">
                {Object.entries(statistics.byType).map(([type, data]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{type}</span>
                    <div className="text-right">
                      <span className="text-orange-600 font-bold block">{formatCurrency(data.montant)}</span>
                      <span className="text-xs text-gray-500">({data.count} transactions)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {Object.keys(statistics.byBanque).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Par Banque (Chèques)</h3>
                <div className="space-y-3">
                  {Object.entries(statistics.byBanque).map(([banque, data]) => (
                    <div key={banque} className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">{banque}</span>
                      <div className="text-right">
                        <span className="text-cyan-600 font-bold block">{formatCurrency(data.montant)}</span>
                        <span className="text-xs text-gray-500">({data.count} chèques)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {transactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Branche</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">N° Contrat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assuré</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Prime</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Créé Par</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">{transaction.id}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'Terme' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {transaction.type}
                        </span>
                        {transaction.retour_type && (
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            transaction.retour_type === 'Technique'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {transaction.retour_type === 'Technique' ? 'RT' : 'RCX'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.branche}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{transaction.numero_contrat}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.assure}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(transaction.prime)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{formatCurrency(transaction.montant)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.mode_paiement}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type_paiement === 'Crédit' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {transaction.type_paiement}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.cree_par}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(transaction.created_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => initiateDelete(transaction)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        title="Supprimer cette transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && transactions.length === 0 && (dateFrom || dateTo) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune Transaction Trouvée</h3>
          <p className="text-gray-600">Aucune transaction n'a été trouvée pour la période sélectionnée</p>
        </div>
      )}

      <DeleteMotifModal
        isOpen={deleteModalOpen}
        transactionType={pendingDeleteTransaction?.type || ''}
        transactionInfo={pendingDeleteTransaction ? getTransactionInfo(pendingDeleteTransaction) : ''}
        onConfirm={handleDeleteConfirmed}
        onCancel={handleDeleteCancelled}
      />
    </div>
  );
};

export default TransactionReport;
