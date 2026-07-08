import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Gift, AlertTriangle, Save, Plus, Trash2, Search, Calendar, FileSpreadsheet } from 'lucide-react';
import { getSessionDate } from '../utils/auth';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { 
  saveDepense, 
  getDepenses, 
  saveRecetteExceptionnelle, 
  getRecettesExceptionnelles,
  saveRistourne,
  getRistournes,
  saveSinistre,
  getSinistres,
  checkRistourneExists,
  checkSinistreExists,
  type Depense,
  type RecetteExceptionnelle,
  type Ristourne,
  type Sinistre
} from '../utils/financialService';

interface FinancialManagementProps {
  username: string;
}

const FinancialManagement: React.FC<FinancialManagementProps> = ({ username }) => {
  const [activeSection, setActiveSection] = useState<'depenses' | 'recettes' | 'ristournes' | 'sinistres'>('depenses');
  
  // États pour les dépenses
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [newDepense, setNewDepense] = useState({
    type_depense: 'Frais Bureau',
    montant: '',
    date_depense: getSessionDate(),
    numero_contrat: '',
    client: '',
    libelle: '',
    date_recuperation_prevue: '',
    type_paiement: 'Espece',
    numero_cheque: '',
    titulaire_cheque: '',
    banque: '',
    date_encaissement_prevue: ''
  });
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [searchingContract, setSearchingContract] = useState(false);
  const [contractSearchMessage, setContractSearchMessage] = useState('');
  const [avanceData, setAvanceData] = useState<any>(null);
  const [avanceSearchMessage, setAvanceSearchMessage] = useState('');
  const [showDepensesRecuperables, setShowDepensesRecuperables] = useState(false);
  const [depensesRecuperables, setDepensesRecuperables] = useState<Depense[]>([]);

  // États pour les recettes exceptionnelles
  const [recettes, setRecettes] = useState<RecetteExceptionnelle[]>([]);
  const [newRecette, setNewRecette] = useState({
    type_recette: 'Hamza',
    montant: '',
    date_recette: getSessionDate(),
    numero_contrat: '',
    echeance: '',
    assure: '',
    id_depense: '',
    libelle: ''
  });

  // États pour les ristournes
  const [ristournes, setRistournes] = useState<Ristourne[]>([]);
  const [newRistourne, setNewRistourne] = useState({
    numero_contrat: '',
    client: '',
    montant_ristourne: '',
    date_ristourne: new Date().toISOString().split('T')[0],
    date_paiement_ristourne: getSessionDate(),
    type_paiement: 'Espece' as 'Espece' | 'Cheque' | 'Banque' | 'Siege',
    type_ristourne: 'Ristourne' as 'BNS' | 'Ristourne'
  });
  const [ristourneDateFilter, setRistourneDateFilter] = useState({
    dateFrom: '',
    dateTo: ''
  });
  const [showRistourneDateFilter, setShowRistourneDateFilter] = useState(false);
  const [ristourneCheckMessage, setRistourneCheckMessage] = useState('');

  // État pour la recherche AvenantPDF
  const [showRistourneSearch, setShowRistourneSearch] = useState(false);
  const [ristourneSearchInput, setRistourneSearchInput] = useState({ numContrat: '', date: '' });
  const [ristourneSearching, setRistourneSearching] = useState(false);
  const [foundAvenantId, setFoundAvenantId] = useState<number | null>(null);
  const [ristourneFieldsLocked, setRistourneFieldsLocked] = useState(false);

  // État pour le panneau AvenantPDF (liste ristournes PDF)
  const [showAvenantPDFPanel, setShowAvenantPDFPanel] = useState(true);
  const [avenantPDFList, setAvenantPDFList] = useState<any[]>([]);
  const [avenantPDFLoading, setAvenantPDFLoading] = useState(false);
  const [avenantPDFPage, setAvenantPDFPage] = useState(1);
  const [avenantPDFTotal, setAvenantPDFTotal] = useState(0);
  const [avenantPDFDateFilter, setAvenantPDFDateFilter] = useState({ dateFrom: '', dateTo: '' });
  const [avenantPDFPaidCount, setAvenantPDFPaidCount] = useState(0);
  const [avenantPDFUnpaidCount, setAvenantPDFUnpaidCount] = useState(0);
  const [avenantPDFPaidAmount, setAvenantPDFPaidAmount] = useState(0);
  const [avenantPDFUnpaidAmount, setAvenantPDFUnpaidAmount] = useState(0);

  // États pour les sinistres
  const [sinistres, setSinistres] = useState<Sinistre[]>([]);
  const [newSinistre, setNewSinistre] = useState({
    numero_sinistre: '',
    montant: '',
    client: '',
    date_sinistre: new Date().toISOString().split('T')[0],
    date_paiement_sinistre: getSessionDate(),
    type_paiement: 'Espece' as 'Espece' | 'Cheque' | 'Banque'
  });
  const [sinistreDateFilter, setSinistreDateFilter] = useState({
    dateFrom: getSessionDate(),
    dateTo: getSessionDate()
  });
  const [showSinistreDateFilter, setShowSinistreDateFilter] = useState(false);

  // États pour le panneau SinistrePDF
  const [showSinistrePDFPanel, setShowSinistrePDFPanel] = useState(true);
  const [sinistrePDFList, setSinistrePDFList] = useState<any[]>([]);
  const [sinistrePDFLoading, setSinistrePDFLoading] = useState(false);
  const [sinistrePDFPage, setSinistrePDFPage] = useState(1);
  const [sinistrePDFTotal, setSinistrePDFTotal] = useState(0);
  const [sinistrePDFDateFilter, setSinistrePDFDateFilter] = useState({ dateFrom: '', dateTo: '' });
  const [sinistrePDFPaidCount, setSinistrePDFPaidCount] = useState(0);
  const [sinistrePDFUnpaidCount, setSinistrePDFUnpaidCount] = useState(0);
  const [sinistrePDFPaidAmount, setSinistrePDFPaidAmount] = useState(0);
  const [sinistrePDFUnpaidAmount, setSinistrePDFUnpaidAmount] = useState(0);

  // États pour la recherche SinistrPDF
  const [showSinistreSearch, setShowSinistreSearch] = useState(false);
  const [sinistreSearchNumero, setSinistreSearchNumero] = useState('');
  const [sinistreSearching, setSinistreSearching] = useState(false);
  const [foundSinistrePDFId, setFoundSinistrePDFId] = useState<number | null>(null);
  const [sinistreFieldsLocked, setSinistreFieldsLocked] = useState(false);

  // États pour les recettes exceptionnelles - filtres de date
  const [recetteDateFilter, setRecetteDateFilter] = useState({
    dateFrom: getSessionDate(),
    dateTo: getSessionDate()
  });
  const [showRecetteDateFilter, setShowRecetteDateFilter] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const sections = [
    { id: 'depenses', label: 'Dépenses', icon: TrendingDown, color: 'red' },
    { id: 'recettes', label: 'Recettes Exceptionnelles', icon: TrendingUp, color: 'green' },
    { id: 'ristournes', label: 'Ristournes', icon: Gift, color: 'purple' },
    { id: 'sinistres', label: 'Sinistres', icon: AlertTriangle, color: 'orange' }
  ];

  useEffect(() => {
    loadData();
    if (activeSection === 'ristournes') {
      loadAvenantPDF(1, avenantPDFDateFilter.dateFrom, avenantPDFDateFilter.dateTo);
    }
    if (activeSection === 'sinistres') {
      loadSinistrePDF(1, sinistrePDFDateFilter.dateFrom, sinistrePDFDateFilter.dateTo);
    }
  }, [activeSection, monthFilter]);

  useEffect(() => {
    loadAvailableMonths();
  }, [activeSection]);

  const loadAvailableMonths = async () => {
    if (activeSection !== 'depenses') return;

    try {
      const { data, error } = await supabase
        .from('depenses')
        .select('created_at');

      if (error) throw error;

      const months = new Set<string>();
      data?.forEach(item => {
        if (item.created_at) {
          const month = item.created_at.substring(0, 7);
          months.add(month);
        }
      });

      setAvailableMonths(Array.from(months).sort().reverse());
    } catch (error) {
      console.error('Erreur lors du chargement des mois:', error);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      switch (activeSection) {
        case 'depenses':
          let depensesData = await getDepenses();

          // Filtrer par date de session si "all", sinon par mois sélectionné
          // Utiliser date_depense en priorité (Hamza peut entrer une date antérieure), sinon created_at
          if (monthFilter === 'all') {
            const sessionDate = getSessionDate();
            depensesData = depensesData.filter(d => {
              const dateRef = d.date_depense || (d.created_at ? d.created_at.split('T')[0] : null);
              return dateRef && dateRef === sessionDate;
            });
          } else {
            depensesData = depensesData.filter(d => {
              const dateRef = d.date_depense || (d.created_at ? d.created_at.split('T')[0] : null);
              return dateRef && dateRef.startsWith(monthFilter);
            });
          }

          setDepenses(depensesData);
          break;
        case 'recettes':
          let recettesData = await getRecettesExceptionnelles();

          // Filtrer par date de session ou par plage de dates
          if (showRecetteDateFilter && recetteDateFilter.dateFrom && recetteDateFilter.dateTo) {
            // Filtre par plage de dates
            recettesData = recettesData.filter(r => {
              if (!r.created_at) return false;
              const createdDate = r.created_at.split('T')[0];
              return createdDate >= recetteDateFilter.dateFrom && createdDate <= recetteDateFilter.dateTo;
            });
          } else {
            // Filtre par date de session (par défaut)
            const sessionDate = getSessionDate();
            recettesData = recettesData.filter(r =>
              r.created_at && r.created_at.startsWith(sessionDate)
            );
          }

          setRecettes(recettesData);
          break;
        case 'ristournes':
          let ristournesData = await getRistournes();

          // Filtrer par date de session ou par plage de dates
          if (showRistourneDateFilter && ristourneDateFilter.dateFrom && ristourneDateFilter.dateTo) {
            // Filtre par plage de dates
            ristournesData = ristournesData.filter(r => {
              if (!r.created_at) return false;
              const createdDate = r.created_at.split('T')[0];
              return createdDate >= ristourneDateFilter.dateFrom && createdDate <= ristourneDateFilter.dateTo;
            });
          } else {
            // Filtre par date de session (par défaut)
            const sessionDate = getSessionDate();
            ristournesData = ristournesData.filter(r =>
              r.created_at && r.created_at.startsWith(sessionDate)
            );
          }

          setRistournes(ristournesData);
          break;
        case 'sinistres':
          let sinistresData = await getSinistres();

          // Filtrer par date de session ou par plage de dates
          if (showSinistreDateFilter && sinistreDateFilter.dateFrom && sinistreDateFilter.dateTo) {
            // Filtre par plage de dates
            sinistresData = sinistresData.filter(s => {
              if (!s.created_at) return false;
              const createdDate = s.created_at.split('T')[0];
              return createdDate >= sinistreDateFilter.dateFrom && createdDate <= sinistreDateFilter.dateTo;
            });
          } else {
            // Filtre par date de session (par défaut)
            const sessionDate = getSessionDate();
            sinistresData = sinistresData.filter(s =>
              s.created_at && s.created_at.startsWith(sessionDate)
            );
          }

          setSinistres(sinistresData);
          break;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
    setIsLoading(false);
  };

  const handleSearchContract = async () => {
    if (!newDepense.numero_contrat) {
      setContractSearchMessage('Veuillez saisir un numéro de contrat');
      return;
    }

    setSearchingContract(true);
    setContractSearchMessage('');

    try {
      const sessionDate = getSessionDate();

      const { data, error } = await supabase
        .from('rapport')
        .select('numero_contrat, assure, created_at')
        .eq('numero_contrat', newDepense.numero_contrat)
        .gte('created_at', sessionDate)
        .lt('created_at', sessionDate + 'T23:59:59')
        .maybeSingle();

      if (error) {
        console.error('Erreur recherche contrat:', error);
        setContractSearchMessage('❌ Erreur lors de la recherche');
        setSearchingContract(false);
        return;
      }

      if (data) {
        setNewDepense(prev => ({
          ...prev,
          client: data.assure
        }));
        setContractSearchMessage('✅ Contrat trouvé: ' + data.assure);
      } else {
        setContractSearchMessage('❌ Aucun contrat trouvé pour ce numéro à la date de session actuelle');
        setNewDepense(prev => ({
          ...prev,
          client: ''
        }));
      }
    } catch (error) {
      console.error('Erreur:', error);
      setContractSearchMessage('❌ Erreur lors de la recherche');
    }

    setSearchingContract(false);
    setTimeout(() => setContractSearchMessage(''), 5000);
  };

  const handleDeleteDepense = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('depenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage('✅ Dépense supprimée avec succès');
      loadData();
      loadAvailableMonths();
    } catch (error) {
      console.error('Erreur suppression:', error);
      setMessage('❌ Erreur lors de la suppression');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const handleSearchAvance = async () => {
    if (!newDepense.numero_contrat) {
      setAvanceSearchMessage('Veuillez saisir un numéro de contrat');
      return;
    }

    setSearchingContract(true);
    setAvanceSearchMessage('');
    setAvanceData(null);

    try {
      const { data: avance, error: avanceError } = await supabase
        .from('recettes_exceptionnelles')
        .select('*')
        .eq('Numero_Contrat', newDepense.numero_contrat)
        .eq('type_recette', 'Avance Client')
        .maybeSingle();

      if (avanceError) throw avanceError;

      if (!avance) {
        setAvanceSearchMessage('❌ Aucune avance trouvée pour ce contrat');
        setSearchingContract(false);
        return;
      }

      if (avance.Statut === 'Liquidée') {
        setAvanceSearchMessage('❌ Cette avance est déjà liquidée');
        setSearchingContract(false);
        return;
      }

      setAvanceData(avance);
      setNewDepense({
        ...newDepense,
        client: avance.Assure || ''
      });
      setAvanceSearchMessage(`✅ Avance trouvée: ${avance.Assure} - ${avance.montant} DT - Échéance: ${avance.Echeance}`);
    } catch (error) {
      console.error('Erreur lors de la recherche de l\'avance:', error);
      setAvanceSearchMessage('❌ Erreur lors de la recherche');
    } finally {
      setSearchingContract(false);
    }
  };

  const loadDepensesRecuperables = async () => {
    try {
      const { data, error } = await supabase
        .from('depenses')
        .select('*')
        .eq('type_depense', 'Depense Recuperable')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDepensesRecuperables(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des dépenses récupérables:', error);
    }
  };

  const handleMarquerDepensePayee = async (depenseId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir marquer cette dépense comme payée/soldée ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('depenses')
        .update({ statut_depense: 'Payé' })
        .eq('id', depenseId);

      if (error) throw error;

      setMessage('✅ Dépense marquée comme payée et soldée avec succès');
      loadDepensesRecuperables();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      setMessage('❌ Erreur lors de la mise à jour du statut');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const handleSearchDepense = async () => {
    if (!newRecette.id_depense) {
      setMessage('Veuillez saisir un ID de dépense');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('depenses')
        .select('*')
        .eq('id', parseInt(newRecette.id_depense))
        .eq('type_depense', 'Depense Recuperable')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setMessage('❌ Aucune dépense récupérable trouvée avec cet ID');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      if (data.statut_depense === 'Payé') {
        setMessage('❌ Cette dépense est déjà payée');
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      setNewRecette({
        ...newRecette,
        montant: data.montant.toString(),
        libelle: data.libelle || ''
      });
      setMessage(`✅ Dépense trouvée: ${data.libelle} - ${data.montant} DT`);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Erreur lors de la recherche de la dépense:', error);
      setMessage('❌ Erreur lors de la recherche');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleSaveDepense = async () => {
    if (!newDepense.montant) {
      setMessage('Veuillez saisir un montant');
      return;
    }

    if (newDepense.type_depense === 'Depense Recuperable') {
      if (!newDepense.libelle || !newDepense.date_recuperation_prevue) {
        setMessage('Veuillez saisir le libellé et la date de récupération prévue');
        return;
      }
    }

    if (newDepense.type_depense === 'Remise') {
      if (!newDepense.numero_contrat || !newDepense.client) {
        setMessage('Veuillez rechercher et valider un contrat pour la remise');
        return;
      }
      if (newDepense.type_paiement === 'Cheque') {
        if (!newDepense.numero_cheque || !newDepense.titulaire_cheque || !newDepense.banque || !newDepense.date_encaissement_prevue) {
          setMessage('Veuillez remplir tous les champs du chèque');
          return;
        }
      }
      console.log('📝 Tentative d\'enregistrement d\'une remise:', newDepense);
    }

    if (newDepense.type_depense === 'Reprise sur Avance Client') {
      if (!avanceData) {
        setMessage('Veuillez rechercher et valider l\'avance avant d\'enregistrer');
        return;
      }

      try {
        // Chercher tout terme pour ce contrat dans rapport (comptant ou crédit)
        const { data: termeRapport } = await supabase
          .from('rapport')
          .select('id, type, type_paiement')
          .eq('numero_contrat', avanceData.Numero_Contrat)
          .in('type', ['Terme', 'Paiement Crédit'])
          .limit(1);

        const termeExiste = termeRapport && termeRapport.length > 0;

        if (!termeExiste) {
          setMessage('❌ Aucun terme trouvé pour ce contrat dans les opérations enregistrées');
          setTimeout(() => setMessage(''), 5000);
          return;
        }

        const { error: updateError } = await supabase
          .from('recettes_exceptionnelles')
          .update({ Statut: 'Liquidée' })
          .eq('id', avanceData.id);

        if (updateError) throw updateError;
      } catch (error) {
        console.error('Erreur lors de la vérification du terme:', error);
        setMessage('❌ Erreur lors de la vérification du paiement');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    }

    const depense: Depense = {
      type_depense: newDepense.type_depense,
      montant: parseFloat(newDepense.montant),
      date_depense: newDepense.date_depense,
      cree_par: username,
      ...((newDepense.type_depense === 'Remise' || newDepense.type_depense === 'Reprise sur Avance Client') && {
        Numero_Contrat: newDepense.numero_contrat,
        Client: newDepense.client
      }),
      ...(newDepense.type_depense === 'Remise' && {
        type_paiement: newDepense.type_paiement
      }),
      ...(newDepense.type_depense === 'Depense Recuperable' && {
        libelle: newDepense.libelle,
        date_recuperation_prevue: newDepense.date_recuperation_prevue
      })
    };

    const success = await saveDepense(depense);
    if (success) {
      if (newDepense.type_depense === 'Remise' && newDepense.type_paiement === 'Cheque') {
        try {
          const { error: chequeError } = await supabase
            .from('Cheques')
            .insert([{
              Numero_Contrat: newDepense.numero_contrat,
              Assure: newDepense.client,
              Numero_Cheque: parseFloat(newDepense.numero_cheque),
              Titulaire_Cheque: newDepense.titulaire_cheque,
              Montant: parseFloat(newDepense.montant),
              Banque: newDepense.banque,
              Date_Encaissement_prévue: newDepense.date_encaissement_prevue,
              Statut: 'Non encaissé'
            }]);

          if (chequeError) {
            console.error('Erreur lors de l\'enregistrement du chèque:', chequeError);
            setMessage('⚠️ Dépense enregistrée mais erreur lors de l\'enregistrement du chèque');
          } else {
            setMessage('✅ Dépense et chèque enregistrés avec succès');
          }
        } catch (error) {
          console.error('Erreur lors de l\'enregistrement du chèque:', error);
          setMessage('⚠️ Dépense enregistrée mais erreur lors de l\'enregistrement du chèque');
        }
      } else {
        setMessage('✅ Dépense enregistrée avec succès');
      }

      console.log('✅ Dépense enregistrée avec succès, type:', depense.type_depense);
      setNewDepense({
        type_depense: 'Frais Bureau',
        montant: '',
        date_depense: getSessionDate(),
        numero_contrat: '',
        client: '',
        libelle: '',
        date_recuperation_prevue: '',
        type_paiement: 'Espece',
        numero_cheque: '',
        titulaire_cheque: '',
        banque: '',
        date_encaissement_prevue: ''
      });
      setContractSearchMessage('');
      setAvanceSearchMessage('');
      setAvanceData(null);
      loadData();
      loadAvailableMonths();
    } else {
      setMessage('❌ Erreur lors de l\'enregistrement de la dépense');
      console.error('❌ Erreur lors de l\'enregistrement de la dépense, type:', depense.type_depense);
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSaveRecette = async () => {
    if (!newRecette.montant) {
      setMessage('Veuillez saisir un montant');
      return;
    }

    if (newRecette.type_recette === 'Recuperation Depense') {
      if (!newRecette.id_depense || !newRecette.libelle) {
        setMessage('Veuillez rechercher et valider la dépense récupérable');
        return;
      }
    }

    if (newRecette.type_recette === 'Avance Client') {
      if (!newRecette.numero_contrat || !newRecette.echeance || !newRecette.assure) {
        setMessage('Veuillez saisir le numéro de contrat, l\'échéance et l\'assuré pour une avance client');
        return;
      }
    }

    const recette: RecetteExceptionnelle = {
      type_recette: newRecette.type_recette,
      montant: parseFloat(newRecette.montant),
      date_recette: newRecette.date_recette,
      cree_par: username,
      ...(newRecette.type_recette === 'Avance Client' && {
        Numero_Contrat: newRecette.numero_contrat,
        Echeance: newRecette.echeance,
        Assure: newRecette.assure
      }),
      ...(newRecette.type_recette === 'Recuperation Depense' && {
        id_depense: parseInt(newRecette.id_depense),
        libelle: newRecette.libelle
      })
    };

    const success = await saveRecetteExceptionnelle(recette);
    if (success) {
      if (newRecette.type_recette === 'Recuperation Depense' && newRecette.id_depense) {
        try {
          const { error: updateError } = await supabase
            .from('depenses')
            .update({ statut_depense: 'Payé' })
            .eq('id', parseInt(newRecette.id_depense));

          if (updateError) {
            console.error('Erreur lors de la mise à jour du statut de la dépense:', updateError);
          }
        } catch (error) {
          console.error('Erreur:', error);
        }
      }

      setMessage('✅ Recette exceptionnelle enregistrée avec succès');
      setNewRecette({
        type_recette: 'Hamza',
        montant: '',
        date_recette: getSessionDate(),
        numero_contrat: '',
        echeance: '',
        assure: '',
        id_depense: '',
        libelle: ''
      });
      loadData();
      if (showDepensesRecuperables) {
        loadDepensesRecuperables();
      }
    } else {
      setMessage('❌ Erreur lors de l\'enregistrement de la recette');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSearchSinistre = async () => {
    if (!sinistreSearchNumero) {
      alert('Veuillez saisir un numéro de sinistre.');
      return;
    }

    setSinistreSearching(true);
    try {
      const { data, error } = await supabase
        .from('SinistrPDF')
        .select('id, NumSinistre, souscripteur, MontantSinistre, "Statut de paiement", "Date de paiement"')
        .eq('NumSinistre', sinistreSearchNumero)
        .maybeSingle();

      if (error) {
        alert('Erreur lors de la recherche.');
        return;
      }

      if (!data) {
        alert('Aucun sinistre trouvé avec ce numéro.');
        return;
      }

      const statut = data['Statut de paiement'];
      if (statut && statut.toLowerCase() === 'payé') {
        const datePaiement = data['Date de paiement']
          ? new Date(data['Date de paiement']).toLocaleDateString('fr-FR')
          : 'date inconnue';
        alert(`Ce sinistre est déjà payé le ${datePaiement} — impossible de faire le paiement une deuxième fois`);
        return;
      }

      setFoundSinistrePDFId(data.id);
      setNewSinistre(prev => ({
        ...prev,
        numero_sinistre: data.NumSinistre || '',
        client: data.souscripteur || '',
        montant: data.MontantSinistre != null ? String(data.MontantSinistre) : '',
      }));
      setSinistreFieldsLocked(true);
      setShowSinistreSearch(false);
      setSinistreSearchNumero('');
    } finally {
      setSinistreSearching(false);
    }
  };

  const handleSearchRistourne = async () => {
    if (!ristourneSearchInput.numContrat || !ristourneSearchInput.date) {
      alert('Veuillez saisir le numéro de contrat et la date de ristourne.');
      return;
    }

    setRistourneSearching(true);
    try {
      const { data, error } = await supabase
        .from('AvenantPDF')
        .select('id, numContrat, souscripteur, primeEmise, "Date", "Statut de paiement", "Mode de paiement", "Date de paiement"')
        .eq('numContrat', ristourneSearchInput.numContrat)
        .eq('Date', ristourneSearchInput.date)
        .maybeSingle();

      if (error) {
        alert('Erreur lors de la recherche.');
        return;
      }

      if (!data) {
        alert('Aucune ristourne trouvée avec ce numéro de contrat et cette date.');
        return;
      }

      const statut = data['Statut de paiement'];
      if (statut && statut.toLowerCase() === 'payé') {
        const datePaiement = data['Date de paiement']
          ? new Date(data['Date de paiement']).toLocaleDateString('fr-FR')
          : '-';
        const modePaiement = data['Mode de paiement'] || '-';
        alert(`Cette ristourne est déjà payée.\nMode de paiement : ${modePaiement}\nDate de paiement : ${datePaiement}`);
        return;
      }

      setFoundAvenantId(data.id);
      setNewRistourne(prev => ({
        ...prev,
        numero_contrat: data.numContrat || '',
        client: data.souscripteur || '',
        montant_ristourne: data.primeEmise != null ? String(data.primeEmise) : '',
        date_ristourne: data['Date'] || prev.date_ristourne
      }));
      setRistourneFieldsLocked(true);
      setShowRistourneSearch(false);
    } finally {
      setRistourneSearching(false);
    }
  };

  const handleDeleteRistourne = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette ristourne ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ristournes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage('✅ Ristourne supprimée avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      setMessage('❌ Erreur lors de la suppression');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const handleSaveRistourne = async () => {
    if (!newRistourne.numero_contrat || !newRistourne.client || !newRistourne.montant_ristourne) {
      setMessage('Veuillez remplir tous les champs');
      return;
    }

    setRistourneCheckMessage('');

    // Vérifier si le contrat existe déjà dans la table ristournes
    try {
      const { data: existingRistourne, error } = await supabase
        .from('ristournes')
        .select('numero_contrat, type_paiement, created_at')
        .eq('numero_contrat', newRistourne.numero_contrat)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur vérification ristourne:', error);
        setMessage('❌ Erreur lors de la vérification');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      if (existingRistourne) {
        const dateCreation = new Date(existingRistourne.created_at).toLocaleDateString('fr-FR');
        const messageText = `Cette ristourne est payée en ${existingRistourne.type_paiement} en date du ${dateCreation}`;
        setRistourneCheckMessage('⚠️ ' + messageText);
        setMessage('⚠️ ' + messageText);
        setTimeout(() => {
          setMessage('');
          setRistourneCheckMessage('');
        }, 8000);
        return;
      }
    } catch (error) {
      console.error('Erreur:', error);
      setMessage('❌ Erreur lors de la vérification');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const ristourne: Ristourne = {
      numero_contrat: newRistourne.numero_contrat,
      client: newRistourne.client,
      montant_ristourne: parseFloat(newRistourne.montant_ristourne),
      date_paiement_ristourne: newRistourne.date_paiement_ristourne,
      date_ristourne: newRistourne.date_ristourne,
      type_paiement: newRistourne.type_paiement as any,
      cree_par: username
    };

    const success = await saveRistourne(ristourne);
    if (success) {
      // Mettre à jour le statut dans AvenantPDF si une ristourne a été trouvée via la recherche
      if (foundAvenantId !== null) {
        await supabase
          .from('AvenantPDF')
          .update({
            'Statut de paiement': 'Payé',
            'Mode de paiement': newRistourne.type_paiement,
            'Date de paiement': newRistourne.date_paiement_ristourne
          })
          .eq('id', foundAvenantId);
      }

      setMessage('✅ Ristourne enregistrée avec succès');
      setNewRistourne({
        numero_contrat: '',
        client: '',
        montant_ristourne: '',
        date_ristourne: new Date().toISOString().split('T')[0],
        date_paiement_ristourne: getSessionDate(),
        type_paiement: 'Espece',
        type_ristourne: 'Ristourne'
      });
      setRistourneCheckMessage('');
      setFoundAvenantId(null);
      setRistourneFieldsLocked(false);
      setRistourneSearchInput({ numContrat: '', date: '' });
      loadData();
    } else {
      setMessage('❌ Erreur lors de l\'enregistrement de la ristourne');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSaveSinistre = async () => {
    if (!newSinistre.numero_sinistre || !newSinistre.client || !newSinistre.montant) {
      setMessage('Veuillez remplir tous les champs');
      return;
    }

    const exists = await checkSinistreExists(newSinistre.numero_sinistre);
    if (exists) {
      setMessage('❌ Ce numéro de sinistre existe déjà');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const sinistre: Sinistre = {
      numero_sinistre: newSinistre.numero_sinistre,
      montant: parseFloat(newSinistre.montant),
      client: newSinistre.client,
      date_sinistre: new Date().toISOString().split('T')[0],
      date_paiement_sinistre: newSinistre.date_paiement_sinistre,
      type_paiement: newSinistre.type_paiement,
      cree_par: username
    };

    const success = await saveSinistre(sinistre);
    if (success) {
      if (foundSinistrePDFId !== null) {
        await supabase
          .from('SinistrPDF')
          .update({
            'Mode de paiement': newSinistre.type_paiement,
            'Date de paiement': newSinistre.date_paiement_sinistre,
            'Statut de paiement': 'Payé'
          })
          .eq('id', foundSinistrePDFId);
      }

      setMessage('✅ Sinistre enregistré avec succès');
      setNewSinistre({
        numero_sinistre: '',
        montant: '',
        client: '',
        date_sinistre: new Date().toISOString().split('T')[0],
        date_paiement_sinistre: getSessionDate(),
        type_paiement: 'Espece'
      });
      setFoundSinistrePDFId(null);
      setSinistreFieldsLocked(false);
      setSinistreSearchNumero('');
      loadData();
      loadSinistrePDF(1, sinistrePDFDateFilter.dateFrom, sinistrePDFDateFilter.dateTo);
    } else {
      setMessage('❌ Erreur lors de l\'enregistrement du sinistre');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const renderDepensesContent = () => (
    <div className="bg-red-50 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-red-800">Gestion des Dépenses</h3>
        <button
          onClick={exportDepenses}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Exporter Excel</span>
        </button>
      </div>
      
      {/* Formulaire de saisie */}
      <div className="bg-white rounded-lg p-4 mb-6 border border-red-200">
        <h4 className="font-medium text-red-700 mb-4">Nouvelle Dépense</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de dépense</label>
            <select
              value={newDepense.type_depense}
              onChange={(e) => setNewDepense({...newDepense, type_depense: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="Frais Bureau">Frais Bureau</option>
              <option value="Frais de Ménage">Frais de Ménage</option>
              <option value="STEG">STEG</option>
              <option value="SONED">SONED</option>
              <option value="A/S Ahlem">A/S Ahlem</option>
              <option value="A/S Rouae">A/S Rouae</option>
              <option value="Reprise sur Avance Client">Reprise sur Avance Client</option>
              <option value="Versement Bancaire">Versement Bancaire</option>
              <option value="Remise">Remise</option>
              <option value="Hamza">Hamza</option>
              <option value="Depense Recuperable">Depense Recuperable</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant (DT)</label>
            <input
              type="number"
              step="0.01"
              value={newDepense.montant}
              onChange={(e) => setNewDepense({...newDepense, montant: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={newDepense.date_depense}
              onChange={(e) => setNewDepense({...newDepense, date_depense: e.target.value})}
              readOnly={username !== 'Hamza'}
              className={`w-full p-3 border border-gray-300 rounded-lg ${
                username !== 'Hamza'
                  ? 'bg-gray-100 cursor-not-allowed'
                  : 'focus:ring-2 focus:ring-red-500 focus:border-transparent'
              }`}
            />
          </div>
        </div>

        {/* Champs conditionnels pour Remise */}
        {newDepense.type_depense === 'Remise' && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h5 className="text-sm font-semibold text-blue-800 mb-3">Recherche de contrat</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de contrat *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDepense.numero_contrat}
                    onChange={(e) => setNewDepense({...newDepense, numero_contrat: e.target.value})}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 12345"
                  />
                  <button
                    onClick={handleSearchContract}
                    disabled={searchingContract}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    {searchingContract ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client (Assuré)</label>
                <input
                  type="text"
                  value={newDepense.client}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50"
                  placeholder="Rechercher d'abord le contrat"
                />
              </div>
            </div>
            {contractSearchMessage && (
              <div className={`mt-3 text-sm p-2 rounded ${
                contractSearchMessage.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {contractSearchMessage}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de paiement *</label>
              <select
                value={newDepense.type_paiement}
                onChange={(e) => setNewDepense({...newDepense, type_paiement: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Espece">Espèce</option>
                <option value="Cheque">Chèque</option>
              </select>
            </div>

            {newDepense.type_paiement === 'Cheque' && (
              <div className="mt-4 p-4 bg-blue-100 rounded-lg border border-blue-300">
                <h5 className="text-sm font-semibold text-blue-900 mb-3">Informations du chèque</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de chèque *</label>
                    <input
                      type="text"
                      value={newDepense.numero_cheque}
                      onChange={(e) => setNewDepense({...newDepense, numero_cheque: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Numéro du chèque"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Titulaire du chèque *</label>
                    <input
                      type="text"
                      value={newDepense.titulaire_cheque}
                      onChange={(e) => setNewDepense({...newDepense, titulaire_cheque: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nom du titulaire"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Banque *</label>
                    <input
                      type="text"
                      value={newDepense.banque}
                      onChange={(e) => setNewDepense({...newDepense, banque: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nom de la banque"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date d'encaissement prévue *</label>
                    <input
                      type="date"
                      value={newDepense.date_encaissement_prevue}
                      onChange={(e) => setNewDepense({...newDepense, date_encaissement_prevue: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Champs conditionnels pour Depense Recuperable */}
        {newDepense.type_depense === 'Depense Recuperable' && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h5 className="text-sm font-semibold text-yellow-800 mb-3">Informations de la dépense récupérable</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Libellé *</label>
                <input
                  type="text"
                  value={newDepense.libelle}
                  onChange={(e) => setNewDepense({...newDepense, libelle: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Description de la dépense"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de récupération prévue *</label>
                <input
                  type="date"
                  value={newDepense.date_recuperation_prevue}
                  onChange={(e) => setNewDepense({...newDepense, date_recuperation_prevue: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Champs conditionnels pour Reprise sur Avance Client */}
        {newDepense.type_depense === 'Reprise sur Avance Client' && (
          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h5 className="text-sm font-semibold text-purple-800 mb-3">Validation de l'avance client</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de contrat *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDepense.numero_contrat}
                    onChange={(e) => setNewDepense({...newDepense, numero_contrat: e.target.value})}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: CI..."
                  />
                  <button
                    onClick={handleSearchAvance}
                    disabled={searchingContract}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    {searchingContract ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client (Assuré)</label>
                <input
                  type="text"
                  value={newDepense.client}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50"
                  placeholder="Rechercher d'abord l'avance"
                />
              </div>
            </div>
            {avanceSearchMessage && (
              <div className={`mt-3 text-sm p-2 rounded ${
                avanceSearchMessage.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {avanceSearchMessage}
              </div>
            )}
            <div className="mt-2 text-xs text-purple-700">
              <p>💡 Cette fonction vérifie que :</p>
              <ul className="list-disc ml-5 mt-1">
                <li>Une avance client existe pour ce contrat</li>
                <li>L'échéance correspond à la date du jour</li>
                <li>Un terme a été payé aujourd'hui pour ce contrat</li>
              </ul>
            </div>
          </div>
        )}

        <button
          onClick={handleSaveDepense}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>Enregistrer</span>
        </button>
      </div>

      {/* Filtre par mois et bouton dépenses récupérables */}
      <div className="bg-white rounded-lg p-4 mb-4 border border-red-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-red-600" />
            <label className="text-sm font-medium text-gray-700">Filtrer par:</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">Session actuelle</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              setShowDepensesRecuperables(!showDepensesRecuperables);
              if (!showDepensesRecuperables) {
                loadDepensesRecuperables();
              }
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            <span>{showDepensesRecuperables ? 'Masquer' : 'Dépenses Récupérables'}</span>
          </button>
        </div>
      </div>

      {/* Modal des dépenses récupérables */}
      {showDepensesRecuperables && (
        <div className="bg-white rounded-lg p-4 mb-4 border border-yellow-200">
          <h4 className="font-medium text-yellow-700 mb-4">Dépenses Récupérables ({depensesRecuperables.length})</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-yellow-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">Libellé</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">Montant (DT)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">Date Dépense</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">Date Récup. Prévue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">Créé par</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {depensesRecuperables.map((depense) => (
                  <tr key={depense.id} className="hover:bg-yellow-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{depense.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{depense.libelle}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-yellow-600">
                      {depense.montant.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {depense.date_depense ? new Date(depense.date_depense).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {depense.date_recuperation_prevue ? new Date(depense.date_recuperation_prevue).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {depense.statut_depense === 'Payé' ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Soldé
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Non Payé
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{depense.cree_par}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {depense.statut_depense !== 'Payé' && (
                        <button
                          onClick={() => handleMarquerDepensePayee(depense.id!)}
                          className="px-3 py-1 text-xs font-semibold rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                          title="Marquer comme payé/soldé"
                        >
                          Marquer Payé
                        </button>
                      )}
                      {depense.statut_depense === 'Payé' && (
                        <span className="text-xs text-gray-400 italic">Soldé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {depensesRecuperables.length === 0 && (
              <div className="text-center py-8 text-gray-500">Aucune dépense récupérable enregistrée</div>
            )}
          </div>
        </div>
      )}

      {/* Liste des dépenses */}
      <div className="bg-white rounded-lg border border-red-200">
        <h4 className="font-medium text-red-700 p-4 border-b">Liste des Dépenses ({depenses.length})</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-red-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Montant (DT)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Créé par</th>
                {monthFilter === 'all' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {depenses.map((depense) => (
                <tr key={depense.id} className="hover:bg-red-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{depense.type_depense}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                    {depense.montant.toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {depense.date_depense ? new Date(depense.date_depense).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{depense.cree_par}</td>
                  {monthFilter === 'all' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDeleteDepense(depense.id!)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {depenses.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucune dépense enregistrée</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderRecettesContent = () => (
    <div className="bg-green-50 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-green-800">Recettes Exceptionnelles</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowRecetteDateFilter(!showRecetteDateFilter)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>{showRecetteDateFilter ? 'Session' : 'Filtrer'}</span>
          </button>
          <button
            onClick={exportRecettes}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exporter Excel</span>
          </button>
        </div>
      </div>

      {showRecetteDateFilter && (
        <div className="bg-white rounded-lg p-4 mb-4 border border-green-200">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
              <input
                type="date"
                value={recetteDateFilter.dateFrom}
                onChange={(e) => setRecetteDateFilter({...recetteDateFilter, dateFrom: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
              <input
                type="date"
                value={recetteDateFilter.dateTo}
                onChange={(e) => setRecetteDateFilter({...recetteDateFilter, dateTo: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <button
            onClick={() => loadData()}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Appliquer le filtre
          </button>
        </div>
      )}

      {/* Formulaire de saisie */}
      <div className="bg-white rounded-lg p-4 mb-6 border border-green-200">
        <h4 className="font-medium text-green-700 mb-4">Nouvelle Recette Exceptionnelle</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de recette</label>
            <select
              value={newRecette.type_recette}
              onChange={(e) => setNewRecette({...newRecette, type_recette: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="Hamza">Hamza</option>
              <option value="Récupération A/S Ahlem">Récupération A/S Ahlem</option>
              <option value="Récupération A/S Rouae">Récupération A/S Rouae</option>
              <option value="Avance Client">Avance Client</option>
              <option value="Recuperation Depense">Recuperation Depense</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant (DT)</label>
            <input
              type="number"
              step="0.01"
              value={newRecette.montant}
              onChange={(e) => setNewRecette({...newRecette, montant: e.target.value})}
              readOnly={newRecette.type_recette === 'Recuperation Depense'}
              className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                newRecette.type_recette === 'Recuperation Depense' ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={newRecette.date_recette}
              readOnly
              className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
            />
          </div>
        </div>

        {newRecette.type_recette === 'Recuperation Depense' && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h5 className="text-sm font-semibold text-yellow-800 mb-3">Recherche de la dépense récupérable</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ID de la dépense *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newRecette.id_depense}
                    onChange={(e) => setNewRecette({...newRecette, id_depense: e.target.value})}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="Ex: 123"
                  />
                  <button
                    onClick={handleSearchDepense}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Libellé (automatique)</label>
                <input
                  type="text"
                  value={newRecette.libelle}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50"
                  placeholder="Rechercher d'abord la dépense"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-yellow-700">
              <p>Cliquez sur le bouton "Dépenses Récupérables" dans la section Dépenses pour voir les IDs disponibles</p>
            </div>
          </div>
        )}

        {newRecette.type_recette === 'Avance Client' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-blue-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de contrat</label>
              <input
                type="text"
                value={newRecette.numero_contrat}
                onChange={(e) => setNewRecette({...newRecette, numero_contrat: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="CI..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Échéance</label>
              <input
                type="date"
                value={newRecette.echeance}
                onChange={(e) => setNewRecette({...newRecette, echeance: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'assuré</label>
              <input
                type="text"
                value={newRecette.assure}
                onChange={(e) => setNewRecette({...newRecette, assure: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Nom de l'assuré"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSaveRecette}
          className="mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>Enregistrer</span>
        </button>
      </div>

      {/* Liste des recettes */}
      <div className="bg-white rounded-lg border border-green-200">
        <h4 className="font-medium text-green-700 p-4 border-b">Liste des Recettes Exceptionnelles ({recettes.length})</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-green-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Montant (DT)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">Créé par</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recettes.map((recette) => (
                <tr key={recette.id} className="hover:bg-green-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{recette.type_recette}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    {recette.montant.toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {recette.date_recette ? new Date(recette.date_recette).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{recette.cree_par}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recettes.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucune recette exceptionnelle enregistrée</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderRistournesContent = () => (
    <div className="bg-purple-50 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-purple-800">Gestion des Ristournes</h3>
        <button
          onClick={exportRistournes}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Exporter Excel</span>
        </button>
      </div>

      {/* Formulaire de saisie */}
      <div className="bg-white rounded-lg p-4 mb-6 border border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-purple-700">Nouvelle Ristourne</h4>
          <button
            onClick={() => setShowRistourneSearch(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Chercher Ristourne</span>
          </button>
        </div>

        {/* Modal de recherche */}
        {showRistourneSearch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-semibold text-purple-800 mb-4">Chercher une Ristourne</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de contrat</label>
                  <input
                    type="text"
                    value={ristourneSearchInput.numContrat}
                    onChange={(e) => setRistourneSearchInput({ ...ristourneSearchInput, numContrat: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Numéro de contrat"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de ristourne</label>
                  <input
                    type="date"
                    value={ristourneSearchInput.date}
                    onChange={(e) => setRistourneSearchInput({ ...ristourneSearchInput, date: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => { setShowRistourneSearch(false); setRistourneSearchInput({ numContrat: '', date: '' }); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSearchRistourne}
                  disabled={ristourneSearching}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  <span>{ristourneSearching ? 'Recherche...' : 'Rechercher'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {ristourneFieldsLocked && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro du contrat</label>
                <input
                  type="text"
                  value={newRistourne.numero_contrat}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  placeholder="Numéro du contrat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                <input
                  type="text"
                  value={newRistourne.client}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  placeholder="Nom du client"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant de la ristourne (DT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRistourne.montant_ristourne}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de ristourne</label>
                <input
                  type="date"
                  value={newRistourne.date_ristourne}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de paiement</label>
                <input
                  type="date"
                  value={newRistourne.date_paiement_ristourne}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de paiement</label>
                <select
                  value={newRistourne.type_paiement}
                  onChange={(e) => setNewRistourne({...newRistourne, type_paiement: e.target.value as any})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Espece">Espèce</option>
                  <option value="Cheque">Chèque</option>
                  <option value="Banque">Banque</option>
                  <option value="Siege">Siège</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de ristourne</label>
                <select
                  value={newRistourne.type_ristourne}
                  onChange={(e) => setNewRistourne({...newRistourne, type_ristourne: e.target.value as 'BNS' | 'Ristourne'})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Ristourne">Ristourne</option>
                  <option value="BNS">BNS</option>
                </select>
              </div>
            </div>

            {ristourneCheckMessage && (
              <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                {ristourneCheckMessage}
              </div>
            )}

            <button
              onClick={handleSaveRistourne}
              className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </>
        )}
      </div>


      {/* Panneau AvenantPDF */}
      <div className="mt-6 bg-white rounded-lg border border-purple-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-medium text-purple-700">Ristournes PDF</h4>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportAvenantPDF}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter Excel</span>
            </button>
            <button
              onClick={() => {
                setShowAvenantPDFPanel(v => {
                  if (!v) loadAvenantPDF(1, avenantPDFDateFilter.dateFrom, avenantPDFDateFilter.dateTo);
                  return !v;
                });
              }}
              className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              <span>{showAvenantPDFPanel ? 'Masquer' : 'Afficher'}</span>
            </button>
          </div>
        </div>

        {showAvenantPDFPanel && (
          <div className="p-4">
            {/* Filtres de date */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date du</label>
                <input
                  type="date"
                  value={avenantPDFDateFilter.dateFrom}
                  onChange={(e) => setAvenantPDFDateFilter(f => ({ ...f, dateFrom: e.target.value }))}
                  className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date au</label>
                <input
                  type="date"
                  value={avenantPDFDateFilter.dateTo}
                  onChange={(e) => setAvenantPDFDateFilter(f => ({ ...f, dateTo: e.target.value }))}
                  className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => loadAvenantPDF(1, avenantPDFDateFilter.dateFrom, avenantPDFDateFilter.dateTo)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                Filtrer
              </button>
              <button
                onClick={() => {
                  setAvenantPDFDateFilter({ dateFrom: '', dateTo: '' });
                  loadAvenantPDF(1, '', '');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Réinitialiser
              </button>
              <span className="text-sm text-gray-500 ml-auto">Total: {avenantPDFTotal} enregistrements</span>
            </div>

            {/* Stats payé / non payé */}
            {!avenantPDFLoading && avenantPDFTotal > 0 && (() => {
              const total = avenantPDFPaidCount + avenantPDFUnpaidCount;
              const paidPct = total > 0 ? Math.round((avenantPDFPaidCount / total) * 100) : 0;
              const unpaidPct = total > 0 ? 100 - paidPct : 0;
              const totalAmount = avenantPDFPaidAmount + avenantPDFUnpaidAmount;
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Payé</span>
                      <span className="text-lg font-bold text-green-700">{paidPct}%</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800">{avenantPDFPaidCount}</p>
                    <p className="text-xs text-green-600 mt-1">{avenantPDFPaidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</p>
                    <div className="mt-2 h-1.5 bg-green-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Non Payé</span>
                      <span className="text-lg font-bold text-red-700">{unpaidPct}%</span>
                    </div>
                    <p className="text-2xl font-bold text-red-800">{avenantPDFUnpaidCount}</p>
                    <p className="text-xs text-red-600 mt-1">{avenantPDFUnpaidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</p>
                    <div className="mt-2 h-1.5 bg-red-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${unpaidPct}%` }} />
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Total</span>
                      <span className="text-lg font-bold text-purple-700">100%</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-800">{total}</p>
                    <p className="text-xs text-purple-600 mt-1">{totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</p>
                    <div className="mt-2 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {avenantPDFLoading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-purple-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">N° Contrat</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Prime Émise</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Souscripteur</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Mode Paiement</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Date Paiement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {avenantPDFList.map((row) => {
                        const isPaid = row['Statut de paiement'] === 'Payé';
                        return (
                          <tr
                            key={row.id}
                            className={isPaid ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}
                          >
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.numContrat}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                              {row.primeEmise != null ? Number(row.primeEmise).toLocaleString('fr-FR') : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">{row.souscripteur || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                              {row['Date'] ? new Date(row['Date']).toLocaleDateString('fr-FR') : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isPaid ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                {row['Statut de paiement'] || 'Non payé'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">{row['Mode de paiement'] || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                              {row['Date de paiement'] ? new Date(row['Date de paiement']).toLocaleDateString('fr-FR') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {avenantPDFList.length === 0 && (
                    <div className="text-center py-8 text-gray-500">Aucun enregistrement trouvé</div>
                  )}
                </div>

                {/* Pagination */}
                {avenantPDFTotal > 10 && (
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => loadAvenantPDF(avenantPDFPage - 1, avenantPDFDateFilter.dateFrom, avenantPDFDateFilter.dateTo)}
                      disabled={avenantPDFPage === 1}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      Précédent
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {avenantPDFPage} / {Math.ceil(avenantPDFTotal / 10)}
                    </span>
                    <button
                      onClick={() => loadAvenantPDF(avenantPDFPage + 1, avenantPDFDateFilter.dateFrom, avenantPDFDateFilter.dateTo)}
                      disabled={avenantPDFPage >= Math.ceil(avenantPDFTotal / 10)}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderSinistresContent = () => (
    <div className="bg-orange-50 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-orange-800">Gestion des Sinistres</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSinistreDateFilter(!showSinistreDateFilter)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>{showSinistreDateFilter ? 'Session' : 'Filtrer'}</span>
          </button>
          <button
            onClick={exportSinistres}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exporter Excel</span>
          </button>
        </div>
      </div>

      {showSinistreDateFilter && (
        <div className="bg-white rounded-lg p-4 mb-4 border border-orange-200">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
              <input
                type="date"
                value={sinistreDateFilter.dateFrom}
                onChange={(e) => setSinistreDateFilter({...sinistreDateFilter, dateFrom: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
              <input
                type="date"
                value={sinistreDateFilter.dateTo}
                onChange={(e) => setSinistreDateFilter({...sinistreDateFilter, dateTo: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <button
            onClick={() => loadData()}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Appliquer le filtre
          </button>
        </div>
      )}

      {/* Bouton de recherche — toujours visible */}
      <div className="mb-4 flex">
        <button
          onClick={() => setShowSinistreSearch(true)}
          className="flex items-center space-x-2 px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-sm"
        >
          <Search className="w-4 h-4" />
          <span>Rechercher un sinistre</span>
        </button>
      </div>

      {/* Modal de recherche sinistre */}
      {showSinistreSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-orange-800 mb-4">Rechercher un Sinistre</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de sinistre</label>
              <input
                type="text"
                value={sinistreSearchNumero}
                onChange={(e) => setSinistreSearchNumero(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSinistre()}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Saisir le numéro de sinistre"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => { setShowSinistreSearch(false); setSinistreSearchNumero(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSearchSinistre}
                disabled={sinistreSearching}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>{sinistreSearching ? 'Recherche...' : 'Rechercher'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire — visible seulement après retour de la recherche */}
      {sinistreFieldsLocked && (
        <div className="bg-white rounded-lg p-5 mb-6 border border-orange-300 shadow-sm">
          <h4 className="font-semibold text-orange-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Enregistrement du paiement
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Numéro du sinistre</label>
              <input
                type="text"
                value={newSinistre.numero_sinistre}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
              <input
                type="text"
                value={newSinistre.client}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Montant (DT)</label>
              <input
                type="text"
                value={Number(newSinistre.montant).toLocaleString('fr-FR')}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed font-semibold text-orange-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de paiement</label>
              <input
                type="date"
                value={newSinistre.date_paiement_sinistre}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de paiement</label>
              <select
                value={newSinistre.type_paiement}
                onChange={(e) => setNewSinistre({...newSinistre, type_paiement: e.target.value as 'Espece' | 'Cheque' | 'Banque'})}
                className="w-full p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="Espece">Espèce</option>
                <option value="Cheque">Chèque</option>
                <option value="Banque">Banque</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveSinistre}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors flex items-center space-x-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
            <button
              onClick={() => {
                setSinistreFieldsLocked(false);
                setFoundSinistrePDFId(null);
                setNewSinistre({ numero_sinistre: '', montant: '', client: '', date_sinistre: new Date().toISOString().split('T')[0], date_paiement_sinistre: getSessionDate(), type_paiement: 'Espece' });
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des sinistres */}
      <div className="bg-white rounded-lg border border-orange-200">
        <h4 className="font-medium text-orange-700 p-4 border-b">Liste des Sinistres ({sinistres.length})</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-orange-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-orange-600 uppercase tracking-wider">N° Sinistre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-orange-600 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-orange-600 uppercase tracking-wider">Montant (DT)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-orange-600 uppercase tracking-wider">Type Paiement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-orange-600 uppercase tracking-wider">Date Sinistre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-orange-600 uppercase tracking-wider">Date Paiement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-orange-600 uppercase tracking-wider">Créé par</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sinistres.map((sinistre) => (
                <tr key={sinistre.id} className="hover:bg-orange-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sinistre.numero_sinistre}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sinistre.client}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                    {sinistre.montant.toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sinistre.type_paiement || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sinistre.date_sinistre ? new Date(sinistre.date_sinistre).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sinistre.date_paiement_sinistre ? new Date(sinistre.date_paiement_sinistre).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sinistre.cree_par}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sinistres.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucun sinistre enregistré</div>
          )}
        </div>
      </div>

      {/* Panneau SinistrePDF */}
      <div className="mt-6 bg-white rounded-lg border border-orange-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-medium text-orange-700">Sinistres PDF</h4>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportSinistrePDF}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter Excel</span>
            </button>
            <button
              onClick={() => {
                setShowSinistrePDFPanel(v => {
                  if (!v) loadSinistrePDF(1, sinistrePDFDateFilter.dateFrom, sinistrePDFDateFilter.dateTo);
                  return !v;
                });
              }}
              className="flex items-center space-x-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
            >
              <span>{showSinistrePDFPanel ? 'Masquer' : 'Afficher'}</span>
            </button>
          </div>
        </div>

        {showSinistrePDFPanel && (
          <div className="p-4">
            {/* Filtres de date */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date du</label>
                <input
                  type="date"
                  value={sinistrePDFDateFilter.dateFrom}
                  onChange={(e) => setSinistrePDFDateFilter(f => ({ ...f, dateFrom: e.target.value }))}
                  className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
                <input
                  type="date"
                  value={sinistrePDFDateFilter.dateTo}
                  onChange={(e) => setSinistrePDFDateFilter(f => ({ ...f, dateTo: e.target.value }))}
                  className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => loadSinistrePDF(1, sinistrePDFDateFilter.dateFrom, sinistrePDFDateFilter.dateTo)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
              >
                Filtrer
              </button>
              <button
                onClick={() => {
                  setSinistrePDFDateFilter({ dateFrom: '', dateTo: '' });
                  loadSinistrePDF(1, '', '');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Réinitialiser
              </button>
              <span className="text-sm text-gray-500 ml-auto">Total: {sinistrePDFTotal} enregistrements</span>
            </div>

            {/* Stats payé / non payé */}
            {!sinistrePDFLoading && sinistrePDFTotal > 0 && (() => {
              const total = sinistrePDFPaidCount + sinistrePDFUnpaidCount;
              const paidPct = total > 0 ? Math.round((sinistrePDFPaidCount / total) * 100) : 0;
              const unpaidPct = total > 0 ? 100 - paidPct : 0;
              const totalAmount = sinistrePDFPaidAmount + sinistrePDFUnpaidAmount;
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Payé</span>
                      <span className="text-lg font-bold text-green-700">{paidPct}%</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800">{sinistrePDFPaidCount}</p>
                    <p className="text-xs text-green-600 mt-1">{sinistrePDFPaidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</p>
                    <div className="mt-2 h-1.5 bg-green-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Non Payé</span>
                      <span className="text-lg font-bold text-red-700">{unpaidPct}%</span>
                    </div>
                    <p className="text-2xl font-bold text-red-800">{sinistrePDFUnpaidCount}</p>
                    <p className="text-xs text-red-600 mt-1">{sinistrePDFUnpaidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</p>
                    <div className="mt-2 h-1.5 bg-red-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${unpaidPct}%` }} />
                    </div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Total</span>
                      <span className="text-lg font-bold text-orange-700">100%</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-800">{total}</p>
                    <p className="text-xs text-orange-600 mt-1">{totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</p>
                    <div className="mt-2 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {sinistrePDFLoading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-orange-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-600 uppercase">N° Sinistre</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-600 uppercase">Montant (DT)</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-600 uppercase">Souscripteur</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-600 uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-600 uppercase">Mode Paiement</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-600 uppercase">Date Paiement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sinistrePDFList.map((row) => {
                        const isPaid = row['Statut de paiement'] === 'Payé';
                        return (
                          <tr
                            key={row.id}
                            className={isPaid ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}
                          >
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.NumSinistre || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                              {row.MontantSinistre != null ? Number(row.MontantSinistre).toLocaleString('fr-FR') : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">{row.souscripteur || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isPaid ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                {row['Statut de paiement'] || 'Non payé'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">{row['Mode de paiement'] || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                              {row['Date de paiement'] ? new Date(row['Date de paiement']).toLocaleDateString('fr-FR') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {sinistrePDFList.length === 0 && (
                    <div className="text-center py-8 text-gray-500">Aucun enregistrement trouvé</div>
                  )}
                </div>

                {/* Pagination */}
                {sinistrePDFTotal > 10 && (
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => loadSinistrePDF(sinistrePDFPage - 1, sinistrePDFDateFilter.dateFrom, sinistrePDFDateFilter.dateTo)}
                      disabled={sinistrePDFPage === 1}
                      className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      Précédent
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {sinistrePDFPage} / {Math.ceil(sinistrePDFTotal / 10)}
                    </span>
                    <button
                      onClick={() => loadSinistrePDF(sinistrePDFPage + 1, sinistrePDFDateFilter.dateFrom, sinistrePDFDateFilter.dateTo)}
                      disabled={sinistrePDFPage >= Math.ceil(sinistrePDFTotal / 10)}
                      className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const exportToExcel = (data: any[], filename: string, sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportDepenses = () => {
    const dataToExport = depenses.map(d => ({
      'Type de dépense': d.type_depense,
      'Montant': d.montant,
      'Date': d.date_depense,
      'N° Contrat': d.Numero_Contrat || '',
      'Client': d.Client || '',
      'Créé par': d.cree_par,
      'Date création': d.created_at ? new Date(d.created_at).toLocaleString('fr-FR') : ''
    }));
    exportToExcel(dataToExport, 'depenses', 'Dépenses');
  };

  const exportRecettes = () => {
    const dataToExport = recettes.map(r => ({
      'Type de recette': r.type_recette,
      'Montant': r.montant,
      'Date': r.date_recette,
      'N° Contrat': r.Numero_Contrat || '',
      'Echéance': r.Echeance || '',
      'Assuré': r.Assure || '',
      'Statut': r.Statut || '',
      'Créé par': r.cree_par,
      'Date création': r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : ''
    }));
    exportToExcel(dataToExport, 'recettes_exceptionnelles', 'Recettes');
  };

  const exportRistournes = () => {
    const dataToExport = ristournes.map(r => ({
      'N° Contrat': r.numero_contrat,
      'Client': r.client,
      'Montant': r.montant_ristourne,
      'Date ristourne': r.date_ristourne,
      'Date paiement': r.date_paiement_ristourne ? new Date(r.date_paiement_ristourne).toLocaleDateString('fr-FR') : '',
      'Type paiement': r.type_paiement,
      'Type ristourne': r.type_ristourne || 'Ristourne',
      'Créé par': r.cree_par,
      'Date création': r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : ''
    }));
    exportToExcel(dataToExport, 'ristournes', 'Ristournes');
  };

  const loadAvenantPDF = async (page = 1, dateFrom = '', dateTo = '') => {
    setAvenantPDFLoading(true);
    try {
      let query = supabase
        .from('AvenantPDF')
        .select('id, numContrat, primeEmise, souscripteur, "Date", "Statut de paiement", "Mode de paiement", "Date de paiement"', { count: 'exact' });

      if (dateFrom) query = query.gte('Date', dateFrom);
      if (dateTo) query = query.lte('Date', dateTo);

      const from = (page - 1) * 10;
      const { data, error, count } = await query
        .order('Date', { ascending: false })
        .range(from, from + 9);

      if (error) throw error;
      setAvenantPDFList(data || []);
      setAvenantPDFTotal(count || 0);
      setAvenantPDFPage(page);

      // Fetch paid/unpaid stats for the full dataset (not just current page)
      let statsQueryPaid = supabase
        .from('AvenantPDF')
        .select('primeEmise', { count: 'exact' })
        .eq('Statut de paiement', 'Payé');
      let statsQueryUnpaid = supabase
        .from('AvenantPDF')
        .select('primeEmise', { count: 'exact' })
        .neq('Statut de paiement', 'Payé');

      if (dateFrom) {
        statsQueryPaid = statsQueryPaid.gte('Date', dateFrom);
        statsQueryUnpaid = statsQueryUnpaid.gte('Date', dateFrom);
      }
      if (dateTo) {
        statsQueryPaid = statsQueryPaid.lte('Date', dateTo);
        statsQueryUnpaid = statsQueryUnpaid.lte('Date', dateTo);
      }

      const [paidResult, unpaidResult] = await Promise.all([statsQueryPaid, statsQueryUnpaid]);

      const paidCount = paidResult.count || 0;
      const unpaidCount = unpaidResult.count || 0;
      setAvenantPDFPaidCount(paidCount);
      setAvenantPDFUnpaidCount(unpaidCount);

      const paidAmount = (paidResult.data || []).reduce((s: number, r: any) => s + (Number(r.primeEmise) || 0), 0);
      const unpaidAmount = (unpaidResult.data || []).reduce((s: number, r: any) => s + (Number(r.primeEmise) || 0), 0);
      setAvenantPDFPaidAmount(paidAmount);
      setAvenantPDFUnpaidAmount(unpaidAmount);
    } catch (e) {
      console.error('Erreur chargement AvenantPDF:', e);
    }
    setAvenantPDFLoading(false);
  };

  const exportAvenantPDF = async () => {
    try {
      let query = supabase
        .from('AvenantPDF')
        .select('numContrat, primeEmise, souscripteur, "Date", "Statut de paiement", "Mode de paiement", "Date de paiement"');

      if (avenantPDFDateFilter.dateFrom) query = query.gte('Date', avenantPDFDateFilter.dateFrom);
      if (avenantPDFDateFilter.dateTo) query = query.lte('Date', avenantPDFDateFilter.dateTo);

      const { data, error } = await query.order('Date', { ascending: false });
      if (error) throw error;

      const dataToExport = (data || []).map((r: any) => ({
        'N° Contrat': r.numContrat,
        'Prime Émise': r.primeEmise,
        'Souscripteur': r.souscripteur,
        'Date': r['Date'],
        'Statut': r['Statut de paiement'] || '',
        'Mode de paiement': r['Mode de paiement'] || '',
        'Date de paiement': r['Date de paiement'] || ''
      }));
      exportToExcel(dataToExport, 'ristournes_pdf', 'Ristournes PDF');
    } catch (e) {
      console.error('Erreur export AvenantPDF:', e);
    }
  };

  const loadSinistrePDF = async (page = 1, _dateFrom = '', _dateTo = '') => {
    setSinistrePDFLoading(true);
    try {
      // Requête paginée pour l'affichage
      const from = (page - 1) * 10;
      const { data, error, count } = await supabase
        .from('SinistrPDF')
        .select('id, NumSinistre, souscripteur, MontantSinistre, "Statut de paiement", "Mode de paiement", "Date de paiement"', { count: 'exact' })
        .order('id', { ascending: false })
        .range(from, from + 9);

      if (error) throw error;
      setSinistrePDFList(data || []);
      setSinistrePDFTotal(count || 0);
      setSinistrePDFPage(page);

      // Stats : récupérer tous les enregistrements (MontantSinistre + Statut)
      // neq() exclut les NULL en Supabase — on fetch tout et on filtre côté client
      const { data: allStats } = await supabase
        .from('SinistrPDF')
        .select('MontantSinistre, "Statut de paiement"');

      const allRows = allStats || [];
      const paidRows   = allRows.filter(r => r['Statut de paiement'] === 'Payé');
      const unpaidRows = allRows.filter(r => r['Statut de paiement'] !== 'Payé');

      setSinistrePDFPaidCount(paidRows.length);
      setSinistrePDFUnpaidCount(unpaidRows.length);
      setSinistrePDFPaidAmount(paidRows.reduce((s: number, r: any) => s + (Number(r.MontantSinistre) || 0), 0));
      setSinistrePDFUnpaidAmount(unpaidRows.reduce((s: number, r: any) => s + (Number(r.MontantSinistre) || 0), 0));
    } catch (e) {
      console.error('Erreur chargement SinistrPDF:', e);
    }
    setSinistrePDFLoading(false);
  };

  const exportSinistrePDF = async () => {
    try {
      const { data, error } = await supabase
        .from('SinistrPDF')
        .select('NumSinistre, souscripteur, MontantSinistre, "Statut de paiement", "Mode de paiement", "Date de paiement"')
        .order('id', { ascending: false });
      if (error) throw error;

      const dataToExport = (data || []).map((r: any) => ({
        'N° Sinistre': r.NumSinistre || '',
        'Souscripteur': r.souscripteur || '',
        'Montant': r.MontantSinistre || '',
        'Statut': r['Statut de paiement'] || '',
        'Mode de paiement': r['Modede paiement'] || '',
        'Date de paiement': r['Date de paiement'] || ''
      }));
      exportToExcel(dataToExport, 'sinistres_pdf', 'Sinistres PDF');
    } catch (e) {
      console.error('Erreur export SinistrPDF:', e);
    }
  };

  const exportSinistres = () => {
    const dataToExport = sinistres.map(s => ({
      'N° Sinistre': s.numero_sinistre,
      'Montant': s.montant,
      'Client': s.client,
      'Date sinistre': s.date_sinistre,
      'Date paiement': s.date_paiement_sinistre || '',
      'Type paiement': s.type_paiement || '',
      'Créé par': s.cree_par,
      'Date création': s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : ''
    }));
    exportToExcel(dataToExport, 'sinistres', 'Sinistres');
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'depenses':
        return renderDepensesContent();
      case 'recettes':
        return renderRecettesContent();
      case 'ristournes':
        return renderRistournesContent();
      case 'sinistres':
        return renderSinistresContent();
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <DollarSign className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Gestion Financière</h2>
        </div>

        {/* Navigation des sections */}
        <div className="flex flex-wrap gap-2 mb-6">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? `bg-${section.color}-100 text-${section.color}-700 border-2 border-${section.color}-300`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${
            message.includes('succès') 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Contenu de la section active */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2">Chargement...</span>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default FinancialManagement;

