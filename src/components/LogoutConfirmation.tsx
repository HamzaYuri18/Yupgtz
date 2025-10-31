import React, { useState } from 'react';
import { LogOut, FileText, Download, AlertCircle, X } from 'lucide-react';
import { printSessionReport } from '../utils/pdfGenerator';
import { saveSessionData } from '../utils/sessionService';
import { getSessionDate } from '../utils/auth';

interface LogoutConfirmationProps {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const LogoutConfirmation: React.FC<LogoutConfirmationProps> = ({ username, onConfirm, onCancel }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      await printSessionReport(username);
      setPdfGenerated(true);
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      alert('Erreur lors de la génération du PDF');
    }
    setIsGeneratingPDF(false);
  };

  const handleConfirmLogout = async () => {
    if (!pdfGenerated) {
      alert('Veuillez d\'abord générer et télécharger la Fiche de Caisse');
      return;
    }

    // Sauvegarder les données de session avant de se déconnecter
    const dateSession = getSessionDate();
    await saveSessionData(username, dateSession);

    onConfirm();
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
              onClick={onCancel}
              className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-all duration-200"
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
    </div>
  );
};

export default LogoutConfirmation;