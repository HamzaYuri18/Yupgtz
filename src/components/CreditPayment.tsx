import React, { useState } from 'react';
import { Search, DollarSign, CheckCircle, AlertCircle, CreditCard, Banknote, Calendar, User, Database, RefreshCw } from 'lucide-react';
import { searchCreditByContractNumber, updateCreditPayment } from '../utils/supabaseService';
import { searchCreditFlexible } from '../utils/creditSearchService';
import { verifyPaymentInTables } from '../utils/paymentVerificationService'; // Nouveau service à créer

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
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // Nouvelle fonction pour vérifier l'enregistrement
  const verifyPaymentRegistration = async (creditId: string, paymentAmount: number) => {
    setIsVerifying(true);
    try {
      const result = await verifyPaymentInTables(creditId, paymentAmount);
      setVerificationResult(result);
      
      if (result.success) {
        setMessage(prev => prev + ' ✅ Vérification des enregistrements réussie');
      } else {
        setMessage(prev => prev + ' ⚠️ Problème détecté dans les enregistrements');
      }
      
      return result.success;
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      setMessage(prev => prev + ' ❌ Erreur lors de la vérification');
      return false;
    } finally {
      setIsVerifying(false);
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
    setVerificationResult(null);

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
        let finalMessage = '✅ Paiement enregistré avec succès';
        
        // Vérification automatique après l'enregistrement
        const verificationSuccess = await verifyPaymentRegistration(creditData.id, amount);
        
        if (verificationSuccess) {
          finalMessage += ' - Vérification des tables réussie';
        } else {
          finalMessage += ' - Vérification des tables échouée';
        }

        setMessage(finalMessage);
        
        // Recharger les données du crédit
        const updatedCredit = await searchCreditByContractNumber(contractNumber);
        if (updatedCredit) {
          setCreditData(updatedCredit);
        }
        
        // Réinitialiser les champs
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
    setTimeout(() => setMessage(''), 8000);
  };

  // Fonction pour vérifier manuellement
  const handleManualVerification = async () => {
    if (!creditData || !paymentAmount) {
      setMessage('Aucun paiement à vérifier');
      return;
    }
    
    const amount = parseFloat(paymentAmount);
    await verifyPaymentRegistration(creditData.id, amount);
  };

  // ... le reste du code reste inchangé jusqu'à la section d'affichage ...

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* ... le code précédent reste inchangé ... */}

        {/* Section de vérification */}
        {verificationResult && (
          <div className="mt-6 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Vérification des enregistrements
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className={`p-4 rounded-lg ${
                verificationResult.liste_credits ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Table liste_credits</span>
                  {verificationResult.liste_credits ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                {verificationResult.liste_credits_details && (
                  <div className="mt-2 text-sm">
                    <p>Solde mis à jour: {verificationResult.liste_credits_details.nouveau_solde} DT</p>
                    <p>Paiement total: {verificationResult.liste_credits_details.paiement_total} DT</p>
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-lg ${
                verificationResult.rapport ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Table rapport</span>
                  {verificationResult.rapport ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                {verificationResult.rapport_details && (
                  <div className="mt-2 text-sm">
                    <p>Enregistrement créé le: {verificationResult.rapport_details.date_creation}</p>
                    <p>Type: {verificationResult.rapport_details.type_operation}</p>
                  </div>
                )}
              </div>
            </div>

            {verificationResult.success ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Tous les enregistrements sont corrects
                </p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Problème détecté dans les enregistrements
                </p>
                <button
                  onClick={handleManualVerification}
                  disabled={isVerifying}
                  className="mt-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg flex items-center space-x-2"
                >
                  {isVerifying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>Re-vérifier</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bouton de vérification manuelle */}
        {creditData && paymentAmount && !verificationResult && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleManualVerification}
              disabled={isVerifying}
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg flex items-center space-x-2"
            >
              {isVerifying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              <span>Vérifier les enregistrements</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditPayment;