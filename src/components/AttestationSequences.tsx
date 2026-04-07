import React, { useState, useEffect } from 'react';
import { FileText, Plus, Download, Filter, X, Search, TrendingUp, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { getSession } from '../utils/auth';

interface Attestation {
  id: string;
  numero_attestation: string;
  numero_contrat: string | null;
  assure: string | null;
  date_impression: string | null;
  montant: number | null;
  created_at: string;
}

interface Carnet {
  id: string;
  nom_carnet: string;
  numero_debut: number;
  numero_fin: number;
  nombre_total: number;
  table_name: string;
  created_at: string;
}

interface Statistics {
  imprimees: number;
  ratees: number;
  totalSession: number;
}

interface CarnetStatistics {
  total_carnets: number;
  carnets_accomplis: number;
  carnets_en_cours: number;
  total_attestations: number;
  attestations_en_stock: number;
  attestations_servies: number;
  attestations_annulees: number;
}

interface CarnetRemaining {
  [carnetName: string]: number;
}

const AttestationSequences: React.FC = () => {
  const [numeroDebut, setNumeroDebut] = useState('');
  const [numeroFin, setNumeroFin] = useState('');
  const [nombreAttestations, setNombreAttestations] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [carnets, setCarnets] = useState<Carnet[]>([]);
  const [selectedCarnet, setSelectedCarnet] = useState<string>('');
  const [statistics, setStatistics] = useState<Statistics>({
    imprimees: 0,
    ratees: 0,
    totalSession: 0
  });
  const [carnetStats, setCarnetStats] = useState<CarnetStatistics>({
    total_carnets: 0,
    carnets_accomplis: 0,
    carnets_en_cours: 0,
    total_attestations: 0,
    attestations_en_stock: 0,
    attestations_servies: 0,
    attestations_annulees: 0
  });
  const [carnetRemaining, setCarnetRemaining] = useState<CarnetRemaining>({});
  const [currentUser, setCurrentUser] = useState<string>('');

  const itemsPerPage = 5;

  useEffect(() => {
    const session = getSession();
    if (session) {
      setCurrentUser(session.username);
    }
  }, []);

  useEffect(() => {
    loadCarnets();
    loadStatistics();
    loadCarnetStatistics();
    loadCarnetRemaining();
  }, []);

  useEffect(() => {
    if (selectedCarnet) {
      loadAttestationsFromCarnet(selectedCarnet);
    }
  }, [selectedCarnet]);

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

  const loadCarnets = async () => {
    try {
      const { data, error } = await supabase
        .from('carnets_attestations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCarnets(data || []);
      if (data && data.length > 0) {
        setSelectedCarnet(data[0].table_name);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des carnets:', error);
    }
  };

  const loadAttestationsFromCarnet = async (tableName: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .not('date_impression', 'is', null)
        .order('date_impression', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAttestations(data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error('Erreur lors du chargement des attestations:', error);
      setAttestations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: carnetsData } = await supabase
        .from('carnets_attestations')
        .select('table_name');

      if (!carnetsData || carnetsData.length === 0) {
        setStatistics({ imprimees: 0, ratees: 0, totalSession: 0 });
        return;
      }

      let totalImprimees = 0;
      let totalRatees = 0;

      for (const carnet of carnetsData) {
        const { data: allData } = await supabase
          .from(carnet.table_name)
          .select('numero_attestation, date_impression, statut')
          .order('numero_attestation', { ascending: true });

        if (!allData) continue;

        const { data: todayData } = await supabase
          .from(carnet.table_name)
          .select('numero_attestation')
          .gte('date_impression', today)
          .lt('date_impression', new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        totalImprimees += todayData?.length || 0;

        const printedData = allData.filter(a => a.date_impression !== null);
        if (printedData.length > 0) {
          printedData.sort((a, b) =>
            parseInt(a.numero_attestation) - parseInt(b.numero_attestation)
          );

          for (let i = 1; i < printedData.length; i++) {
            const current = parseInt(printedData[i].numero_attestation);
            const previous = parseInt(printedData[i - 1].numero_attestation);
            const gap = current - previous - 1;

            if (gap > 0) {
              for (let missingNum = previous + 1; missingNum < current; missingNum++) {
                const missingAttestation = allData.find(
                  a => parseInt(a.numero_attestation) === missingNum
                );

                if (missingAttestation?.statut === null) {
                  totalRatees += 1;
                }
              }
            }
          }
        }
      }

      setStatistics({
        imprimees: totalImprimees,
        ratees: totalRatees,
        totalSession: totalImprimees
      });
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
    }
  };

  const loadCarnetStatistics = async () => {
    try {
      const { data, error } = await supabase.rpc('get_carnet_statistics');

      if (error) {
        console.error('Erreur lors du chargement des statistiques de carnets:', error);
        return;
      }

      if (data && data.length > 0) {
        setCarnetStats({
          total_carnets: data[0].total_carnets || 0,
          carnets_accomplis: data[0].carnets_accomplis || 0,
          carnets_en_cours: data[0].carnets_en_cours || 0,
          total_attestations: data[0].total_attestations || 0,
          attestations_en_stock: data[0].attestations_en_stock || 0,
          attestations_servies: data[0].attestations_servies || 0,
          attestations_annulees: data[0].attestations_annulees || 0
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques de carnets:', error);
    }
  };

  const loadCarnetRemaining = async () => {
    try {
      const { data: carnetsData, error: carnetsError } = await supabase
        .from('carnets_attestations')
        .select('table_name, nombre_total');

      if (carnetsError) throw carnetsError;
      if (!carnetsData) return;

      const remaining: CarnetRemaining = {};

      for (const carnet of carnetsData) {
        const { count, error: countError } = await supabase
          .from(carnet.table_name)
          .select('*', { count: 'exact', head: true })
          .is('statut', null);

        if (!countError) {
          remaining[carnet.table_name] = count || 0;
        }
      }

      setCarnetRemaining(remaining);
    } catch (error) {
      console.error('Erreur lors du chargement des attestations restantes:', error);
    }
  };

  const checkSequenceOverlap = async (debut: number, fin: number): Promise<{ exists: boolean; carnetName: string | null }> => {
    try {
      const { data, error } = await supabase
        .rpc('check_sequence_overlap', {
          p_numero_debut: debut,
          p_numero_fin: fin
        });

      if (error) throw error;

      if (data && data.length > 0 && data[0].overlap_exists) {
        return { exists: true, carnetName: data[0].carnet_name };
      }
      return { exists: false, carnetName: null };
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      return { exists: false, carnetName: null };
    }
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
      const overlap = await checkSequenceOverlap(debut, fin);
      if (overlap.exists) {
        alert(`Cette séquence est déjà enregistrée dans le carnet: ${overlap.carnetName}`);
        setIsSubmitting(false);
        return;
      }

      const nomCarnet = `carnet_${debut}`;
      const tableName = `attestations_${debut}`;

      const { data: createResult, error: createError } = await supabase
        .rpc('create_carnet_table', {
          p_table_name: tableName,
          p_numero_debut: debut,
          p_numero_fin: fin
        });

      if (createError) throw createError;

      if (!createResult) {
        throw new Error('Échec de la création de la table');
      }

      const { error: carnetError } = await supabase
        .from('carnets_attestations')
        .insert({
          nom_carnet: nomCarnet,
          numero_debut: debut,
          numero_fin: fin,
          nombre_total: fin - debut + 1,
          table_name: tableName
        });

      if (carnetError) throw carnetError;

      alert(`Carnet "${nomCarnet}" créé avec succès!\n${nombreAttestations} attestations enregistrées.`);
      setNumeroDebut('');
      setNumeroFin('');
      setNombreAttestations(0);
      await loadCarnets();
      await loadStatistics();
      await loadCarnetRemaining();
    } catch (error: any) {
      console.error('Erreur lors de l\'enregistrement:', error);
      if (error.code === '23505') {
        alert('Ce carnet existe déjà.');
      } else {
        alert('Erreur lors de l\'enregistrement du carnet');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAttestation = async (attestationId: string, numeroAttestation: string) => {
    if (currentUser !== 'Hamza') {
      alert('Seul Hamza peut vider les données d\'une attestation');
      return;
    }

    const confirmReset = window.confirm(
      `Voulez-vous vraiment vider les données de l'attestation n° ${numeroAttestation} ?\n\n` +
      `Cette action va réinitialiser :\n` +
      `- Le numéro de contrat\n` +
      `- L'assuré\n` +
      `- La date d'impression\n` +
      `- Le montant\n\n` +
      `Le numéro d'attestation sera conservé.`
    );

    if (!confirmReset) return;

    try {
      const { error } = await supabase
        .from(selectedCarnet)
        .update({
          numero_contrat: null,
          assure: null,
          date_impression: null,
          montant: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', attestationId);

      if (error) throw error;

      alert(`Attestation n° ${numeroAttestation} vidée avec succès`);
      await loadAttestationsFromCarnet(selectedCarnet);
      await loadStatistics();
      await loadCarnetStatistics();
      await loadCarnetRemaining();
    } catch (error) {
      console.error('Erreur lors de la réinitialisation de l\'attestation:', error);
      alert('Erreur lors de la réinitialisation de l\'attestation');
    }
  };

  const handleExportImprimees = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: carnetsData } = await supabase.from('carnets_attestations').select('table_name');

      if (!carnetsData) return;

      let allImprimees: any[] = [];
      for (const carnet of carnetsData) {
        const { data } = await supabase
          .from(carnet.table_name)
          .select('*')
          .gte('date_impression', today)
          .lt('date_impression', new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        if (data) allImprimees = allImprimees.concat(data);
      }

      const dataToExport = allImprimees.map(a => ({
        'N° Attestation': a.numero_attestation,
        'N° Contrat': a.numero_contrat || '',
        'Assuré': a.assure || '',
        'Date Impression': a.date_impression ? new Date(a.date_impression).toLocaleString('fr-FR') : '',
        'Montant': a.montant || ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Imprimées Aujourd\'hui');
      XLSX.writeFile(wb, `attestations_imprimees_${today}.xlsx`);
    } catch (error) {
      console.error('Erreur export:', error);
    }
  };

  const handleExportRatees = async () => {
    try {
      const { data: carnetsData } = await supabase.from('carnets_attestations').select('table_name');
      if (!carnetsData) return;

      let allRatees: any[] = [];
      for (const carnet of carnetsData) {
        const { data: allData } = await supabase
          .from(carnet.table_name)
          .select('numero_attestation, date_impression, statut')
          .order('numero_attestation', { ascending: true });

        if (!allData) continue;

        const printedData = allData.filter(a => a.date_impression !== null);
        if (printedData.length > 0) {
          printedData.sort((a, b) =>
            parseInt(a.numero_attestation) - parseInt(b.numero_attestation)
          );

          for (let i = 1; i < printedData.length; i++) {
            const current = parseInt(printedData[i].numero_attestation);
            const previous = parseInt(printedData[i - 1].numero_attestation);

            for (let missingNum = previous + 1; missingNum < current; missingNum++) {
              const missingAttestation = allData.find(
                a => parseInt(a.numero_attestation) === missingNum
              );

              if (missingAttestation?.statut === null) {
                allRatees.push({
                  numero_attestation: missingNum.toString(),
                  carnet: carnet.table_name,
                  statut: 'Ratée'
                });
              }
            }
          }
        }
      }

      const dataToExport = allRatees.map(a => ({
        'N° Attestation': a.numero_attestation,
        'Carnet': a.carnet,
        'Statut': a.statut
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attestations Ratées');
      XLSX.writeFile(wb, `attestations_ratees_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Erreur export:', error);
    }
  };

  const handleExportCarnets = () => {
    if (carnets.length === 0) {
      alert('Aucun carnet à exporter');
      return;
    }

    const dataToExport = carnets.map(c => ({
      'Nom Carnet': c.nom_carnet,
      'Numéro Début': c.numero_debut,
      'Numéro Fin': c.numero_fin,
      'Nombre Total': c.nombre_total,
      'Date Création': new Date(c.created_at).toLocaleString('fr-FR')
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Carnets');
    XLSX.writeFile(wb, `carnets_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCarnetStats = () => {
    const dataToExport = [{
      'Total Carnets': carnetStats.total_carnets,
      'Carnets Accomplis': carnetStats.carnets_accomplis,
      'Carnets En Cours': carnetStats.carnets_en_cours,
      'Total Attestations': carnetStats.total_attestations,
      'Attestations En Stock': carnetStats.attestations_en_stock,
      'Attestations Servies': carnetStats.attestations_servies,
      'Attestations Annulées': carnetStats.attestations_annulees
    }];

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statistiques Carnets');
    XLSX.writeFile(wb, `statistiques_carnets_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExport = () => {
    if (attestations.length === 0) {
      alert('Aucune attestation à exporter');
      return;
    }

    const dataToExport = attestations.map(a => ({
      'N° Attestation': a.numero_attestation,
      'N° Contrat': a.numero_contrat || '',
      'Assuré': a.assure || '',
      'Date Impression': a.date_impression
        ? new Date(a.date_impression).toLocaleString('fr-FR')
        : '',
      'Montant': a.montant || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attestations');

    const colWidths = [
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 20 },
      { wch: 12 }
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `attestations_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const paginatedAttestations = attestations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(attestations.length / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-shadow"
          onClick={handleExportImprimees}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Attestations Imprimées</p>
              <p className="text-3xl font-bold mt-2">{statistics.imprimees}</p>
              <p className="text-blue-100 text-xs mt-1">Aujourd'hui - Cliquer pour télécharger</p>
            </div>
            <Download className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-shadow"
          onClick={handleExportRatees}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Attestations Ratées</p>
              <p className="text-3xl font-bold mt-2">{statistics.ratees}</p>
              <p className="text-red-100 text-xs mt-1">Non séquentielles - Cliquer pour télécharger</p>
            </div>
            <Download className="w-12 h-12 text-red-200" />
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-shadow"
          onClick={handleExportCarnets}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Carnets</p>
              <p className="text-3xl font-bold mt-2">{carnets.length}</p>
              <p className="text-green-100 text-xs mt-1">Enregistrés - Cliquer pour télécharger</p>
            </div>
            <Download className="w-12 h-12 text-green-200" />
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-shadow"
          onClick={handleExportCarnetStats}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Carnets Accomplis</p>
              <p className="text-3xl font-bold mt-2">{carnetStats.carnets_accomplis}</p>
              <p className="text-orange-100 text-xs mt-1">sur {carnetStats.total_carnets} carnets - Cliquer pour télécharger</p>
            </div>
            <Download className="w-12 h-12 text-orange-200" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Nouveau Carnet d'Attestations</h2>
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
              {isSubmitting ? 'Enregistrement...' : 'Créer le Carnet'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              Dernières Attestations Imprimées (20)
            </h3>
            {selectedCarnet && carnetRemaining[selectedCarnet] !== undefined && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-semibold text-blue-600">{carnetRemaining[selectedCarnet]}</span> attestation(s) restante(s) pour ce carnet
              </p>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={selectedCarnet}
              onChange={(e) => setSelectedCarnet(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {carnets.map((carnet) => (
                <option key={carnet.id} value={carnet.table_name}>
                  {carnet.nom_carnet} ({carnet.numero_debut} - {carnet.numero_fin})
                </option>
              ))}
            </select>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Chargement...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Attestation</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Contrat</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assuré</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date Impression</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Montant</th>
                    {currentUser === 'Hamza' && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedAttestations.length === 0 ? (
                    <tr>
                      <td colSpan={currentUser === 'Hamza' ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        Aucune attestation imprimée
                      </td>
                    </tr>
                  ) : (
                    paginatedAttestations.map((attestation) => (
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
                            ? new Date(attestation.date_impression).toLocaleString('fr-FR')
                            : '-'
                          }
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {attestation.montant
                            ? `${attestation.montant.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT`
                            : '-'
                          }
                        </td>
                        {currentUser === 'Hamza' && (
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleResetAttestation(attestation.id, attestation.numero_attestation)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                              title="Vider les données de cette attestation"
                            >
                              <Trash2 className="w-4 h-4" />
                              Vider
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {attestations.length > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Affichage {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, attestations.length)} sur {attestations.length}
                </div>
                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <span className="px-4 py-2 text-gray-700">
                      Page {currentPage} sur {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AttestationSequences;
