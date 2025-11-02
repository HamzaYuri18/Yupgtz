import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Gift, AlertTriangle, Save, Plus, Trash2, Search, Calendar } from 'lucide-react';
import { getSessionDate } from '../utils/auth';
import { supabase } from '../lib/supabase';
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
    client: ''
  });
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [searchingContract, setSearchingContract] = useState(false);
  const [contractSearchMessage, setContractSearchMessage] = useState('');
  const [avanceData, setAvanceData] = useState<any>(null);
  const [avanceSearchMessage, setAvanceSearchMessage] = useState('');

  // États pour les recettes exceptionnelles
  const [recettes, setRecettes] = useState<RecetteExceptionnelle[]>([]);
  const [newRecette, setNewRecette] = useState({
    type_recette: 'Hamza',
    montant: '',
    date_recette: getSessionDate(),
    numero_contrat: '',
    echeance: '',
    assure: ''
  });

  // États pour les ristournes
  const [ristournes, setRistournes] = useState<Ristourne[]>([]);
  const [newRistourne, setNewRistourne] = useState({
    numero_contrat: '',
    client: '',
    montant_ristourne: '',
    date_ristourne: new Date().toISOString().split('T')[0],
    date_paiement_ristourne: getSessionDate(),
    type_paiement: 'Espece' as 'Espece' | 'Cheque' | 'Banque'
  });
  const [ristourneDateFilter, setRistourneDateFilter] = useState({
    dateFrom: '',
    dateTo: ''
  });
  const [showRistourneDateFilter, setShowRistourneDateFilter] = useState(false);
  const [ristourneCheckMessage, setRistourneCheckMessage] = useState('');

  // États pour les sinistres
  const [sinistres, setSinistres] = useState<Sinistre[]>([]);
  const [newSinistre, setNewSinistre] = useState({
    numero_sinistre: '',
    montant: '',
    client: '',
    date_sinistre: new Date().toISOString().split('T')[0],
    date_paiement_sinistre: getSessionDate()
  });

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
  }, [activeSection, monthFilter, showRistourneDateFilter, ristourneDateFilter.dateFrom, ristourneDateFilter.dateTo]);

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
          if (monthFilter === 'all') {
            const sessionDate = getSessionDate();
            depensesData = depensesData.filter(d =>
              d.created_at && d.created_at.startsWith(sessionDate)
            );
          } else {
            depensesData = depensesData.filter(d =>
              d.created_at && d.created_at.startsWith(monthFilter)
            );
          }

          setDepenses(depensesData);
          break;
        case 'recettes':
          const recettesData = await getRecettesExceptionnelles();
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
          const sinistresData = await getSinistres();
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

  const handleSaveDepense = async () => {
    if (!newDepense.montant) {
      setMessage('Veuillez saisir un montant');
      return;
    }

    if (newDepense.type_depense === 'Remise') {
      if (!newDepense.numero_contrat || !newDepense.client) {
        setMessage('Veuillez rechercher et valider un contrat pour la remise');
        return;
      }
      console.log('📝 Tentative d\'enregistrement d\'une remise:', newDepense);
    }

    if (newDepense.type_depense === 'Reprise sur Avance Client') {
      if (!avanceData) {
        setMessage('Veuillez rechercher et valider l\'avance avant d\'enregistrer');
        return;
      }

      try {
        const { data: termeData, error: termeError } = await supabase
          .from('rapport')
          .select('*')
          .eq('numero_contrat', avanceData.Numero_Contrat)
          .eq('echeance', avanceData.Echeance)
          .eq('type', 'Terme')
          .maybeSingle();

        if (termeError) throw termeError;

        if (!termeData) {
          setMessage('❌ Cette avance ne correspond à aucun terme dans la table rapport');
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
        setMessage('❌ Erreur lors de la vérification du terme');
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
      })
    };

    const success = await saveDepense(depense);
    if (success) {
      setMessage('✅ Dépense enregistrée avec succès');
      console.log('✅ Dépense enregistrée avec succès, type:', depense.type_depense);
      setNewDepense({
        type_depense: 'Frais Bureau',
        montant: '',
        date_depense: getSessionDate(),
        numero_contrat: '',
        client: ''
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
      })
    };

    const success = await saveRecetteExceptionnelle(recette);
    if (success) {
      setMessage('✅ Recette exceptionnelle enregistrée avec succès');
      setNewRecette({
        type_recette: 'Hamza',
        montant: '',
        date_recette: getSessionDate(),
        numero_contrat: '',
        echeance: '',
        assure: ''
      });
      loadData();
    } else {
      setMessage('❌ Erreur lors de l\'enregistrement de la recette');
    }
    setTimeout(() => setMessage(''), 3000);
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
      type_paiement: newRistourne.type_paiement,
      cree_par: username
    };

    const success = await saveRistourne(ristourne);
    if (success) {
      setMessage('✅ Ristourne enregistrée avec succès');
      setNewRistourne({
        numero_contrat: '',
        client: '',
        montant_ristourne: '',
        date_ristourne: new Date().toISOString().split('T')[0],
        date_paiement_ristourne: getSessionDate(),
        type_paiement: 'Espece'
      });
      setRistourneCheckMessage('');
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

    // Vérifier l'existence
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
      date_sinistre: newSinistre.date_sinistre,
      date_paiement_sinistre: newSinistre.date_paiement_sinistre,
      cree_par: username
    };

    const success = await saveSinistre(sinistre);
    if (success) {
      setMessage('✅ Sinistre enregistré avec succès');
      setNewSinistre({
        numero_sinistre: '',
        montant: '',
        client: '',
        date_sinistre: new Date().toISOString().split('T')[0],
        date_paiement_sinistre: getSessionDate()
      });
      loadData();
    } else {
      setMessage('❌ Erreur lors de l\'enregistrement du sinistre');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const renderDepensesContent = () => (
    <div className="bg-red-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-red-800 mb-4">Gestion des Dépenses</h3>
      
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
              <option value="A/S Islem">A/S Islem</option>
              <option value="Reprise sur Avance Client">Reprise sur Avance Client</option>
              <option value="Versement Bancaire">Versement Bancaire</option>
              <option value="Remise">Remise</option>
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
              readOnly
              className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
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

      {/* Filtre par mois */}
      <div className="bg-white rounded-lg p-4 mb-4 border border-red-200">
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
      </div>

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
      <h3 className="text-lg font-semibold text-green-800 mb-4">Recettes Exceptionnelles</h3>
      
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
              <option value="Récupération A/S Islem">Récupération A/S Islem</option>
              <option value="Avance Client">Avance Client</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant (DT)</label>
            <input
              type="number"
              step="0.01"
              value={newRecette.montant}
              onChange={(e) => setNewRecette({...newRecette, montant: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
      <h3 className="text-lg font-semibold text-purple-800 mb-4">Gestion des Ristournes</h3>
      
      {/* Formulaire de saisie */}
      <div className="bg-white rounded-lg p-4 mb-6 border border-purple-200">
        <h4 className="font-medium text-purple-700 mb-4">Nouvelle Ristourne</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Numéro du contrat</label>
            <input
              type="text"
              value={newRistourne.numero_contrat}
              onChange={(e) => setNewRistourne({...newRistourne, numero_contrat: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Numéro du contrat"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
            <input
              type="text"
              value={newRistourne.client}
              onChange={(e) => setNewRistourne({...newRistourne, client: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Nom du client"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant de la ristourne (DT)</label>
            <input
              type="number"
              step="0.01"
              value={newRistourne.montant_ristourne}
              onChange={(e) => setNewRistourne({...newRistourne, montant_ristourne: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date de ristourne</label>
            <input
              type="date"
              value={newRistourne.date_ristourne}
              onChange={(e) => setNewRistourne({...newRistourne, date_ristourne: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              onChange={(e) => setNewRistourne({...newRistourne, type_paiement: e.target.value as 'Espece' | 'Cheque' | 'Banque'})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="Espece">Espèce</option>
              <option value="Cheque">Chèque</option>
              <option value="Banque">Banque</option>
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
      </div>

      {/* Filtre par date */}
      <div className="bg-white rounded-lg p-4 mb-4 border border-purple-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-600" />
            <label className="text-sm font-medium text-gray-700">Affichage:</label>
            <button
              onClick={() => setShowRistourneDateFilter(!showRistourneDateFilter)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                showRistourneDateFilter
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showRistourneDateFilter ? 'Filtre par plage' : 'Session actuelle'}
            </button>
          </div>
        </div>

        {showRistourneDateFilter && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date du</label>
              <input
                type="date"
                value={ristourneDateFilter.dateFrom}
                onChange={(e) => setRistourneDateFilter({...ristourneDateFilter, dateFrom: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date à</label>
              <input
                type="date"
                value={ristourneDateFilter.dateTo}
                onChange={(e) => setRistourneDateFilter({...ristourneDateFilter, dateTo: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Liste des ristournes */}
      <div className="bg-white rounded-lg border border-purple-200">
        <h4 className="font-medium text-purple-700 p-4 border-b">Liste des Ristournes ({ristournes.length})</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-purple-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Contrat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Montant (DT)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Type Paiement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Date Ristourne</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Date Paiement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Créé par</th>
                {!showRistourneDateFilter && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ristournes.map((ristourne) => {
                const isCurrentSession = !showRistourneDateFilter;
                return (
                  <tr key={ristourne.id} className="hover:bg-purple-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ristourne.numero_contrat}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ristourne.client}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-purple-600">
                      {ristourne.montant_ristourne.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ristourne.type_paiement || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ristourne.date_ristourne ? new Date(ristourne.date_ristourne).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ristourne.date_paiement_ristourne ? new Date(ristourne.date_paiement_ristourne).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ristourne.cree_par}</td>
                    {isCurrentSession && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDeleteRistourne(ristourne.id!)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ristournes.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucune ristourne enregistrée</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSinistresContent = () => (
    <div className="bg-orange-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-orange-800 mb-4">Gestion des Sinistres</h3>
      
      {/* Formulaire de saisie */}
      <div className="bg-white rounded-lg p-4 mb-6 border border-orange-200">
        <h4 className="font-medium text-orange-700 mb-4">Nouveau Sinistre</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Numéro du sinistre</label>
            <input
              type="text"
              value={newSinistre.numero_sinistre}
              onChange={(e) => setNewSinistre({...newSinistre, numero_sinistre: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Numéro du sinistre"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
            <input
              type="text"
              value={newSinistre.client}
              onChange={(e) => setNewSinistre({...newSinistre, client: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Nom du client"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant (DT)</label>
            <input
              type="number"
              step="0.01"
              value={newSinistre.montant}
              onChange={(e) => setNewSinistre({...newSinistre, montant: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date du sinistre</label>
            <input
              type="date"
              value={newSinistre.date_sinistre}
              onChange={(e) => setNewSinistre({...newSinistre, date_sinistre: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
        </div>
        <button
          onClick={handleSaveSinistre}
          className="mt-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>Enregistrer</span>
        </button>
      </div>

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
    </div>
  );

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