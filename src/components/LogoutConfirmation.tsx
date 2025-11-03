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
      // Sauvegarder les données de session avant de fermer l'application
      const dateSession = getSessionDate();
      await saveSessionData(username, dateSession);
      
      // Fermer la session utilisateur dans la base de données
      await logoutUser(username);
      
      console.log('🚪 Fermeture de l\'application...');
      
      // Fermer l'application/onglet du navigateur
      window.close(); // Tente de fermer l'onglet actuel
      
      // Si window.close() ne fonctionne pas (pour des raisons de sécurité), on redirige vers une page vide
      setTimeout(() => {
        window.location.href = 'about:blank';
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
      // Fermer l'application quand même en cas d'erreur
      window.close();
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  // Fonction pour forcer la fermeture (méthode alternative)
  const forceCloseApp = () => {
    // Méthode 1: Fermer l'onglet
    if (window.opener) {
      window.close();
    } else {
      // Méthode 2: Rediriger vers une page blanche
      window.location.href = 'about:blank';
      // Méthode 3: Fermer la fenêtre (peut ne pas fonctionner selon le navigateur)
      setTimeout(() => {
        window.open('', '_self')?.close();
      }, 100);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-orange-100 rounded-full">
            <AlertCircle className="w-6 h-6 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Fermeture de l'Application</h2>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            <strong>Attention :</strong> L'application va se fermer complètement. Assurez-vous d'avoir imprimé la Fiche de Caisse.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">Fiche de Caisse - Session {username}</span>
            </div>
            <p className="text-sm text-blue-700">
              Génération recommandée avant la fermeture de l'application.
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
                <span>Générer la Fiche de Caisse</span>
              </>
            )}
          </button>

          {pdfError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <p>Erreur lors de la génération du PDF.</p>
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
              className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 hover:shadow-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>Fermer l'App</span>
            </button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            ⚠️ L'application se fermera complètement
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Rouvrez-la manuellement pour une nouvelle session
          </p>
        </div>

        {/* Option de fermeture immédiate */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700 mb-2">
            <strong>Fermeture urgente ?</strong>
          </p>
          <button
            onClick={forceCloseApp}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Fermer Immédiatement</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmation;