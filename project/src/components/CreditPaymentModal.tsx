import React, { useState, useRef } from 'react';
import { X, DollarSign, Banknote, CheckCircle, AlertCircle, Calendar, CreditCard } from 'lucide-react';
import { updateCreditPayment } from '../utils/supabaseService';

interface CreditPaymentModalProps {
  isOpen: boolean;
  credit: any | null;
  isHamza: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({
  isOpen,
  credit,
  isHamza,
  onClose,
  onPaymentSuccess,
}) => {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Espece' | 'Cheque' | 'Carte Bancaire'>('Espece');
  const [numeroCheque, setNumeroCheque] = useState('');
  const [banque, setBanque] = useState('');
  const [dateEncaissementPrevue, setDateEncaissementPrevue] = useState('');
  const [customDatePaiement, setCustomDatePaiement] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const isSubmittingRef = useRef(false);

  if (!isOpen || !credit) return null;

  const newSolde = (() => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount)) return null;
    return (credit.solde || 0) - amount;
  })();

  const handleClose = () => {
    setPaymentAmount('');
    setPaymentMode('Espece');
    setNumeroCheque('');
    setBanque('');
    setDateEncaissementPrevue('');
    setCustomDatePaiement('');
    setMessage('');
    onClose();
  };

  const handlePayment = async () => {
    if (isSubmittingRef.current) return;

    if (!paymentAmount) {
      setMessage('Veuillez saisir un montant de paiement');
      return;
    }
    if (paymentMode === 'Cheque' && (!numeroCheque || !banque || !dateEncaissementPrevue)) {
      setMessage("Veuillez remplir tous les champs du chèque");
      return;
    }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage('Montant invalide');
      return;
    }
    if (!credit.solde || credit.solde <= 0) {
      setMessage('❌ Le solde est déjà à 0. Aucun paiement possible.');
      return;
    }
    if (amount > credit.solde) {
      setMessage(`❌ Le montant dépasse le solde (${credit.solde.toLocaleString('fr-FR')} DT)`);
      return;
    }

    isSubmittingRef.current = true;
    setIsProcessing(true);
    setMessage('');

    try {
      const success = await updateCreditPayment(
        credit.id,
        amount,
        credit.assure,
        paymentMode,
        credit.numero_contrat,
        paymentMode === 'Cheque' ? { numeroCheque, banque, dateEncaissementPrevue } : undefined,
        isHamza && customDatePaiement ? customDatePaiement : undefined,
      );

      if (success) {
        setMessage('✅ Paiement enregistré avec succès');
        onPaymentSuccess();
        setTimeout(() => handleClose(), 1500);
      } else {
        setMessage("❌ Erreur lors de l'enregistrement du paiement");
      }
    } catch {
      setMessage('❌ Erreur lors du traitement du paiement');
    } finally {
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-gray-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-emerald-300" />
            <div>
              <h2 className="text-lg font-bold">Paiement de Crédit</h2>
              <p className="text-emerald-200 text-xs truncate max-w-[260px]">
                {credit.assure} — {credit.numero_contrat}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Credit summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium mb-1">Montant crédit</p>
              <p className="text-sm font-bold text-blue-900">
                {(credit.montant_credit || 0).toLocaleString('fr-FR')} DT
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-600 font-medium mb-1">Déjà payé</p>
              <p className="text-sm font-bold text-green-900">
                {(credit.paiement || 0).toLocaleString('fr-FR')} DT
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xs text-red-600 font-medium mb-1">Solde restant</p>
              <p className="text-sm font-bold text-red-900">
                {(credit.solde || 0).toLocaleString('fr-FR')} DT
              </p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <DollarSign className="inline w-4 h-4 mr-1" />
              Montant du paiement (DT) *
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              step="0.01"
              min="0"
              max={credit.solde || 0}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="0.00"
            />
          </div>

          {/* Payment mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Banknote className="inline w-4 h-4 mr-1" />
              Mode de paiement
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as 'Espece' | 'Cheque' | 'Carte Bancaire')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="Espece">Espèce</option>
              <option value="Cheque">Chèque</option>
              <option value="Carte Bancaire">Carte Bancaire</option>
            </select>
          </div>

          {/* Cheque fields */}
          {paymentMode === 'Cheque' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">Informations du chèque</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">N° Chèque *</label>
                  <input
                    type="text"
                    value={numeroCheque}
                    onChange={(e) => setNumeroCheque(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="1234567"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Banque *</label>
                  <input
                    type="text"
                    value={banque}
                    onChange={(e) => setBanque(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="BIAT"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date d'encaissement prévue *
                </label>
                <input
                  type="date"
                  value={dateEncaissementPrevue}
                  onChange={(e) => setDateEncaissementPrevue(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          )}

          {/* Date paiement — Hamza uniquement */}
          {isHamza && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-purple-800 mb-1.5">
                <Calendar className="w-4 h-4" />
                Date de paiement effectif
                <span className="text-xs font-normal text-purple-600">— Hamza uniquement</span>
              </label>
              <input
                type="date"
                value={customDatePaiement}
                onChange={(e) => setCustomDatePaiement(e.target.value)}
                className="w-full p-2.5 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white"
              />
              <p className="text-xs text-purple-600 mt-1">
                Laisser vide pour utiliser la date d'aujourd'hui
              </p>
            </div>
          )}

          {/* New solde preview */}
          {paymentAmount && newSolde !== null && (
            <div
              className={`rounded-lg p-3 text-center font-semibold text-sm ${
                newSolde <= 0
                  ? 'bg-green-100 text-green-800'
                  : 'bg-orange-100 text-orange-800'
              }`}
            >
              Nouveau solde : {newSolde.toLocaleString('fr-FR')} DT
              {newSolde <= 0 && ' — Crédit soldé ✅'}
            </div>
          )}

          {/* Message */}
          {message && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                message.includes('✅')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.includes('✅') ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handlePayment}
            disabled={isProcessing || !paymentAmount}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-gray-900 text-white font-bold text-sm hover:from-emerald-400 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {isProcessing ? 'Traitement...' : 'Valider le paiement'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditPaymentModal;
