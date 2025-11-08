import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Calendar, FileText, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EncaissementProps {
  username: string;
}

interface TermeData {
  id: string;
  numero_contrat: string;
  echeance: string;
  prime: number;
  assure: string;
  statut: string;
  date_paiement: string | null;
  Retour: string | null;
  Date_Encaissement: string | null;
}

interface SessionStats {
  total_encaissements: number;
  total_paiements: number;
  difference: number;
  session_montant: number;
  cumul_sessions: number;
}

const Encaissement: React.FC<EncaissementProps> = ({ username }) => {
  const [numeroContrat, setNumeroContrat] = useState('');
  const [echeance, setEcheance] = useState('');
  const [termeData, setTermeData] = useState<TermeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('success');
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    total_encaissements: 0,
    total_paiements: 0,
    difference: 0,
    session_montant: 0,
    cumul_sessions: 0
  });

  useEffect(() => {
    loadSessionStats();
  }, []);

  const searchTerme = async () => {
    if (!numeroContrat || !echeance) {
      setMessage('Veuillez saisir le numéro de contrat et l\'échéance');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setTermeData(null);

    try {
      const { data, error } = await supabase
        .from('terme')
        .select('*')
        .eq('numero_contrat', numeroContrat)
        .eq('echeance', echeance)
        .maybeSingle();

      if (error || !data) {
        setMessage('Ce terme n\'est pas payé Impossible de l\'encaisser !!!');
        setMessageType('error');
        return;
      }

      setTermeData(data);
      setMessage('');
    } catch (error) {
      setMessage('Erreur lors de la recherche');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const enregistrerEncaissement = async () => {
    if (!termeData) {
      setMessage('Aucune donnée terme à enregistrer');
      setMessageType('error');
      return;
    }

    // Vérifier si déjà encaissé
    if (termeData.Date_Encaissement) {
      setMessage(`Ce terme est deja encaissé en ${formatDate(termeData.Date_Encaissement)}`);
      setMessageType('warning');
      return;
    }

    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      // Mettre à jour le statut dans la table terme
      const { error } = await supabase
        .from('terme')
        .update({
          statut: 'Encaissé',
          Date_Encaissement: today
        })
        .eq('numero_contrat', termeData.numero_contrat)
        .eq('echeance', termeData.echeance);

      if (error) {
        setMessage('Erreur lors de l\'enregistrement de l\'encaissement');
        setMessageType('error');
        return;
      }

      setMessage('Encaissement enregistré avec succès!');
      setMessageType('success');
      setTermeData(null);
      setNumeroContrat('');
      setEcheance('');

      // Recharger les statistiques
      loadSessionStats();
    } catch (error) {
      setMessage('Erreur lors de l\'enregistrement');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const loadSessionStats = async () => {
    try {
      // Récupérer la date de début de session (aujourd'hui)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 1. Total des encaissements de la session
      const { data: encaissements, error: encError } = await supabase
        .from('Encaissement')
        .select('montant_encaissement, created_at')
        .gte('created_at', today.toISOString());

      // 2. Total des paiements de type terme
      const { data: paiements, error: payError } = await supabase
        .from('paiements')
        .select('montant, created_at, type_paiement')
        .gte('created_at', today.toISOString())
        .or('type_paiement.eq.terme,type_paiement.eq.paiement credit terme');

      if (encError || payError) {
        console.error('Erreur chargement stats:', encError, payError);
        return;
      }

      const totalEncaissements = encaissements?.reduce((sum, item) => sum + (item.montant_encaissement || 0), 0) || 0;
      const totalPaiements = paiements?.reduce((sum, item) => sum + (item.montant || 0), 0) || 0;
      const difference = totalEncaissements - totalPaiements;

      setSessionStats({
        total_encaissements: totalEncaissements,
        total_paiements: totalPaiements,
        difference: difference,
        session_montant: difference,
        cumul_sessions: 0 // À adapter selon votre logique métier
      });

    } catch (error) {
      console.error('Erreur calcul stats:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <DollarSign className="w-6 h-6 mr-2 text-green-600" />
          Encaissement - {username}
        </h2>
        <p className="text-gray-600">Saisie des encaissements par numéro de contrat et échéance</p>
      </div>

      {/* Formulaire de recherche */}
      <div className="bg-blue-50 p-6 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Numéro de contrat
            </label>
            <input
              type="text"
              value={numeroContrat}
              onChange={(e) => setNumeroContrat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Saisir le numéro de contrat"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Échéance
            </label>
            <input
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={searchTerme}
          disabled={loading || !numeroContrat || !echeance}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Search className="w-4 h-4 mr-2" />
          {loading ? 'Recherche...' : 'Rechercher'}
        </button>
      </div>

      {/* Résultat de la recherche */}
      {termeData && (
        <div className={`p-6 rounded-lg mb-6 border-2 ${
          termeData.Date_Encaissement
            ? 'bg-blue-50 border-blue-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            Données trouvées
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Assuré</label>
              <p className="text-lg font-semibold text-gray-800 flex items-center">
                <User className="w-4 h-4 mr-2 text-blue-600" />
                {termeData.assure}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Prime</label>
              <p className="text-lg font-bold text-green-700">{Number(termeData.prime).toLocaleString()} TND</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Statut</label>
              <p className={`text-lg font-semibold ${
                termeData.statut === 'Encaissé' ? 'text-green-600' : 'text-orange-600'
              }`}>
                {termeData.statut}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Date de paiement</label>
              <p className="text-lg font-semibold text-gray-800">
                {termeData.date_paiement ? formatDate(termeData.date_paiement) : 'N/A'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Retour</label>
              <p className="text-lg font-semibold text-gray-800">
                {termeData.Retour || 'Aucun'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-600 mb-1">Date d'encaissement</label>
              <p className="text-lg font-semibold text-gray-800">
                {termeData.Date_Encaissement ? formatDate(termeData.Date_Encaissement) : 'Non encaissé'}
              </p>
            </div>
          </div>
          <button
            onClick={enregistrerEncaissement}
            disabled={loading || !!termeData.Date_Encaissement}
            className="mt-6 flex items-center justify-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            {loading ? 'Enregistrement...' : 'Enregistrer l\'encaissement'}
          </button>
        </div>
      )}

      {/* Statistiques de session */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistiques de la Session</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white rounded-lg shadow">
            <p className="text-sm text-gray-600">Encaissements</p>
            <p className="text-xl font-bold text-blue-600">
              {sessionStats.total_encaissements.toLocaleString()} TND
            </p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow">
            <p className="text-sm text-gray-600">Paiements</p>
            <p className="text-xl font-bold text-orange-600">
              {sessionStats.total_paiements.toLocaleString()} TND
            </p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow">
            <p className="text-sm text-gray-600">Différence</p>
            <p className="text-xl font-bold">
              {sessionStats.difference.toLocaleString()} TND
            </p>
          </div>
          <div className={`text-center p-4 rounded-lg shadow ${
            sessionStats.session_montant >= 0 ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <p className="text-sm text-gray-600">Session</p>
            <p className={`text-xl font-bold ${
              sessionStats.session_montant >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {sessionStats.session_montant >= 0 ? 'Report ' : 'Rapport '}
              {Math.abs(sessionStats.session_montant).toLocaleString()} TND
            </p>
          </div>
        </div>
      </div>

      {/* Message de statut */}
      {message && (
        <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
          messageType === 'success'
            ? 'bg-green-100 text-green-800 border border-green-300'
            : messageType === 'warning'
            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {messageType === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {messageType === 'warning' && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {messageType === 'error' && <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};

export default Encaissement;