import React, { useState, useEffect } from 'react';
import { FileText, Plus, Download, Filter, X, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface Attestation {
  id: string;
  numero_attestation: string;
  numero_contrat: string | null;
  assure: string | null;
  date_impression: string | null;
  montant: number | null;
  created_at: string;
}

const AttestationSequences: React.FC = () => {
  const [numeroDebut, setNumeroDebut] = useState('');
  const [numeroFin, setNumeroFin] = useState('');
  const [nombreAttestations, setNombreAttestations] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [filteredAttestations, setFilteredAttestations] = useState<Attestation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    numeroAttestation: '',
    numeroContrat: '',
    assure: '',
    dateDebut: '',
    dateFin: ''
  });

  useEffect(() => {
    loadAttestations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [attestations, filters]);

  useEffect(() => {
    if (numeroDebut && numeroFin) {
      const debut = parseInt(numeroDebut);
      const fin = parseInt(numeroFin);
      if (!isNaN(debut) && !isNaN(fin) && fin >= debut) {
        setNombreAttestations(fin - debut + 1);
      } else {
        setNombreAttestations(0);
      }
    } else {
      setNombreAttestations(0);
    }
  }, [numeroDebut, numeroFin]);

  const loadAttestations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attestations')
        .select('*')
        .order('numero_attestation', { ascending: true });

      if (error) throw error;
      setAttestations(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des attestations:', error);
      alert('Erreur lors du chargement des attestations');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...attestations];

    if (filters.numeroAttestation) {
      filtered = filtered.filter(a =>
        a.numero_attestation.toLowerCase().includes(filters.numeroAttestation.toLowerCase())
      );
    }

    if (filters.numeroContrat) {
      filtered = filtered.filter(a =>
        a.numero_contrat?.toLowerCase().includes(filters.numeroContrat.toLowerCase())
      );
    }

    if (filters.assure) {
      filtered = filtered.filter(a =>
        a.assure?.toLowerCase().includes(filters.assure.toLowerCase())
      );
    }

    if (filters.dateDebut) {
      filtered = filtered.filter(a =>
        a.date_impression && a.date_impression >= filters.dateDebut
      );
    }

    if (filters.dateFin) {
      filtered = filtered.filter(a =>
        a.date_impression && a.date_impression <= filters.dateFin
      );
    }

    setFilteredAttestations(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numeroDebut || !numeroFin) {
      alert('Veuillez saisir le numéro de début et de fin');
      return;
    }

    const debut = parseInt(numeroDebut);
    const fin = parseInt(numeroFin);

    if (isNaN(debut) || isNaN(fin)) {
      alert('Les numéros doivent être des nombres valides');
      return;
    }

    if (fin < debut) {
      alert('Le numéro de fin doit être supérieur ou égal au numéro de début');
      return;
    }

    setIsSubmitting(true);

    try {
      const attestationsToInsert = [];
      for (let i = debut; i <= fin; i++) {
        attestationsToInsert.push({
          numero_attestation: i.toString(),
          numero_contrat: null,
          assure: null,
          date_impression: null,
          montant: null
        });
      }

      const { error } = await supabase
        .from('attestations')
        .insert(attestationsToInsert);

      if (error) {
        if (error.code === '23505') {
          alert('Certains numéros d\'attestation existent déjà. Veuillez vérifier la séquence.');
        } else {
          throw error;
        }
      } else {
        alert(`${nombreAttestations} attestations ont été enregistrées avec succès!`);
        setNumeroDebut('');
        setNumeroFin('');
        setNombreAttestations(0);
        await loadAttestations();
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      alert('Erreur lors de l\'enregistrement des attestations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    if (filteredAttestations.length === 0) {
      alert('Aucune attestation à exporter');
      return;
    }

    const dataToExport = filteredAttestations.map(a => ({
      'N° Attestation': a.numero_attestation,
      'N° Contrat': a.numero_contrat || '',
      'Assuré': a.assure || '',
      'Date Impression': a.date_impression || '',
      'Montant': a.montant || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attestations');

    const colWidths = [
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 }
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `attestations_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const clearFilters = () => {
    setFilters({
      numeroAttestation: '',
      numeroContrat: '',
      assure: '',
      dateDebut: '',
      dateFin: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Séquences Attestation</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de Début
              </label>
              <input
                type="text"
                value={numeroDebut}
                onChange={(e) => setNumeroDebut(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de Fin
              </label>
              <input
                type="text"
                value={numeroFin}
                onChange={(e) => setNumeroFin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 1050"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre d'Attestations
              </label>
              <input
                type="text"
                value={nombreAttestations}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || nombreAttestations === 0}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-5 h-5" />
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer la Séquence'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Liste des Attestations</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filtres
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter Excel
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° Attestation
                </label>
                <input
                  type="text"
                  value={filters.numeroAttestation}
                  onChange={(e) => setFilters({...filters, numeroAttestation: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Rechercher..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° Contrat
                </label>
                <input
                  type="text"
                  value={filters.numeroContrat}
                  onChange={(e) => setFilters({...filters, numeroContrat: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Rechercher..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assuré
                </label>
                <input
                  type="text"
                  value={filters.assure}
                  onChange={(e) => setFilters({...filters, assure: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Rechercher..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Début
                </label>
                <input
                  type="date"
                  value={filters.dateDebut}
                  onChange={(e) => setFilters({...filters, dateDebut: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Fin
                </label>
                <input
                  type="date"
                  value={filters.dateFin}
                  onChange={(e) => setFilters({...filters, dateFin: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Réinitialiser
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Chargement...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Attestation</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Contrat</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assuré</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date Impression</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAttestations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      <Search className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      Aucune attestation trouvée
                    </td>
                  </tr>
                ) : (
                  filteredAttestations.map((attestation) => (
                    <tr key={attestation.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {attestation.numero_attestation}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {attestation.numero_contrat || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {attestation.assure || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {attestation.date_impression
                          ? new Date(attestation.date_impression).toLocaleDateString('fr-FR')
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {attestation.montant
                          ? `${attestation.montant.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT`
                          : '-'
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {filteredAttestations.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Total: {filteredAttestations.length} attestation(s)
          </div>
        )}
      </div>
    </div>
  );
};

export default AttestationSequences;
