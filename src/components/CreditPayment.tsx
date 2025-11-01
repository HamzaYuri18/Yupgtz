import React, { useState } from 'react';
import { Search, DollarSign, CheckCircle, AlertCircle, CreditCard, Banknote, Calendar, User } from 'lucide-react';
import { searchCreditByContractNumber, updateCreditPayment } from '../utils/supabaseService';
import { searchCreditFlexible } from '../utils/creditSearchService';

const CreditPayment: React.FC = () => {
  const [contractNumber, setContractNumber] = useState('');
  const [insuredName, setInsuredName] = useState('');
  const [creditDate, setCreditDate] = useState('');
  const [creditData, setCreditData] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Espece' | 'Cheque' | 'Carte Bancaire'>('Espece');
  const [numeroCheque, setNumeroCheque] = useState('');
  const [banque, setBanque] = useState('');
  const [dateEncaissementPrevue, setDateEncaissementPrevue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = async () => {
    // Validation: au moins 2 champs doivent être remplis
    const filledFields = [
      contractNumber.trim(),
      insuredName.trim(),
      creditDate.trim()
    ].filter(field => field !== '').length;

    if (filledFields < 2) {
      setMessage('Veuillez remplir au moins 2 champs de recherche');
      return;
    }

    setIsSearching(true);
    setMessage('');
    setCreditData(null);
    setSearchResults([]);

    try {
      const results = await searchCreditFlexible(
        contractNumber.trim() || null,
        insuredName.trim() || null,
        creditDate.trim() || null
      );

      if (results.length === 1) {
        // Un seul résultat trouvé
        setCreditData(results[0]);
        setMessage('Crédit trouvé avec succès');
        // Pré-remplir avec le montant du crédit si aucun paiement n'a été fait
        if (!results[0].paiement || results[0].paiement === 0) {
          setPaymentAmount(results[0].montant_credit.toString());
        }
      } else if (results.length > 1) {
        // Plusieurs résultats trouvés
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

  const selectCredit = (credit: any) => {
    setCreditData(credit);
    setSearchResults([]);
    setMessage('Crédit sélectionné avec succès');
    // Pré-remplir avec le montant du crédit si aucun paiement n'a été fait
    if (!credit.paiement || credit.paiement === 0) {
      setPaymentAmount(credit.montant_credit.toString());
    }
  };

  const handlePayment = async () => {
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
        setMessage('✅ Paiement enregistré avec succès');
        // Recharger les données du crédit
        const updatedCredit = await searchCreditByContractNumber(contractNumber);
        if (updatedCredit) {
          setCreditData(updatedCredit);
        }
        setPaymentAmount('');
        setPaymentMode('Espece');
        setNumeroCheque('');
        setBanque('');
        setDateEncaissementPrevue('');
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

  const calculateNewSolde = () => {
    if (!creditData || !paymentAmount) return null;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount)) return null;
    return creditData.solde - amount;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <CreditCard className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Paiement de Crédit</h2>
        </div>

        {/* Recherche multi-critères */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rechercher un crédit</h3>
          <p className="text-sm text-gray-600 mb-4">Remplissez au moins 2 champs parmi les 3 disponibles</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                placeholder="Ex: 12345"
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
                Date de création du crédit
              </label>
              <input
                type="date"
                value={creditDate}
                onChange={(e) => setCreditDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end">
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

        {/* Liste des résultats multiples */}
        {searchResults.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-4">Sélectionnez le crédit souhaité</h3>
            <div className="space-y-3">
              {searchResults.map((credit) => (
                <div
                  key={credit.id}
                  onClick={() => selectCredit(credit)}
                  className="bg-white p-4 rounded-lg border border-yellow-200 hover:border-yellow-400 cursor-pointer transition-all duration-200 hover:shadow-md"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600">N° Contrat:</span>
                      <p className="text-sm font-semibold text-gray-900">{credit.numero_contrat}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600">Assuré:</span>
                      <p className="text-sm font-semibold text-gray-900">{credit.assure}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600">Montant:</span>
                      <p className="text-sm font-semibold text-gray-900">{credit.montant_credit.toLocaleString('fr-FR')} DT</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600">Date:</span>
                      <p className="text-sm font-semibold text-gray-900">{new Date(credit.created_at).toLocaleDateString('fr-FR')}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  creditData.statut === 'Payé' 
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