import React, { useState } from 'react';
import { LogOut, FileText, Download, AlertCircle, X, Key } from 'lucide-react';
import { printSessionReport } from '../utils/pdfGenerator';
import { saveSessionData } from '../utils/sessionService';
import { getSessionDate, lockUserForToday, isRestrictedUser } from '../utils/auth';
import { supabase } from '../lib/supabase';

interface LogoutConfirmationProps {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const LogoutConfirmation: React.FC<LogoutConfirmationProps> = ({ username, onConfirm, onCancel }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [isCancelLocked, setIsCancelLocked] = useState(false);
  const [showReminderAlert, setShowReminderAlert] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [clotureCle, setClotureCle] = useState('');
  const [cleError, setCleError] = useState('');
  const [isValidatingCle, setIsValidatingCle] = useState(false);

  // Sauvegarder la session si l'utilisateur ferme l'application après avoir généré la FC
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pdfGenerated) {
        const dateSession = getSessionDate();
        saveSessionData(username, dateSession, false);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pdfGenerated, username]);

  const handleGeneratePDFClick = () => {
    setClotureCle('');
    setCleError('');
    setShowKeyModal(true);
  };

  const handleValidateCle = async () => {
    if (!clotureCle.trim()) {
      setCleError('Veuillez saisir la clé de clôture.');
      return;
    }
    setIsValidatingCle(true);
    setCleError('');
    try {
      const iso = getSessionDate(); // YYYY-MM-DD
      const [y, m, d] = iso.split('-');
      const dateSession = `${d}/${m}/${y}`; // DD/MM/YYYY comme en base
      const { data, error } = await supabase
        .from('keysconformity')
        .select('cle')
        .eq('date_input', dateSession)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCleError('Aucune clé de clôture trouvée pour cette session. Veuillez vérifier la clé de clôture convenablement.');
        setIsValidatingCle(false);
        return;
      }

      if (data.cle !== clotureCle.trim()) {
        setCleError('Clé erronée ! Veuillez vérifier la clé de clôture convenablement.');
        setIsValidatingCle(false);
        return;
      }

      // Clé valide — fermer le modal et générer le PDF
      setShowKeyModal(false);
      setClotureCle('');
      setIsValidatingCle(false);
      await doGeneratePDF();
    } catch (err) {
      console.error('Erreur validation clé:', err);
      setCleError('Erreur lors de la vérification. Réessayez.');
      setIsValidatingCle(false);
    }
  };

  const doGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    setIsCancelLocked(true);
    try {
      await printSessionReport(username);
      setPdfGenerated(true);
      setShowReminderAlert(true);

      const dateSession = getSessionDate();
      const saved = await saveSessionData(username, dateSession, false);

      if (!saved) {
        console.error('Erreur sauvegarde session après génération FC');
      }

      // Bloquer l'utilisateur restreint dès la génération réussie de la FC
      if (isRestrictedUser(username)) {
        await lockUserForToday(username, 'fc_generated');
      }
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      alert('Erreur lors de la génération du PDF');
      setIsCancelLocked(false);
    }
    setIsGeneratingPDF(false);
  };

  const handleConfirmLogout = async () => {
    if (!pdfGenerated) {
      alert('Veuillez d\'abord générer et télécharger la Fiche de Caisse');
      return;
    }

    // Marquer la session comme fermée à la déconnexion
    const dateSession = getSessionDate();
    await saveSessionData(username, dateSession, true);

    // Bloquer l'utilisateur restreint à la déconnexion (peut déjà être fait via fc_generated)
    if (isRestrictedUser(username)) {
      await lockUserForToday(username, 'logout');
    }

    onConfirm();
  };

  const handleCancel = () => {
    if (!isCancelLocked) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-orange-100 rounded-full">
            <AlertCircle className="w-6 h-6 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Confirmation de déconnexion</h2>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            <strong>Obligatoire :</strong> Vous devez imprimer la Fiche de Caisse (FC) de votre session avant de vous déconnecter.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">Fiche de Caisse - Session {username}</span>
            </div>
            <p className="text-sm text-blue-700">
              La FC contient toutes les opérations de votre session avec le total calculé depuis la table rapport Supabase et un code QR de signature.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleGeneratePDFClick}
            disabled={isGeneratingPDF || pdfGenerated}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              pdfGenerated
                ? 'bg-green-100 text-green-800 border border-green-300'
                : isGeneratingPDF
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isGeneratingPDF ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Génération en cours...</span>
              </>
            ) : pdfGenerated ? (
              <>
                <Download className="w-5 h-5" />
                <span>✅ FC générée et téléchargée</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>Générer et télécharger la FC</span>
              </>
            )}
          </button>

          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              disabled={isCancelLocked}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                isCancelLocked
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              <X className="w-4 h-4" />
              <span>Annuler</span>
            </button>
            
            <button
              onClick={handleConfirmLogout}
              disabled={!pdfGenerated}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                pdfGenerated
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>

        {!pdfGenerated && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              ⚠️ Impression FC obligatoire pour tous les utilisateurs
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Sessions automatiquement clôturées à minuit
            </p>
          </div>
        )}
      </div>

      {showReminderAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-lg w-full mx-4 border-4 border-amber-400">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">RAPPELS IMPORTANTS</h2>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                  <span className="text-2xl">1️⃣</span>
                  <span>Impression de la Fiche de Caisse</span>
                </h3>
                <p className="text-red-700">
                  Imprimez la FC générée avant de cliquer sur Déconnecter
                </p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <span className="text-2xl">2️⃣</span>
                  <span>Vérification des Tâches</span>
                </h3>
                <p className="text-blue-700">
                  Vérifiez toutes les tâches non accomplies de la journée et saisissez vos remarques pour chaque tâche
                </p>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <h3 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                  <span className="text-2xl">3️⃣</span>
                  <span>Déconnexion</span>
                </h3>
                <p className="text-green-700">
                  Une fois l'impression terminée et les tâches vérifiées, cliquez sur le bouton Se déconnecter
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowReminderAlert(false)}
                className="px-8 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold transition-colors text-lg"
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}

      {showKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2 bg-blue-100 rounded-full">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Clé de clôture</h2>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Saisissez la clé de clôture de cette session pour pouvoir générer la Fiche de Caisse.
            </p>

            <input
              type="password"
              value={clotureCle}
              onChange={e => { setClotureCle(e.target.value); setCleError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleValidateCle(); }}
              placeholder="Clé de clôture..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              autoFocus
            />

            {cleError && (
              <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{cleError}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => { setShowKeyModal(false); setClotureCle(''); setCleError(''); }}
                disabled={isValidatingCle}
                className="flex-1 py-2 px-4 rounded-lg font-semibold text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleValidateCle}
                disabled={isValidatingCle}
                className="flex-1 py-2 px-4 rounded-lg font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-gray-300 disabled:text-gray-500"
              >
                {isValidatingCle ? 'Vérification...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogoutConfirmation;