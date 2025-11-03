import React, { useState } from 'react';
import { LogOut, FileText, Download, AlertCircle, X } from 'lucide-react';
import { printSessionReport } from '../utils/pdfGenerator';
import { saveSessionData } from '../utils/sessionService';
import { getSessionDate, logoutUser } from '../utils/auth';

interface LogoutConfirmationProps {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const LogoutConfirmation: React.FC<LogoutConfirmationProps> = ({ username, onConfirm, onCancel }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    setPdfError(false);
    
    try {
      console.log('🔄 Génération du PDF en cours...');
      const success = await printSessionReport(username);
      
      if (success) {
        setPdfGenerated(true);
        console.log('✅ PDF généré avec succès');
      } else {
        setPdfError(true);
        console.error('❌ Échec de la génération du PDF');
      }
    } catch (error) {
      console.error('❌ Erreur génération PDF:', error);
      setPdfError(true);
    }
    
    setIsGeneratingPDF(false);
  };

  const handleConfirmLogout = async () => {
    try {
      // Sauvegarder les données de session avant de se déconnecter
      const dateSession = getSessionDate();
      const sessionSaved = await saveSessionData(username, dateSession);
      
      if (!sessionSaved) {
        console.warn('⚠️ Erreur lors de la sauvegarde de la session, mais déconnexion quand même');
      }

      // Fermer la session utilisateur
      await logoutUser(username);
      
      // Appeler la callback de confirmation
      onConfirm();
      
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
      // Déconnecter quand même même en cas d'erreur
      onConfirm();
    }
  };

  const handleCancel = () => {
    onCancel();
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
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF || pdfGenerated}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              pdfGenerated
                ? 'bg-green-100 text-green-800 border border-green-300 cursor-default'
                : isGeneratingPDF
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
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

          {pdfError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <p>Erreur lors de la génération du PDF. Veuillez réessayer.</p>
              <button
                onClick={handleGeneratePDF}
                className="mt-2 text-red-600 underline text-xs"
              >
                Réessayer la génération
              </button>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              <X className="w-4 h-4" />
              <span>Annuler</span>
            </button>
            
            <button
              onClick={handleConfirmLogout}
              disabled={!pdfGenerated}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                pdfGenerated
                  ? 'bg-red-600 hover:bg-red-700 text-white hover:shadow-lg'
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

        {/* Option de contournement en cas de problème PDF */}
        {pdfError && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">
              <strong>Problème technique ?</strong> Si la génération échoue, vous pouvez quand même vous déconnecter.
            </p>
            <button
              onClick={handleConfirmLogout}
              className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-colors duration-200"
            >
              Se déconnecter sans PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoutConfirmation;