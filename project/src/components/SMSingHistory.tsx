import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Calendar, Clock, FileText, Phone, ChevronLeft, ChevronRight, Filter, X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SMSRecord {
  id: string;
  date_envoi: string;
  description: string;
  destinataire: string;
  client: string;
  numero_contrat: string | null;
  utilisateur: string;
  created_at: string;
}

interface SMSingHistoryProps {
  username?: string;
}

const emptyManualEntry = { destinataire: '', client: '', numeroContrat: '', description: '' };

const SMSingHistory: React.FC<SMSingHistoryProps> = ({ username }) => {
  const isHamza = username?.toLowerCase() === 'hamza';

  const [smsHistory, setSmsHistory] = useState<SMSRecord[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<SMSRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Ajout manuel et suppression (Hamza uniquement)
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualEntry, setManualEntry] = useState(emptyManualEntry);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const itemsPerPage = 5;

  useEffect(() => {
    loadSMSHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [smsHistory, dateDebut, dateFin]);

  const loadSMSHistory = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('smsing')
        .select('*')
        .order('date_envoi', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Erreur chargement historique SMS:', error);
        return;
      }

      setSmsHistory(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Ajout manuel d'une entrée (Hamza uniquement) ────────────────────────
  const openAddModal = () => {
    setManualEntry(emptyManualEntry);
    setAddError(null);
    setShowAddModal(true);
  };

  const handleAddManualEntry = async () => {
    if (!manualEntry.destinataire.trim() || !manualEntry.client.trim() || !manualEntry.description.trim()) {
      setAddError('Veuillez renseigner au moins le destinataire, le client et le message.');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const { error } = await supabase.from('smsing').insert({
        date_envoi: new Date().toISOString(),
        description: manualEntry.description.trim(),
        destinataire: manualEntry.destinataire.trim().replace(/\s+/g, ''),
        client: manualEntry.client.trim(),
        numero_contrat: manualEntry.numeroContrat.trim() || null,
        utilisateur: username || 'Hamza',
        statut: 'Envoyé',
      });
      if (error) throw error;
      setShowAddModal(false);
      setManualEntry(emptyManualEntry);
      await loadSMSHistory();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setAddSaving(false);
    }
  };

  // ── Suppression (Hamza uniquement) ──────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('smsing').delete().eq('id', id);
      if (error) throw error;
      setConfirmDeleteId(null);
      await loadSMSHistory();
    } catch (error) {
      console.error('Erreur suppression SMS:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const applyFilters = () => {
    let filtered = [...smsHistory];

    if (dateDebut) {
      const startDate = new Date(dateDebut);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(sms => {
        const smsDate = new Date(sms.date_envoi);
        return smsDate >= startDate;
      });
    }

    if (dateFin) {
      const endDate = new Date(dateFin);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(sms => {
        const smsDate = new Date(sms.date_envoi);
        return smsDate <= endDate;
      });
    }

    setFilteredHistory(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setDateDebut('');
    setDateFin('');
  };

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredHistory.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'historique SMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Historique SMS</h2>
              <p className="text-blue-100 mt-1">
                {filteredHistory.length} SMS envoyé{filteredHistory.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isHamza && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-3 transition-colors text-sm font-medium"
              >
                <Plus className="w-5 h-5" />
                Ajouter un SMS
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 transition-colors"
            >
              <Filter className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Filter className="w-5 h-5 text-blue-600" />
              <span>Filtres</span>
            </h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Début
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Fin
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Aucun SMS trouvé</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {currentItems.map((sms) => {
              const { date, time } = formatDateTime(sms.date_envoi);
              return (
                <div
                  key={sms.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 rounded-full p-3">
                        <MessageSquare className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{sms.client}</h3>
                        {sms.numero_contrat && (
                          <p className="text-sm text-gray-600">Contrat: {sms.numero_contrat}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        {isHamza && (
                          <button
                            onClick={() => setConfirmDeleteId(sms.id)}
                            title="Supprimer ce message"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">{date}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600 mt-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">{time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-start space-x-3">
                      <Phone className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Destinataire</p>
                        <p className="text-sm font-semibold text-gray-900">{sms.destinataire}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <User className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Envoyé par</p>
                        <p className="text-sm font-semibold text-gray-900">{sms.utilisateur}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 bg-gray-50 rounded-lg p-4">
                    <FileText className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-medium mb-1">Message</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{sms.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">
                Page {currentPage} sur {totalPages} ({filteredHistory.length} SMS)
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className={`flex items-center space-x-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Précédent</span>
                </button>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className={`flex items-center space-x-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <span>Suivant</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Ajouter un SMS manuellement (Hamza uniquement) ── */}
      {showAddModal && isHamza && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Ajouter un SMS à l'historique</h3>
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Numéro destinataire *</label>
                <input
                  type="tel"
                  value={manualEntry.destinataire}
                  onChange={e => setManualEntry({ ...manualEntry, destinataire: e.target.value })}
                  placeholder="Ex: 20123456"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Client *</label>
                <input
                  type="text"
                  value={manualEntry.client}
                  onChange={e => setManualEntry({ ...manualEntry, client: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">N° Contrat</label>
                <input
                  type="text"
                  value={manualEntry.numeroContrat}
                  onChange={e => setManualEntry({ ...manualEntry, numeroContrat: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message *</label>
                <textarea
                  value={manualEntry.description}
                  onChange={e => setManualEntry({ ...manualEntry, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              {addError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{addError}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAddManualEntry}
                  disabled={addSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all"
                >
                  {addSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                  Enregistrer
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={addSaving}
                  className="px-5 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation de suppression (Hamza uniquement) ── */}
      {confirmDeleteId && isHamza && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Supprimer ce SMS
            </h3>
            <p className="text-sm text-gray-600">Cette action est irréversible. Confirmer la suppression ?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingId === confirmDeleteId ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SMSingHistory;
