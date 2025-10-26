import React, { useState } from 'react';
import { Save, FileText, DollarSign, Calendar, Search, CreditCard, User, Hash, Building, RotateCcw } from 'lucide-react';
import { Contract } from '../types';
import { saveContract, generateContractId, getXMLContracts } from '../utils/storage';
import { findContractInXLSX } from '../utils/xlsxParser';
import { searchContractInTable, getAvailableMonths, saveAffaireContract, saveCreditContract, saveContractToRapport, checkTermeContractExists, saveTermeContract,checkAffaireContractExists,checkAffaireInRapport,checkTermeInRapport} from '../utils/supabaseService';
import { getSessionDate } from '../utils/auth';

interface ContractFormProps {
  username: string;
}

const ContractForm: React.FC<ContractFormProps> = ({ username }) => {
  const [formData, setFormData] = useState({
    type: 'Affaire' as 'Terme' | 'Affaire',
    branch: 'Auto' as 'Auto' | 'Vie' | 'Santé' | 'IRDS',
    contractNumber: '',
    premiumAmount: '',
    insuredName: '',
    paymentMode: 'Espece' as 'Espece' | 'Cheque' | 'Carte Bancaire',
    paymentType: 'Au comptant' as 'Au comptant' | 'Crédit',
    creditAmount: '',
    paymentDate: ''
  });

  const [xmlSearchResult, setXmlSearchResult] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isRetourTechniqueMode, setIsRetourTechniqueMode] = useState(false);
  const [originalPremiumAmount, setOriginalPremiumAmount] = useState('');

  React.useEffect(() => {
    loadAvailableMonths();
  }, []);

  const loadAvailableMonths = async () => {
    const months = await getAvailableMonths();
    setAvailableMonths(months);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let updatedData = {
      ...formData,
      [name]: value
    };

    // LOGIQUE AMÉLIORÉE POUR CRÉDIT
    if (name === 'paymentType' && value === 'Crédit') {
      // Lorsqu'on passe en mode Crédit, initialiser le montant crédit
      if (formData.premiumAmount && !updatedData.creditAmount) {
        updatedData.creditAmount = formData.premiumAmount;
      }
    } else if (name === 'premiumAmount' && formData.paymentType === 'Crédit') {
      // Si la prime change en mode Crédit, ajuster le crédit si nécessaire
      const newPremium = parseFloat(value) || 0;
      const currentCredit = parseFloat(updatedData.creditAmount) || 0;
      
      if (currentCredit > newPremium) {
        updatedData.creditAmount = value; // Ajuster le crédit à la nouvelle prime
      }
    } else if (name === 'creditAmount' && formData.paymentType === 'Crédit') {
      // Valider que le crédit ne dépasse pas la prime
      const creditValue = parseFloat(value) || 0;
      const premiumValue = parseFloat(formData.premiumAmount) || 0;
      
      if (creditValue > premiumValue) {
        setMessage('⚠️ Le montant du crédit ne peut pas dépasser la prime totale');
        setTimeout(() => setMessage(''), 3000);
      }
    }

    setFormData(updatedData);
  };

  const searchInXML = async () => {
    if (formData.type === 'Terme' && formData.contractNumber && selectedMonth) {
      // Rechercher d'abord dans Supabase
      const supabaseResult = await searchContractInTable(selectedMonth, formData.contractNumber);
      
      if (supabaseResult) {
        // Normaliser le résultat Supabase pour correspondre à l'interface XMLContract
        const normalizedResult = {
          ...supabaseResult,
          premium: supabaseResult.prime,
          insured: supabaseResult.assure,
          maturity: supabaseResult.echeance
        };
        
        setXmlSearchResult(normalizedResult);
        setFormData(prev => ({
          ...prev,
          premiumAmount: supabaseResult.prime.toString(),
          insuredName: supabaseResult.assure
        }));
        setMessage(`Contrat trouvé dans la table Supabase "${selectedMonth}"`);
        return;
      }

      // Si pas trouvé dans Supabase, chercher localement
      const xmlContracts = getXMLContracts();
      const result = findContractInXLSX(xmlContracts, formData.contractNumber);
      
      if (result) {
        setXmlSearchResult(result);
        setFormData(prev => ({
          ...prev,
          premiumAmount: result.premium.toString(),
          insuredName: result.insured
        }));
        setMessage('Contrat trouvé dans les données XLSX locales');
      } else {
        setXmlSearchResult(null);
        setMessage('Contrat non trouvé dans les données XLSX');
      }
    } else if (formData.type === 'Terme' && !selectedMonth) {
      setMessage('Veuillez sélectionner un mois pour la recherche');
    }
  };

  const handleRetourTechniqueClick = () => {
    if (!isRetourTechniqueMode) {
      setOriginalPremiumAmount(formData.premiumAmount);
    }
    setIsRetourTechniqueMode(!isRetourTechniqueMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // VALIDATION SPÉCIFIQUE POUR CRÉDIT
    if (formData.paymentType === 'Crédit') {
      const primeAmount = parseFloat(formData.premiumAmount);
      const creditAmount = parseFloat(formData.creditAmount);
      
      // Validation de la prime
      if (isNaN(primeAmount) || primeAmount <= 0) {
        setMessage('❌ Veuillez saisir un montant de prime valide');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      // Validation du crédit
      if (isNaN(creditAmount) || creditAmount <= 0) {
        setMessage('❌ Veuillez saisir un montant de crédit valide');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      // Vérifier que le crédit ne dépasse pas la prime
      if (creditAmount > primeAmount) {
        setMessage('❌ Le montant du crédit ne peut pas dépasser la prime totale');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      // Validation de la date pour crédit
      if (!formData.paymentDate) {
        setMessage('❌ Veuillez saisir une date de paiement prévue pour le crédit');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      const sessionDate = getSessionDate();
      if (formData.paymentDate <= sessionDate) {
        setMessage('❌ La date de paiement prévue doit être postérieure à la date de session actuelle');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
    } else {
      // Validation pour paiement au comptant
      const primeAmount = parseFloat(formData.premiumAmount);
      if (isNaN(primeAmount) || primeAmount <= 0) {
        setMessage('❌ Veuillez saisir un montant de prime valide');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
    }
    
    console.log('🔍 Vérification avant sauvegarde (CRÉDIT):');
    console.log('  - Type de paiement:', formData.paymentType);
    console.log('  - Prime saisie:', formData.premiumAmount);
    console.log('  - Crédit saisi:', formData.creditAmount);
    console.log('  - Date paiement:', formData.paymentDate);
    
    setIsLoading(true);

    try {
      const contract: Contract = {
        id: generateContractId(),
        type: formData.type,
        branch: formData.branch,
        contractNumber: formData.contractNumber,
        premiumAmount: parseFloat(formData.premiumAmount),
        insuredName: formData.insuredName,
        paymentMode: formData.paymentMode,
        paymentType: formData.paymentType,
        creditAmount: formData.paymentType === 'Crédit' ? parseFloat(formData.creditAmount) : undefined,
        paymentDate: formData.paymentDate || undefined,
        createdBy: username,
        createdAt: Date.now(),
        xmlData: xmlSearchResult || undefined
      };

      console.log('📊 Données du contrat avant sauvegarde (CRÉDIT):');
      console.log('  - contract.premiumAmount:', contract.premiumAmount);
      console.log('  - contract.creditAmount:', contract.creditAmount);
      console.log('  - Calcul montant comptant:', contract.premiumAmount - (contract.creditAmount || 0));

      // VÉRIFICATIONS DES DOUBLONS AVANT SAUVEGARDE
      if (contract.type === 'Terme' && xmlSearchResult) {
        // Vérifier dans la table Terme
        const existingInTerme = await checkTermeContractExists(
          contract.contractNumber,
          xmlSearchResult.maturity
        );

        if (existingInTerme) {
          const datePaiement = new Date(existingInTerme.date_paiement).toLocaleDateString('fr-FR');
          setMessage(`❌ Le terme est déjà payé en date du ${datePaiement}`);
          setIsLoading(false);
          setFormData({
            type: 'Affaire',
            branch: 'Auto',
            contractNumber: '',
            premiumAmount: '',
            insuredName: '',
            paymentMode: 'Espece',
            paymentType: 'Au comptant',
            creditAmount: '',
            paymentDate: ''
          });
          setXmlSearchResult(null);
          setIsRetourTechniqueMode(false);
          setOriginalPremiumAmount('');
          return;
        }

        // Vérifier dans la table Rapport
        const existingInRapport = await checkTermeInRapport(
          contract.contractNumber,
          xmlSearchResult.maturity
        );

        if (existingInRapport) {
          const datePaiement = new Date(existingInRapport.created_at).toLocaleDateString('fr-FR');
          setMessage(`❌ Le terme est déjà payé en date du ${datePaiement}`);
          setIsLoading(false);
          setFormData({
            type: 'Affaire',
            branch: 'Auto',
            contractNumber: '',
            premiumAmount: '',
            insuredName: '',
            paymentMode: 'Espece',
            paymentType: 'Au comptant',
            creditAmount: '',
            paymentDate: ''
          });
          setXmlSearchResult(null);
          setIsRetourTechniqueMode(false);
          setOriginalPremiumAmount('');
          return;
        }
      }

      if (contract.type === 'Affaire') {
        // Obtenir la date de session (date de paiement pour Affaire)
        const sessionDate = getSessionDate();

        // Vérifier dans la table Affaire
        const existingInAffaire = await checkAffaireContractExists(
          contract.contractNumber,
          sessionDate
        );

        if (existingInAffaire) {
          const datePaiement = new Date(existingInAffaire.created_at).toLocaleDateString('fr-FR');
          setMessage(`❌ Ce contrat est déjà souscrit en date du ${datePaiement}`);
          setIsLoading(false);
          setFormData({
            type: 'Affaire',
            branch: 'Auto',
            contractNumber: '',
            premiumAmount: '',
            insuredName: '',
            paymentMode: 'Espece',
            paymentType: 'Au comptant',
            creditAmount: '',
            paymentDate: ''
          });
          setXmlSearchResult(null);
          setIsRetourTechniqueMode(false);
          setOriginalPremiumAmount('');
          return;
        }

        // Vérifier dans la table Rapport
        const existingInRapport = await checkAffaireInRapport(
          contract.contractNumber,
          sessionDate
        );

        if (existingInRapport) {
          const datePaiement = new Date(existingInRapport.created_at).toLocaleDateString('fr-FR');
          setMessage(`❌ Ce contrat est déjà souscrit en date du ${datePaiement}`);
          setIsLoading(false);
          setFormData({
            type: 'Affaire',
            branch: 'Auto',
            contractNumber: '',
            premiumAmount: '',
            insuredName: '',
            paymentMode: 'Espece',
            paymentType: 'Au comptant',
            creditAmount: '',
            paymentDate: ''
          });
          setXmlSearchResult(null);
          setIsRetourTechniqueMode(false);
          setOriginalPremiumAmount('');
          return;
        }
      }

      // Sauvegarder localement
      saveContract(contract);

      // SAUVEGARDE DANS RAPPORT (AVEC LOGIQUE CRÉDIT)
      try {
        console.log('💾 Début de la sauvegarde dans la table rapport (CRÉDIT)...');
        const rapportSuccess = await saveContractToRapport(contract);

        if (rapportSuccess) {
          let successMessage = '✅ Contrat enregistré avec succès';

          // Ajouter les détails pour crédit
          if (contract.paymentType === 'Crédit') {
            const montantComptant = contract.premiumAmount - (contract.creditAmount || 0);
            successMessage += ` - Prime: ${contract.premiumAmount} DT, Crédit: ${contract.creditAmount} DT, Comptant: ${montantComptant} DT`;
          } else {
            successMessage += ` - Montant: ${contract.premiumAmount} DT`;
          }

          setMessage(successMessage);
        } else {
          setMessage('❌ Erreur lors de la sauvegarde dans la base de données');
          setIsLoading(false);
          return;
        }
      } catch (rapportError) {
        console.error('Erreur rapport:', rapportError);
        setMessage('❌ Erreur critique lors de la sauvegarde');
        setIsLoading(false);
        return;
      }

      // SAUVEGARDES SPÉCIFIQUES
      if (contract.type === 'Terme' && xmlSearchResult) {
        try {
          await saveTermeContract(contract);
          setMessage(prev => prev + ' + Terme');
        } catch (termeError) {
          console.error('Erreur Terme:', termeError);
          setMessage(prev => prev + ' (erreur Terme)');
        }
      }

      if (contract.type === 'Affaire') {
        try {
          await saveAffaireContract(contract);
          setMessage(prev => prev + ' + Affaire');
        } catch (supabaseError) {
          console.error('Erreur Affaire:', supabaseError);
          setMessage(prev => prev + ' (erreur Affaire)');
        }
      }

      // SAUVEGARDE CRÉDIT SPÉCIFIQUE
      if (contract.paymentType === 'Crédit' && contract.creditAmount) {
        try {
          await saveCreditContract(contract);
          setMessage(prev => prev + ' + Crédit enregistré');
        } catch (creditError) {
          console.error('Erreur crédit:', creditError);
          setMessage(prev => prev + ' (erreur crédit)');
        }
      }
      
      // Reset form
      setFormData({
        type: 'Affaire',
        branch: 'Auto',
        contractNumber: '',
        premiumAmount: '',
        insuredName: '',
        paymentMode: 'Espece',
        paymentType: 'Au comptant',
        creditAmount: '',
        paymentDate: ''
      });
      setXmlSearchResult(null);
      setIsRetourTechniqueMode(false);
      setOriginalPremiumAmount('');

    } catch (error) {
      console.error('Erreur générale:', error);
      setMessage('❌ Erreur générale lors de l\'enregistrement');
    }

    setIsLoading(false);
    setTimeout(() => setMessage(''), 6000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-white/20">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg shadow-md">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Nouveau Contrat</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type et Branche */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Type de contrat *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                required
              >
                <option value="Affaire">Affaire</option>
                <option value="Terme">Terme</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Branche *
              </label>
              <select
                name="branch"
                value={formData.branch}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                required
              >
                <option value="Auto">Auto</option>
                <option value="Vie">Vie</option>
                <option value="Santé">Santé</option>
                <option value="IRDS">IRDS</option>
              </select>
            </div>
          </div>

          {/* Recherche pour les contrats Terme */}
          {formData.type === 'Terme' && availableMonths.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                📅 Sélectionner le mois pour la recherche des contrats Terme
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
              >
                <option value="">Choisir un mois...</option>
                {availableMonths.map((month, index) => (
                  <option key={index} value={month}>{month}</option>
                ))}
              </select>
              <p className="text-xs text-blue-600 mt-2">
                Sélectionnez un mois pour rechercher automatiquement les données du contrat
              </p>
            </div>
          )}

          {/* Numéro de contrat avec recherche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Hash className="w-4 h-4 mr-2" />
              Numéro de contrat *
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                name="contractNumber"
                value={formData.contractNumber}
                onChange={handleInputChange}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                placeholder="Entrez le numéro de contrat"
                required
              />
              {formData.type === 'Terme' && selectedMonth && (
                <button
                  type="button"
                  onClick={searchInXML}
                  className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Search className="w-4 h-4" />
                  <span>Rechercher</span>
                </button>
              )}
            </div>
          </div>

          {/* Résultats de recherche */}
          {xmlSearchResult && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                📋 Données du contrat trouvées:
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-green-700">Prime:</span> {xmlSearchResult.premium} DT
                </div>
                <div>
                  <span className="font-medium text-green-700">Échéance:</span> {xmlSearchResult.maturity}
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-green-700">Assuré:</span> {xmlSearchResult.insured}
                </div>
              </div>
              {selectedMonth && (
                <p className="text-xs text-green-600 mt-2">Source: Table Supabase "{selectedMonth}"</p>
              )}
            </div>
          )}

          {/* Montant Prime et Nom Assuré */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Montant Prime TTC (DT) *
                {formData.paymentType === 'Crédit' && (
                  <span className="text-xs text-orange-600 ml-2">(Prime totale)</span>
                )}
                {formData.type === 'Terme' && originalPremiumAmount && (
                  <span className="text-xs text-red-600 ml-2">
                    (Original: {originalPremiumAmount} DT)
                  </span>
                )}
              </label>
              <input
                type="number"
                name="premiumAmount"
                value={formData.premiumAmount}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                className={`w-full p-3 border ${isRetourTechniqueMode ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white`}
                placeholder="0.00"
                required
                disabled={formData.type === 'Terme' && !isRetourTechniqueMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Nom de l'assuré *
              </label>
              <input
                type="text"
                name="insuredName"
                value={formData.insuredName}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                placeholder="Nom complet de l'assuré"
                required
              />
            </div>
          </div>

          {/* Mode et Type de Paiement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💳 Mode de paiement *
              </label>
              <select
                name="paymentMode"
                value={formData.paymentMode}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                required
              >
                <option value="Espece">Espèce</option>
                <option value="Cheque">Chèque</option>
                <option value="Carte Bancaire">Carte Bancaire</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⏰ Type de paiement *
              </label>
              <select
                name="paymentType"
                value={formData.paymentType}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white"
                required
              >
                <option value="Au comptant">Au comptant</option>
                <option value="Crédit">Crédit</option>
              </select>
            </div>
          </div>

          {/* Section CRÉDIT (conditionnelle) */}
          {formData.paymentType === 'Crédit' && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Informations de Crédit
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant du crédit (DT) *
                    <span className="text-xs text-orange-600 ml-2">Max: {formData.premiumAmount || 0} DT</span>
                  </label>
                  <input
                    type="number"
                    name="creditAmount"
                    value={formData.creditAmount}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max={formData.premiumAmount || undefined}
                    className="w-full p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Date de paiement prévue *
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleInputChange}
                    min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    className="w-full p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
                    required
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    Date minimum: {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              
              {/* Récapitulatif du crédit */}
              {formData.premiumAmount && formData.creditAmount && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-orange-200">
                  <h4 className="font-semibold text-orange-700 text-sm mb-3">📊 Récapitulatif du crédit:</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-2 bg-green-50 rounded-lg">
                      <div className="font-medium text-green-700">Prime totale</div>
                      <div className="text-green-600 font-bold">{parseFloat(formData.premiumAmount).toFixed(2)} DT</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                      <div className="font-medium text-blue-700">Montant crédit</div>
                      <div className="text-blue-600 font-bold">{parseFloat(formData.creditAmount).toFixed(2)} DT</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded-lg">
                      <div className="font-medium text-purple-700">À payer comptant</div>
                      <div className="text-purple-600 font-bold">
                        {(parseFloat(formData.premiumAmount) - parseFloat(formData.creditAmount)).toFixed(2)} DT
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bouton Retour Technique (conditionnel) */}
          {formData.type === 'Terme' && (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleRetourTechniqueClick}
                className={`px-4 py-2 bg-gradient-to-r ${isRetourTechniqueMode ? 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' : 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'} text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isRetourTechniqueMode ? 'Annuler Modification' : 'Retour Technique'}</span>
              </button>
            </div>
          )}

          {/* Message de statut */}
          {message && (
            <div className={`p-4 rounded-lg border ${
              message.includes('✅') || message.includes('succès') || message.includes('trouvé')
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200'
                : message.includes('⚠️')
                ? 'bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-700 border-yellow-200'
                : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border-red-200'
            }`}>
              <div className="flex items-center">
                {message.includes('✅') && <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>}
                {message.includes('❌') && <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>}
                {message.includes('⚠️') && <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>}
                <span>{message}</span>
              </div>
            </div>
          )}

          {/* Bouton de soumission */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Enregistrer le contrat</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContractForm;