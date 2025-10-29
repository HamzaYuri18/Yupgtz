import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, Building2, Download, FileSpreadsheet } from 'lucide-react';
import { getRecentSessions, getSessionsByDateRange, updateSessionVersement } from '../utils/sessionService';
import * as XLSX from 'xlsx';

interface VersementBancaireProps {
  username: string;
}

interface SessionData {
  id: number;
  date_session: string;
  total_espece: number;
  versement: number;
  date_versement: string | null;
  charges: number;
  banque: string | null;
  statut: string;
  cree_par: string;
}

const VersementBancaire: React.FC<VersementBancaireProps> = ({ username }) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    sessionId: '',
    dateSession: '',
    versement: '',
    dateVersement: '',
    charges: '',
    banque: 'ATTIJARI'
  });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const data = await getRecentSessions(10);
    setSessions(data);
    setFilteredSessions(data);
  };

  const handleFilter = async () => {
    if (!dateDebut || !dateFin) {
      setMessage('Veuillez saisir les deux dates');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const data = await getSessionsByDateRange(dateDebut, dateFin);
    setFilteredSessions(data);
  };

  const handleResetFilter = () => {
    setDateDebut('');
    setDateFin('');
    setFilteredSessions(sessions);
  };

  const handleSaveVersement = async () => {
    if (!formData.versement || !formData.dateVersement || !formData.dateSession) {
      setMessage('Veuillez remplir tous les champs obligatoires');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const session = sessions.find(s => s.date_session === formData.dateSession);
    if (!session) {
      setMessage('Session introuvable');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const success = await updateSessionVersement(
      session.id,
      parseFloat(formData.versement),
      formData.dateVersement,
      formData.banque,
      parseFloat(formData.charges) || 0
    );

    if (success) {
      setMessage('Versement enregistré avec succès');
      setFormData({
        sessionId: '',
        dateSession: '',
        versement: '',
        dateVersement: '',
        charges: '',
        banque: 'ATTIJARI'
      });
      loadSessions();
    } else {
      setMessage('Erreur lors de l\'enregistrement');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const calculateSolde = (session: SessionData): number => {
    const netEspece = session.total_espece - session.charges;
    return session.versement - netEspece;
  };

  const exportToExcel = () => {
    const dataToExport = filteredSessions.map(session => ({
      'Date Session': session.date_session,
      'Total Espèce': session.total_espece,
      'Charges': session.charges,
      'Net': session.total_espece - session.charges,
      'Versement': session.versement,
      'Date Versement': session.date_versement || '',
      'Banque': session.banque || '',
      'Solde': calculateSolde(session),
      'Statut': session.statut,
      'Créé par': session.cree_par
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sessions');
    XLSX.writeFile(wb, `sessions_${dateDebut || 'toutes'}_${dateFin || 'dates'}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <Building2 className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Versement Bancaire</h2>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.includes('succès') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de Session
              </label>
              <input
                type="date"
                value={formData.dateSession}
                onChange={(e) => setFormData({ ...formData, dateSession: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Charges
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.charges}
                onChange={(e) => setFormData({ ...formData, charges: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Banque
              </label>
              <select
                value={formData.banque}
                onChange={(e) => setFormData({ ...formData, banque: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ATTIJARI">ATTIJARI</option>
                <option value="BIAT">BIAT</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Versement
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.versement}
                onChange={(e) => setFormData({ ...formData, versement: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de Versement
              </label>
              <input
                type="date"
                value={formData.dateVersement}
                onChange={(e) => setFormData({ ...formData, dateVersement: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSaveVersement}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <DollarSign className="w-5 h-5" />
              <span>Enregistrer le Versement</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">Liste des Sessions</h3>
          <button
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Exporter Excel</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Début</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleFilter}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Filtrer
            </button>
            <button
              onClick={handleResetFilter}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Session</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Espèce</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charges</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Versement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Banque</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSessions.map((session) => {
                const solde = calculateSolde(session);
                return (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.date_session}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.total_espece.toFixed(2)} DT</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.charges.toFixed(2)} DT</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.versement.toFixed(2)} DT</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.date_versement || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{session.banque || '-'}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${solde < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {solde.toFixed(2)} DT
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        session.statut === 'Versé' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {session.statut}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VersementBancaire;
