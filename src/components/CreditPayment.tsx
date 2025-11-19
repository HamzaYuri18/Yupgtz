import React, { useState } from 'react';
import { Search, DollarSign, CheckCircle, AlertCircle, CreditCard, Banknote, Calendar, User } from 'lucide-react';
import { searchCreditByContractNumber, updateCreditPayment, searchCreditFlexible, verifyPaymentInBothTables } from '../utils/supabaseService';

interface CreditData {
  id: number;
  numero_contrat: string;
  prime: number;
  assure: string;
  branche: string;
  montant_credit: number;
  paiement?: number;
  solde?: number;
  statut: string;
  date_paiement_prevue?: string;
  date_paiement_effectif?: string;
  created_at: string;
}

const CreditPayment: React.FC = () => {
  const [contractNumber, setContractNumber] = useState<string>('');
  const [insuredName, setInsuredName] = useState<string>('');
  const [creditDate, setCreditDate] = useState<string>('');
  const [searchMonth, setSearchMonth] = useState<string>('');
  const [searchYear, setSearchYear] = useState<string>('');
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'Espece' | 'Cheque' | 'Carte Bancaire'>('Espece');
  const [numeroCheque, setNumeroCheque] = useState<string>('');
  const [banque, setBanque] = useState<string>('');
  const [dateEncaissementPrevue, setDateEncaissementPrevue] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CreditData[]>([]);
  const [verificationDetails, setVerificationDetails] = useState<any>(null);

  // Générer les années disponibles (3 ans en arrière jusqu'à l'année en cours)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => (currentYear - 3 + i).toString());
  
  // Mois en français
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const handleSearch = async (): Promise<void> => {
    // Validation des combinaisons de recherche
    const filledFields = [
      contractNumber.trim(),
      insuredName.trim(),
      creditDate.trim(),
      searchMonth.trim(),
      searchYear.trim()
    ].filter(field => field !== '').length;

    if (filledFields < 2) {
      setMessage('Veuillez remplir au moins 2 champs de recherche');
      return;
    }

    // Validation des combinaisons spécifiques
    const hasContractAndDate = contractNumber.trim() && creditDate.trim();
    const hasNameAndDate = insuredName.trim() && creditDate.trim();
    const hasMonthAndYear = searchMonth.trim() && searchYear.trim();
    const hasContractAndMonthYear = contractNumber.trim() && searchMonth.trim() && searchYear.trim();
    const hasNameAndMonthYear = insuredName.trim() && searchMonth.trim() && searchYear.trim();

    if (!hasContractAndDate && !hasNameAndDate && !hasMonthAndYear && !hasContractAndMonthYear && !hasNameAndMonthYear) {
      setMessage('Veuillez utiliser une de ces combinaisons:\n- Numéro contrat + Date crédit\n- Nom assuré + Date crédit\n- Mois + Année\n- Numéro contrat + Mois + Année\n- Nom assuré + Mois + Année');
      return;
    }

    setIsSearching(true);
    setMessage('');
    setCreditData(null);
    setSearchResults([]);
    setVerificationDetails(null);

    try {
      const results = await searchCreditFlexible(
        contractNumber.trim() || null,
        insuredName.trim() || null,
        creditDate.trim() || null,
        searchMonth.trim() || null,
        searchYear.trim() || null
      );

      if (results.length === 1) {
        setCreditData(results[0]);
        setMessage('Crédit trouvé avec succès');
        if (!results[0].paiement || results[0].paiement === 0) {
          setPaymentAmount(results[0].montant_credit.toString());
        }
      } else if (results.length > 1) {
        setSearchResults(results);
        setMessage(`${results.length} crédits trouvés. Veuillez sélectionner le bon crédit.`);
      } else {
        setMessage('Aucun crédit trouvé avec ces critères de recherche');
      }
    } catch (error) {
      setMessage('Erreur lors de la recherche du crédit');
      console.error('Erreur:', error);
    }

    setIsSearching(false);
  };

  const selectCredit = (credit: CreditData): void => {
    setCreditData(credit);
    setSearchResults([]);
    setMessage('Crédit sélectionné avec succès');
    if (!credit.paiement || credit.paiement === 0) {
      setPaymentAmount(credit.montant_credit.toString());
    }
  };

  const handlePayment = async (): Promise<void> => {
    if (!creditData || !paymentAmount) {
      setMessage('Veuillez saisir un montant de paiement');
      return;
    }

    if (paymentMode === 'Cheque') {
      if (!numeroCheque || !banque || !dateEncaissementPrevue) {
        setMessage('Veuillez remplir tous les champs du chèque (numéro, banque, date d\'encaissement prévue)');
        return;
      }
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage('Veuillez saisir un montant valide');
      return;
    }

    // Vérifier que le solde est supérieur à 0
    if (!creditData.solde || creditData.solde <= 0) {
      setMessage('❌ Le solde du contrat est déjà à 0. Aucun paiement possible.');
      return;
    }

    // Vérifier que le montant du paiement ne dépasse pas le solde
    if (amount > creditData.solde) {
      setMessage(`❌ Le montant du paiement (${amount.toLocaleString('fr-FR')} DT) dépasse le solde (${creditData.solde.toLocaleString('fr-FR')} DT)`);
      return;
    }

    setIsProcessing(true);
    setMessage('');
    setVerificationDetails(null);

    try {
      const success = await updateCreditPayment(
        creditData.id,
        amount,
        creditData.assure,
        paymentMode,
        creditData.numero_contrat,
        paymentMode === 'Cheque' ? {
          numeroCheque,
          banque,
          dateEncaissementPrevue
        } : undefined
      );

      if (success) {
        // Vérification supplémentaire pour confirmer l'enregistrement
        const verification = await verifyPaymentInBothTables(creditData.id, amount);
        
        if (verification.success) {
          setMessage('✅ Paiement enregistré avec succès dans liste_credits et rapports');
          setVerificationDetails(verification);
          
          // Recharger les données du crédit
          const updatedCredit = await searchCreditByContractNumber(contractNumber);
          if (updatedCredit) {
            setCreditData(updatedCredit);
          }
          
          // Réinitialiser le formulaire
          setPaymentAmount('');
          setPaymentMode('Espece');
          setNumeroCheque('');
          setBanque('');
          setDateEncaissementPrevue('');
        } else {
          setMessage('⚠️ Paiement enregistré mais vérification incomplète');
        }
      } else {
        setMessage('❌ Erreur lors de l\'enregistrement du paiement');
      }
    } catch (error) {
      setMessage('❌ Erreur lors du traitement du paiement');
      console.error('Erreur:', error);
    }

    setIsProcessing(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const calculateNewSolde = (): number | null => {
    if (!creditData || !paymentAmount) return null;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount)) return null;
    return (creditData.solde || 0) - amount;
  };

  const resetSearch = (): void => {
    setContractNumber('');
    setInsuredName('');
    setCreditDate('');
    setSearchMonth('');
    setSearchYear('');
    setCreditData(null);
    setSearchResults([]);
    setMessage('');
    setPaymentAmount('');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <CreditCard className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Paiement de Crédit</h2>
        </div>

        {/* Recherche multi-critères améliorée */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rechercher un crédit</h3>
          <p className="text-sm text-gray-600 mb-4">
            Combinaisons possibles: Numéro contrat + Date crédit • Nom assuré + Date crédit • Mois + Année
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="inline w-4 h-4 mr-1" />
                Numéro de contrat
              </label>
              <input
                type="text"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: CI0555N00568667"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline w-4 h-4 mr-1" />
                Nom de l'assuré
              </label>
              <input
                type="text"
                value={insuredName}
                onChange={(e) => setInsuredName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Mohamed Ben Ali"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Date de paiement prévue
              </label>
              <input
                type="date"
                value={creditDate}
                onChange={(e) => setCreditDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mois de création
              </label>
              <select
                value={searchMonth}
                onChange={(e) => setSearchMonth(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner un mois</option>
                {months.map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Année de création
              </label>
              <select
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner une année</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={resetSearch}
              className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
            >
              Réinitialiser
            </button>
            
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center space-x-2"
            >
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Search className="w-5 h-5" />
              )}
              <span>{isSearching ? 'Recherche...' : 'Rechercher'}</span>
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm flex items-center space-x-2 ${
            message.includes('succès') || message.includes('trouvé') || message.includes('sélectionné')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : message.includes('crédits trouvés')
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.includes('succès') || message.includes('trouvé') || message.includes('sélectionné') ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message}</span>
          </div>
        )}

        {/* Section de vérification détaillée */}
        {verificationDetails && (
          <div className="bg-green-50 rounded-lg p-6 mb-6 border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Vérification Confirmée
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-semibold text-green-700 mb-2">Liste Credits</h4>
                <p><span className="font-medium">Solde:</span> {(verificationDetails.listeCredits?.solde || 0).toLocaleString('fr-FR')} DT</p>
                <p><span className="font-medium">Paiement total:</span> {(verificationDetails.listeCredits?.paiement || 0).toLocaleString('fr-FR')} DT</p>
                <p><span className="font-medium">Statut:</span> {verificationDetails.listeCredits?.statut}</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-semibold text-green-700 mb-2">Rapport</h4>
                <p><span className="font-medium">Montant:</span> {(verificationDetails.rapport?.montant || 0).toLocaleString('fr-FR')} DT</p>
                <p><span className="font-medium">Type:</span> {verificationDetails.rapport?.type}</p>
                <p><span className="font-medium">Date:</span> {new Date(verificationDetails.rapport?.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Liste des résultats multiples */}
        {searchResults.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-4">Sélectionnez le crédit souhaité</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {searchResults.map((credit) => (
                <div
                  key={credit.id}
                  onClick={() => selectCredit(credit)}
                  className="bg-white p-4 rounded-lg border border-yellow-200 hover:border-yellow-400 cursor-pointer transition-all duration-200 hover:shadow-md"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600">N° Contrat:</span>
                      <p className="text-sm font-semibold text-gray-900">{credit.numero_contrat}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600">Assuré:</span>
                      <p className="text-sm font-semibold text-gray-900">{credit.assure}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600">Montant crédit:</span>
                      <p className="text-sm font-semibold text-gray-900">{credit.montant_credit.toLocaleString('fr-FR')} DT</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600">Date création:</span>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(credit.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-gray-600">Paiement actuel:</span>
                      <span className="ml-1">{(credit.paiement || 0).toLocaleString('fr-FR')} DT</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Solde:</span>
                      <span className={`ml-1 font-semibold ${
                        (credit.solde || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(credit.solde || 0).toLocaleString('fr-FR')} DT
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Statut:</span>
                      <span className={`ml-1 px-2 py-1 text-xs font-semibold rounded-full ${
                        credit.statut === 'Payé' || credit.statut === 'Payé en total'
                          ? 'bg-green-100 text-green-800'
                          : credit.statut === 'En retard'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {credit.statut}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Informations du crédit trouvé */}
        {creditData && (
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">Informations du crédit</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <span className="text-sm font-medium text-blue-700">Numéro de contrat:</span>
                <p className="text-blue-900 font-semibold">{creditData.numero_contrat}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700">Assuré:</span>
                <p className="text-blue-900">{creditData.assure}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700">Branche:</span>
                <p className="text-blue-900">{creditData.branche}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700">Prime (DT):</span>
                <p className="text-blue-900 font-semibold">{creditData.prime.toLocaleString('fr-FR')}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700">Montant crédit (DT):</span>
                <p className="text-blue-900 font-semibold">{creditData.montant_credit.toLocaleString('fr-FR')}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700">Paiement actuel (DT):</span>
                <p className="text-blue-900 font-semibold">{(creditData.paiement || 0).toLocaleString('fr-FR')}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700">Solde actuel (DT):</span>
                <p className={`font-semibold ${
                  (creditData.solde || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(creditData.solde || 0).toLocaleString('fr-FR')}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700">Statut:</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ml-2 ${
                  creditData.statut === 'Payé' || creditData.statut === 'Payé en total'
                    ? 'bg-green-100 text-green-800'
                    : creditData.statut === 'En retard'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-orange-100 text-orange-800'
                }`}>
                  {creditData.statut}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire de paiement */}
        {creditData && (
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-4">Enregistrer un paiement</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="inline w-4 h-4 mr-1" />
                  Montant du paiement (DT)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  max={creditData.solde || 0}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Banknote className="inline w-4 h-4 mr-1" />
                  Mode de paiement
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as 'Espece' | 'Cheque' | 'Carte Bancaire')}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="Espece">Espèce</option>
                  <option value="Cheque">Chèque</option>
                  <option value="Carte Bancaire">Carte Bancaire</option>
                </select>
              </div>

              {paymentAmount && (
                <div className="flex items-end">
                  <div className="w-full">
                    <span className="block text-sm font-medium text-gray-700 mb-2">Nouveau solde (DT):</span>
                    <div className={`p-3 rounded-lg font-semibold text-lg ${
                      (calculateNewSolde() || 0) >= 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {(calculateNewSolde() || 0).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Champs supplémentaires pour le paiement par chèque */}
            {paymentMode === 'Cheque' && (
              <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-4">Informations du chèque</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro du chèque *
                    </label>
                    <input
                      type="text"
                      value={numeroCheque}
                      onChange={(e) => setNumeroCheque(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 1234567"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Banque *
                    </label>
                    <input
                      type="text"
                      value={banque}
                      onChange={(e) => setBanque(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: BIAT"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date d'encaissement prévue *
                    </label>
                    <input
                      type="date"
                      value={dateEncaissementPrevue}
                      onChange={(e) => setDateEncaissementPrevue(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handlePayment}
                disabled={isProcessing || !paymentAmount}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center space-x-2"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                <span>{isProcessing ? 'Traitement...' : 'Valider le paiement'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditPayment;