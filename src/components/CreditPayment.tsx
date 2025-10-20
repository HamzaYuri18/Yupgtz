import React, { useState } from 'react';
import { Search, DollarSign, CheckCircle, AlertCircle, CreditCard, Banknote } from 'lucide-react';
import { searchCreditByContractNumber, updateCreditPayment } from '../utils/supabaseService';

const CreditPayment: React.FC = () => {
  const [contractNumber, setContractNumber] = useState('');
  const [creditData, setCreditData] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Espece' | 'Cheque'>('Espece');
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const handleSearch = async () => {
    if (!contractNumber.trim()) {
      setMessage('Veuillez saisir un numéro de contrat');
      return;
    }

    setIsSearching(true);
    setMessage('');
    setCreditData(null);

    try {
      const result = await searchCreditByContractNumber(contractNumber);
      
      if (result) {
        setCreditData(result);
        setMessage('Crédit trouvé avec succès');
        // Pré-remplir avec le montant du crédit si aucun paiement n'a été fait
        if (!result.paiement || result.paiement === 0) {
          setPaymentAmount(result.montant_credit.toString());
        }
      } else {
        setMessage('Aucun crédit trouvé pour ce numéro de contrat');
      }
    } catch (error) {
      setMessage('Erreur lors de la recherche du crédit');
      console.error('Erreur:', error);
    }

    setIsSearching(false);
  };

  const handlePayment = async () => {
    if (!creditData || !paymentAmount) {
      setMessage('Veuillez saisir un montant de paiement');
      return;
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
        paymentMode
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

        {/* Recherche par numéro de contrat */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rechercher un crédit</h3>
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de contrat
              </label>
              <input
                type="text"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Saisissez le numéro de contrat"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex items-end">
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
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm flex items-center space-x-2 ${
            message.includes('succès') || message.includes('trouvé')
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.includes('succès') || message.includes('trouvé') ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message}</span>
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
                  onChange={(e) => setPaymentMode(e.target.value as 'Espece' | 'Cheque')}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="Espece">Espèce</option>
                  <option value="Cheque">Chèque</option>
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
