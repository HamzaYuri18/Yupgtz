import React, { useState, useEffect } from 'react';
import { Shield, Save, RefreshCw, CheckCircle, XCircle, User, AlertCircle } from 'lucide-react';
import {
  getUserPermissions,
  saveUserPermissions,
  getAllUsersPermissions,
  DEFAULT_PERMISSIONS,
  TAB_LABELS,
  UserPermissions,
} from '../utils/permissionsService';
import { users } from '../utils/auth';

interface GestionAccesProps {
  currentUser: string;
}

const NON_ADMIN_USERS = users.filter(u => u.username.toLowerCase() !== 'hamza').map(u => u.username);

const GestionAcces: React.FC<GestionAccesProps> = ({ currentUser }) => {
  const [allPermissions, setAllPermissions] = useState<Record<string, UserPermissions>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<Record<string, 'success' | 'error'>>({});

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    const data = await getAllUsersPermissions();
    const merged: Record<string, UserPermissions> = {};
    for (const user of NON_ADMIN_USERS) {
      merged[user] = data[user] ?? { ...DEFAULT_PERMISSIONS };
    }
    setAllPermissions(merged);
    setLoading(false);
  };

  const togglePermission = (username: string, tab: keyof UserPermissions) => {
    setAllPermissions(prev => ({
      ...prev,
      [username]: {
        ...prev[username],
        [tab]: !prev[username][tab],
      },
    }));
  };

  const toggleAllForUser = (username: string, value: boolean) => {
    const updated: UserPermissions = {} as UserPermissions;
    for (const key of Object.keys(DEFAULT_PERMISSIONS) as Array<keyof UserPermissions>) {
      updated[key] = value;
    }
    setAllPermissions(prev => ({ ...prev, [username]: updated }));
  };

  const handleSave = async (username: string) => {
    setSaving(username);
    const success = await saveUserPermissions(username, allPermissions[username], currentUser);
    setSaving(null);
    setSavedStatus(prev => ({ ...prev, [username]: success ? 'success' : 'error' }));
    setTimeout(() => setSavedStatus(prev => { const n = { ...prev }; delete n[username]; return n; }), 3000);
  };

  const tabKeys = Object.keys(DEFAULT_PERMISSIONS) as Array<keyof UserPermissions>;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Chargement des permissions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Gestion des Acces</h2>
            <p className="text-sm text-gray-500">Configurez les rubriques accessibles pour chaque utilisateur</p>
          </div>
        </div>

        <div className="mt-4 flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Les modifications prennent effet a la prochaine connexion de l'utilisateur. Les rubriques exclusives a Hamza ne sont pas incluses ici.
          </p>
        </div>
      </div>

      {NON_ADMIN_USERS.map(username => {
        const perms = allPermissions[username] ?? { ...DEFAULT_PERMISSIONS };
        const activeCount = tabKeys.filter(k => perms[k]).length;
        const allOn = activeCount === tabKeys.length;
        const allOff = activeCount === 0;

        return (
          <div key={username} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{username}</h3>
                    <p className="text-xs text-gray-500">{activeCount} / {tabKeys.length} rubriques actives</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleAllForUser(username, true)}
                    disabled={allOn}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Tout activer
                  </button>
                  <button
                    onClick={() => toggleAllForUser(username, false)}
                    disabled={allOff}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Tout desactiver
                  </button>
                  <button
                    onClick={() => handleSave(username)}
                    disabled={saving === username}
                    className="flex items-center space-x-1.5 text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                  >
                    {saving === username ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{saving === username ? 'Sauvegarde...' : 'Sauvegarder'}</span>
                  </button>

                  {savedStatus[username] === 'success' && (
                    <div className="flex items-center space-x-1 text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Sauvegarde</span>
                    </div>
                  )}
                  {savedStatus[username] === 'error' && (
                    <div className="flex items-center space-x-1 text-red-500">
                      <XCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Erreur</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {tabKeys.map(tab => {
                  const enabled = perms[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => togglePermission(username, tab)}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all duration-200 text-left group ${
                        enabled
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                          : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xs font-medium leading-tight">{TAB_LABELS[tab]}</span>
                      <div className={`ml-2 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        enabled ? 'bg-emerald-500' : 'bg-gray-300 group-hover:bg-gray-400'
                      }`}>
                        {enabled ? (
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GestionAcces;
