import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Clock, Plus, Edit2, Save, X } from 'lucide-react';

interface Tache {
  id: string;
  titre: string;
  description: string;
  date_effectuer: string;
  degre_importance: 'Urgent' | 'Haute' | 'Moyenne' | 'Basse';
  utilisateur_charge: 'Ahlem' | 'Islem';
  statut: 'A faire' | 'Accomplie';
  remarques: string;
  session_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TaskManagementProps {
  currentUser: string;
  sessionId: string | null;
  isSessionClosed: boolean;
}

export default function TaskManagement({ currentUser, sessionId, isSessionClosed }: TaskManagementProps) {
  const [taches, setTaches] = useState<Tache[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRemarks, setEditingRemarks] = useState<string | null>(null);
  const [newTache, setNewTache] = useState({
    titre: '',
    description: '',
    date_effectuer: '',
    degre_importance: 'Moyenne' as 'Urgent' | 'Haute' | 'Moyenne' | 'Basse',
    utilisateur_charge: 'Ahlem' as 'Ahlem' | 'Islem',
  });
  const [remarquesTemp, setRemarquesTemp] = useState<{ [key: string]: string }>({});

  const isHamza = currentUser === 'Hamza';

  useEffect(() => {
    loadTaches();
  }, []);

  const loadTaches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('taches')
        .select('*')
        .order('date_effectuer', { ascending: true });

      if (error) throw error;
      setTaches(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des tâches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTache = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHamza) return;

    try {
      const { error } = await supabase.from('taches').insert([
        {
          ...newTache,
          session_id: sessionId,
          created_by: currentUser,
        },
      ]);

      if (error) throw error;

      setNewTache({
        titre: '',
        description: '',
        date_effectuer: '',
        degre_importance: 'Moyenne',
        utilisateur_charge: 'Ahlem',
      });
      setShowAddForm(false);
      loadTaches();
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la tâche:', error);
      alert('Erreur lors de l\'ajout de la tâche');
    }
  };

  const handleUpdateStatut = async (tacheId: string, newStatut: 'A faire' | 'Accomplie') => {
    if (isHamza || isSessionClosed) return;

    try {
      const { error } = await supabase
        .from('taches')
        .update({ statut: newStatut, updated_at: new Date().toISOString() })
        .eq('id', tacheId);

      if (error) throw error;
      loadTaches();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const handleSaveRemarques = async (tacheId: string) => {
    if (isHamza || isSessionClosed) return;

    try {
      const { error } = await supabase
        .from('taches')
        .update({ remarques: remarquesTemp[tacheId] || '', updated_at: new Date().toISOString() })
        .eq('id', tacheId);

      if (error) throw error;
      setEditingRemarks(null);
      loadTaches();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des remarques:', error);
      alert('Erreur lors de la sauvegarde des remarques');
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'Urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Haute':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Moyenne':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Basse':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const tachesAFaire = taches.filter(t => t.statut === 'A faire').length;
  const tachesAccomplies = taches.filter(t => t.statut === 'Accomplie').length;

  if (loading) {
    return <div className="text-center py-4">Chargement des tâches...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Gestion des Tâches</h3>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-orange-600 font-medium">
              <Clock className="inline w-4 h-4 mr-1" />
              {tachesAFaire} tâches à traiter
            </span>
            <span className="text-green-600 font-medium">
              <CheckCircle className="inline w-4 h-4 mr-1" />
              {tachesAccomplies} accomplies
            </span>
          </div>
        </div>
        {isHamza && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter une tâche
          </button>
        )}
      </div>

      {showAddForm && isHamza && (
        <form onSubmit={handleAddTache} className="bg-white p-4 rounded-lg border-2 border-blue-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
              <input
                type="text"
                value={newTache.titre}
                onChange={(e) => setNewTache({ ...newTache, titre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date à effectuer</label>
              <input
                type="date"
                value={newTache.date_effectuer}
                onChange={(e) => setNewTache({ ...newTache, date_effectuer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={newTache.description}
              onChange={(e) => setNewTache({ ...newTache, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Degré d'importance</label>
              <select
                value={newTache.degre_importance}
                onChange={(e) => setNewTache({ ...newTache, degre_importance: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Basse">Basse</option>
                <option value="Moyenne">Moyenne</option>
                <option value="Haute">Haute</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur chargé</label>
              <select
                value={newTache.utilisateur_charge}
                onChange={(e) => setNewTache({ ...newTache, utilisateur_charge: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Ahlem">Ahlem</option>
                <option value="Islem">Islem</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ajouter
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {taches.map((tache) => (
          <div
            key={tache.id}
            className={`bg-white p-4 rounded-lg border-2 ${
              tache.statut === 'Accomplie' ? 'border-green-200 bg-green-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-gray-800">{tache.titre}</h4>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getImportanceColor(tache.degre_importance)}`}>
                    {tache.degre_importance}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                    {tache.utilisateur_charge}
                  </span>
                  <span className="text-sm text-gray-600">
                    <Clock className="inline w-4 h-4 mr-1" />
                    {new Date(tache.date_effectuer).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {tache.description && (
                  <p className="text-sm text-gray-600 mb-2">{tache.description}</p>
                )}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Remarques:</label>
                  {editingRemarks === tache.id && !isHamza && !isSessionClosed ? (
                    <div className="flex gap-2">
                      <textarea
                        value={remarquesTemp[tache.id] !== undefined ? remarquesTemp[tache.id] : tache.remarques}
                        onChange={(e) => setRemarquesTemp({ ...remarquesTemp, [tache.id]: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        rows={2}
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleSaveRemarques(tache.id)}
                          className="p-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingRemarks(null)}
                          className="p-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {tache.remarques || 'Aucune remarque'}
                      </p>
                      {!isHamza && !isSessionClosed && tache.utilisateur_charge === currentUser && (
                        <button
                          onClick={() => {
                            setEditingRemarks(tache.id);
                            setRemarquesTemp({ ...remarquesTemp, [tache.id]: tache.remarques });
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-4">
                {!isHamza && !isSessionClosed && tache.utilisateur_charge === currentUser && (
                  <button
                    onClick={() => handleUpdateStatut(tache.id, tache.statut === 'A faire' ? 'Accomplie' : 'A faire')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      tache.statut === 'Accomplie'
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {tache.statut === 'Accomplie' ? (
                      <>
                        <CheckCircle className="inline w-4 h-4 mr-1" />
                        Accomplie
                      </>
                    ) : (
                      <>
                        <AlertCircle className="inline w-4 h-4 mr-1" />
                        Marquer accomplie
                      </>
                    )}
                  </button>
                )}
                {(isHamza || isSessionClosed || tache.utilisateur_charge !== currentUser) && (
                  <span
                    className={`px-4 py-2 rounded-lg font-medium ${
                      tache.statut === 'Accomplie'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {tache.statut}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {taches.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucune tâche pour le moment
          </div>
        )}
      </div>
    </div>
  );
}
