import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Calendar, Clock, FileText, Phone, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
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

const SMSingHistory: React.FC = () => {
  const [smsHistory, setSmsHistory] = useState<SMSRecord[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<SMSRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 transition-colors"
          >
            <Filter className="w-6 h-6" />
          </button>
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
    </div>
  );
};

export default SMSingHistory;
