import React, { useState } from 'react';
import { LogOut, FileText, Download, AlertCircle, X, Key, Wallet, ShieldCheck } from 'lucide-react';
import { printSessionReport } from '../utils/pdfGenerator';
import { saveSessionData } from '../utils/sessionService';
import { getSessionDate, lockUserForToday, isRestrictedUser } from '../utils/auth';
import { getCreditsDueToday } from '../utils/supabaseService';
import { supabase } from '../lib/supabase';
import CreditDateValidationModal from './CreditDateValidationModal';

interface LogoutConfirmationProps {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface UnpaidCredit {
  id: string;
  numero_contrat: string;
  assure: string;
  montant_credit: number;
  solde: number | null;
  statut: string;
  date_paiement_prevue: string;
}

type ReportingMotif = 'report_client' | 'injoignable' | 'partiel';

const MOTIF_LABELS: Record<ReportingMotif, string> = {
  report_client: 'Date de paiement reportée suite demande du client',
  injoignable: 'Client injoignable',
  partiel: 'Crédit payé partiellement',
};

interface CreditReportingEntry {
  motif: ReportingMotif | '';
  nouvelleDate: string;
  telegramValidated: boolean;
}

const addDaysISO = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const diffDaysISO = (a: string, b: string): number =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);

const LogoutConfirmation: React.FC<LogoutConfirmationProps> = ({ username, onConfirm, onCancel }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [isCancelLocked, setIsCancelLocked] = useState(false);
  const [showReminderAlert, setShowReminderAlert] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [clotureCle, setClotureCle] = useState('');
  const [cleError, setCleError] = useState('');
  const [isValidatingCle, setIsValidatingCle] = useState(false);
  const [showTasksBlockingModal, setShowTasksBlockingModal] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [isCheckingTasks, setIsCheckingTasks] = useState(false);
  const [showCreditReportingModal, setShowCreditReportingModal] = useState(false);
  const [unpaidCreditsToday, setUnpaidCreditsToday] = useState<UnpaidCredit[]>([]);
  const [creditEntries, setCreditEntries] = useState<{ [key: string]: CreditReportingEntry }>({});
  const [creditReportingError, setCreditReportingError] = useState('');
  const [isSavingCreditReporting, setIsSavingCreditReporting] = useState(false);
  const [pendingTelegramValidation, setPendingTelegramValidation] = useState<{ creditId: string; numeroContrat: string; assure: string; ancienneDate: string; nouvelleDate: string } | null>(null);

  const updateCreditEntry = (creditId: string, patch: Partial<CreditReportingEntry>) => {
    setCreditEntries(prev => ({
      ...prev,
      [creditId]: { motif: '', nouvelleDate: '', telegramValidated: false, ...prev[creditId], ...patch },
    }));
  };

  const getEffectiveNouvelleDate = (credit: UnpaidCredit, entry?: CreditReportingEntry): string => {
    if (!entry) return '';
    if (entry.motif === 'injoignable') return addDaysISO(credit.date_paiement_prevue, 2);
    return entry.nouvelleDate;
  };

  const isCreditReady = (credit: UnpaidCredit): boolean => {
    const entry = creditEntries[credit.id];
    if (!entry || !entry.motif) return false;
    if (entry.motif === 'injoignable') return true;
    if (!entry.nouvelleDate) return false;
    const diff = diffDaysISO(credit.date_paiement_prevue, entry.nouvelleDate);
    if (diff <= 0) return false;
    if (entry.motif === 'partiel') return diff <= 7;
    // report_client
    if (diff <= 7) return true;
    return entry.telegramValidated;
  };

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

  const openKeyModal = () => {
    setClotureCle('');
    setCleError('');
    setShowKeyModal(true);
  };

  // Avant même de demander la clé de clôture : aucune tâche "A faire" de
  // cette session ne doit rester sans reporting, et tous les crédits à payer
  // aujourd'hui doivent être payés en totalité (sinon un reporting de
  // recouvrement est exigé). En cas d'erreur de vérification (réseau…), on
  // laisse passer plutôt que de bloquer la clôture pour un souci technique.
  const handleGeneratePDFClick = async () => {
    setIsCheckingTasks(true);
    try {
      const sessionDate = getSessionDate();
      const { count, error } = await supabase
        .from('taches')
        .select('*', { count: 'exact', head: true })
        .eq('date_effectuer', sessionDate)
        .eq('statut', 'A faire');

      if (error) throw error;

      if ((count || 0) > 0) {
        setPendingTasksCount(count || 0);
        setShowTasksBlockingModal(true);
        return;
      }

      const unpaidCredits = await getCreditsDueToday(sessionDate);
      if (unpaidCredits.length > 0) {
        setUnpaidCreditsToday(unpaidCredits);
        setCreditEntries({});
        setCreditReportingError('');
        setShowCreditReportingModal(true);
        return;
      }
    } catch (err) {
      console.error('Erreur lors de la vérification des tâches/crédits avant clôture:', err);
    } finally {
      setIsCheckingTasks(false);
    }

    openKeyModal();
  };

  const handleSaveCreditReporting = async () => {
    const notReady = unpaidCreditsToday.some((credit) => !isCreditReady(credit));
    if (notReady) {
      setCreditReportingError('Veuillez choisir un motif et une date valides pour chaque crédit (et obtenir la validation de Hamza si la date dépasse 7 jours).');
      return;
    }

    setIsSavingCreditReporting(true);
    setCreditReportingError('');
    try {
      const sessionDate = getSessionDate();
      const rows = unpaidCreditsToday.map((credit) => {
        const entry = creditEntries[credit.id];
        const motifLabel = MOTIF_LABELS[entry.motif as ReportingMotif];
        return {
          numero_contrat: credit.numero_contrat,
          assure: credit.assure,
          montant_credit: credit.montant_credit,
          solde: credit.solde ?? credit.montant_credit,
          statut: credit.statut,
          reporting: motifLabel,
          motif: motifLabel,
          ancienne_date_paiement: credit.date_paiement_prevue,
          nouvelle_date_paiement: getEffectiveNouvelleDate(credit, entry),
          utilisateur: username,
          session_date: sessionDate,
        };
      });

      const { error } = await supabase.from('reporting_recouvrement').insert(rows);
      if (error) throw error;

      setShowCreditReportingModal(false);
      openKeyModal();
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement du reporting de recouvrement:', err);
      setCreditReportingError('Erreur lors de l\'enregistrement du reporting. Réessayez.');
    } finally {
      setIsSavingCreditReporting(false);
    }
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
        .select('cle, created_at, rapport_modified_at')
        .eq('date_input', dateSession)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCleError('Aucune clé de clôture trouvée pour cette session. Veuillez vérifier la clé de clôture convenablement.');
        setIsValidatingCle(false);
        return;
      }

      // Vérifier si la clé est périmée (rapport modifié après la création de la clé)
      if (data.rapport_modified_at && data.created_at && new Date(data.rapport_modified_at) > new Date(data.created_at)) {
        setCleError('Cette clé de clôture est périmée ! Des modifications ont été effectuées sur la session après la génération de la clé. Veuillez demander une nouvelle clé de clôture.');
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
            disabled={isGeneratingPDF || isCheckingTasks || pdfGenerated}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              pdfGenerated
                ? 'bg-green-100 text-green-800 border border-green-300'
                : isGeneratingPDF || isCheckingTasks
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isCheckingTasks ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Vérification des tâches et crédits...</span>
              </>
            ) : isGeneratingPDF ? (
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

      {showTasksBlockingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border-4 border-red-400">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Tâches non accomplies</h2>
            </div>
            <p className="text-gray-700 mb-2">
              Il reste <span className="font-bold text-red-600">{pendingTasksCount}</span> tâche(s) non accomplie(s) pour cette session.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Vous devez marquer chaque tâche comme "Accomplie" en saisissant son reporting (obligatoire) dans la rubrique Gestion des Tâches avant de pouvoir clôturer cette session.
            </p>
            <button
              onClick={() => setShowTasksBlockingModal(false)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}

      {showCreditReportingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-4 border-4 border-red-400 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Wallet className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Crédits non payés aujourd'hui</h2>
            </div>
            <p className="text-gray-700 mb-2">
              <span className="font-bold text-red-600">{unpaidCreditsToday.length}</span> crédit(s) à payer aujourd'hui ne sont pas encore payés en totalité.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Choisissez le motif de reporting de recouvrement pour chacun. La session ne peut pas être clôturée tant que ce reporting n'est pas enregistré.
            </p>

            <div className="space-y-3 mb-4">
              {unpaidCreditsToday.map((credit) => {
                const entry = creditEntries[credit.id] || { motif: '' as const, nouvelleDate: '', telegramValidated: false };
                const diff = entry.nouvelleDate ? diffDaysISO(credit.date_paiement_prevue, entry.nouvelleDate) : null;
                const exceeds7Days = entry.motif === 'report_client' && diff !== null && diff > 7;
                const minDate = addDaysISO(credit.date_paiement_prevue, 1);
                const maxDatePartiel = addDaysISO(credit.date_paiement_prevue, 7);

                return (
                  <div key={credit.id} className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="text-sm">
                        <span className="font-semibold text-gray-900">{credit.numero_contrat}</span>
                        <span className="text-gray-500 ml-2">{credit.assure}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-semibold">{credit.statut}</span>
                        <span className="text-gray-600">Solde: <span className="font-semibold">{parseFloat(String(credit.solde ?? credit.montant_credit ?? 0)).toFixed(2)} DT</span></span>
                      </div>
                    </div>

                    <select
                      value={entry.motif}
                      onChange={(e) => updateCreditEntry(credit.id, { motif: e.target.value as ReportingMotif, nouvelleDate: '', telegramValidated: false })}
                      disabled={isSavingCreditReporting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 mb-2"
                    >
                      <option value="">Sélectionnez un motif de reporting...</option>
                      <option value="report_client">{MOTIF_LABELS.report_client}</option>
                      <option value="injoignable">{MOTIF_LABELS.injoignable}</option>
                      <option value="partiel">{MOTIF_LABELS.partiel}</option>
                    </select>

                    {entry.motif === 'injoignable' && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        Nouvelle date de paiement (automatique, +2 jours) : <span className="font-semibold">{new Date(addDaysISO(credit.date_paiement_prevue, 2) + 'T00:00:00').toLocaleDateString('fr-FR')}</span>
                      </p>
                    )}

                    {entry.motif === 'report_client' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nouvelle date de paiement</label>
                        <input
                          type="date"
                          value={entry.nouvelleDate}
                          min={minDate}
                          onChange={(e) => updateCreditEntry(credit.id, { nouvelleDate: e.target.value, telegramValidated: false })}
                          disabled={isSavingCreditReporting}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                        />
                        {exceeds7Days && !entry.telegramValidated && (
                          <div className="mt-2 flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <p className="text-xs text-amber-800">Cette date dépasse 7 jours : l'accord de Hamza est requis.</p>
                            <button
                              type="button"
                              onClick={() => setPendingTelegramValidation({
                                creditId: credit.id,
                                numeroContrat: credit.numero_contrat,
                                assure: credit.assure,
                                ancienneDate: credit.date_paiement_prevue,
                                nouvelleDate: entry.nouvelleDate,
                              })}
                              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Envoyer à Hamza
                            </button>
                          </div>
                        )}
                        {exceeds7Days && entry.telegramValidated && (
                          <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Validé par Hamza
                          </p>
                        )}
                      </div>
                    )}

                    {entry.motif === 'partiel' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Date de liquidation du solde restant <span className="text-gray-400 font-normal">(max 7 jours)</span>
                        </label>
                        <input
                          type="date"
                          value={entry.nouvelleDate}
                          min={minDate}
                          max={maxDatePartiel}
                          onChange={(e) => updateCreditEntry(credit.id, { nouvelleDate: e.target.value })}
                          disabled={isSavingCreditReporting}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {creditReportingError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">
                {creditReportingError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreditReportingModal(false)}
                disabled={isSavingCreditReporting}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveCreditReporting}
                disabled={isSavingCreditReporting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isSavingCreditReporting ? 'Enregistrement...' : 'Enregistrer et poursuivre'}
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

      {pendingTelegramValidation && (
        <CreditDateValidationModal
          numeroContrat={pendingTelegramValidation.numeroContrat}
          assure={pendingTelegramValidation.assure}
          ancienneDate={pendingTelegramValidation.ancienneDate}
          nouvelleDate={pendingTelegramValidation.nouvelleDate}
          requestedBy={username}
          onClose={() => setPendingTelegramValidation(null)}
          onValidated={() => {
            updateCreditEntry(pendingTelegramValidation.creditId, { telegramValidated: true });
            setPendingTelegramValidation(null);
          }}
        />
      )}
    </div>
  );
};

export default LogoutConfirmation;