import React, { useState, useEffect } from 'react';
import { FileText, Plus, Download, X, Search, BarChart2, AlertCircle, Ban, ZoomIn } from 'lucide-react';
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
  statut: string | null;
  motif_annulation: string | null;
  user_annule: string | null;
  scan_barree_url: string | null;
  annule_par: string | null;
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
}

interface CarnetRemaining {
  [carnetTableName: string]: number;
}

interface CarnetDetailStats {
  imprimees: number;
  autres: number;
  autresDetails: Attestation[];
}

interface RemainingModalState {
  open: boolean;
  carnetName: string;
  attestations: Attestation[];
  loading: boolean;
}

interface BarreesModalState {
  open: boolean;
  attestations: Attestation[];
  loading: boolean;
  selectedImage: string | null;
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
  const [statistics, setStatistics] = useState<Statistics>({ imprimees: 0, ratees: 0 });
  const [carnetRemaining, setCarnetRemaining] = useState<CarnetRemaining>({});
  const [carnetDetailStats, setCarnetDetailStats] = useState<CarnetDetailStats>({
    imprimees: 0,
    autres: 0,
    autresDetails: []
  });
  const [isLoadingCarnetStats, setIsLoadingCarnetStats] = useState(false);
  const [showCarnetStats, setShowCarnetStats] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [remainingModal, setRemainingModal] = useState<RemainingModalState>({
    open: false,
    carnetName: '',
    attestations: [],
    loading: false
  });
  const [barreesModal, setBarreesModal] = useState<BarreesModalState>({
    open: false,
    attestations: [],
    loading: false,
    selectedImage: null
  });

  const itemsPerPage = 10;

  useEffect(() => {
    const session = getSession();
    if (session) setCurrentUser(session.username);
  }, []);

  useEffect(() => {
    loadCarnets();
    loadStatistics();
    loadCarnetRemaining();
  }, []);

  useEffect(() => {
    if (selectedCarnet) {
      loadAttestationsFromCarnet(selectedCarnet);
      loadCarnetDetailStats(selectedCarnet);
    }
  }, [selectedCarnet]);

  useEffect(() => {
    if (numeroDebut && numeroFin) {
      const debut = parseInt(numeroDebut);
      const fin = parseInt(numeroFin);
      setNombreAttestations(!isNaN(debut) && !isNaN(fin) && fin >= debut ? fin - debut + 1 : 0);
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
      if (data && data.length > 0) setSelectedCarnet(data[0].table_name);
    } catch (error) {
      console.error('Erreur chargement carnets:', error);
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
        .limit(200);

      if (error) throw error;
      setAttestations(data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error('Erreur chargement attestations:', error);
      setAttestations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCarnetDetailStats = async (tableName: string) => {
    setIsLoadingCarnetStats(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('id, numero_attestation, statut, motif_annulation, user_annule, assure, numero_contrat, date_impression, montant')
        .not('statut', 'is', null);

      if (error) throw error;

      const imprimees = data?.filter(a => a.statut === 'imprimee' || a.statut === 'servie').length || 0;
      const autresDetails = (data?.filter(a => a.statut !== 'imprimee' && a.statut !== 'servie') || []) as Attestation[];

      setCarnetDetailStats({ imprimees, autres: autresDetails.length, autresDetails });
    } catch (error) {
      console.error('Erreur stats carnet:', error);
    } finally {
      setIsLoadingCarnetStats(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: carnetsData } = await supabase.from('carnets_attestations').select('table_name');
      if (!carnetsData || carnetsData.length === 0) return;

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
          .lt('date_impression', new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0]);

        totalImprimees += todayData?.length || 0;

        const printedData = allData.filter(a => a.date_impression !== null);
        if (printedData.length > 1) {
          printedData.sort((a, b) => parseInt(a.numero_attestation) - parseInt(b.numero_attestation));
          for (let i = 1; i < printedData.length; i++) {
            const current = parseInt(printedData[i].numero_attestation);
            const previous = parseInt(printedData[i - 1].numero_attestation);
            for (let missing = previous + 1; missing < current; missing++) {
              const found = allData.find(a => parseInt(a.numero_attestation) === missing);
              if (found?.statut === null) totalRatees += 1;
            }
          }
        }
      }

      setStatistics({ imprimees: totalImprimees, ratees: totalRatees });
    } catch (error) {
      console.error('Erreur calcul statistiques:', error);
    }
  };

  const loadCarnetRemaining = async () => {
    try {
      const { data: carnetsData, error } = await supabase
        .from('carnets_attestations')
        .select('table_name, nombre_total');

      if (error || !carnetsData) return;

      const remaining: CarnetRemaining = {};
      for (const carnet of carnetsData) {
        const { count } = await supabase
          .from(carnet.table_name)
          .select('*', { count: 'exact', head: true })
          .is('statut', null);
        remaining[carnet.table_name] = count || 0;
      }
      setCarnetRemaining(remaining);
    } catch (error) {
      console.error('Erreur chargement restants:', error);
    }
  };

  // Carnets accomplis = carnets où toutes les attestations ont un statut non-null
  const carnetsAccomplis = Object.keys(carnetRemaining).length > 0
    ? carnets.filter(c => carnetRemaining[c.table_name] === 0).length
    : 0;

  const checkSequenceOverlap = async (debut: number, fin: number) => {
    try {
      const { data, error } = await supabase.rpc('check_sequence_overlap', {
        p_numero_debut: debut,
        p_numero_fin: fin
      });
      if (error) throw error;
      if (data && data.length > 0 && data[0].overlap_exists) {
        return { exists: true, carnetName: data[0].carnet_name };
      }
      return { exists: false, carnetName: null };
    } catch {
      return { exists: false, carnetName: null };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const debut = parseInt(numeroDebut);
    const fin = parseInt(numeroFin);

    if (isNaN(debut) || isNaN(fin) || fin < debut) {
      alert('Numéros invalides');
      return;
    }

    setIsSubmitting(true);
    try {
      const overlap = await checkSequenceOverlap(debut, fin);
      if (overlap.exists) {
        alert(`Séquence déjà enregistrée dans: ${overlap.carnetName}`);
        setIsSubmitting(false);
        return;
      }

      const nomCarnet = `carnet_${debut}`;
      const tableName = `attestations_${debut}`;

      const { data: createResult, error: createError } = await supabase.rpc('create_carnet_table', {
        p_table_name: tableName,
        p_numero_debut: debut,
        p_numero_fin: fin
      });

      if (createError) throw createError;
      if (!createResult) throw new Error('Échec création table');

      const { error: carnetError } = await supabase.from('carnets_attestations').insert({
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
      console.error('Erreur création carnet:', error);
      alert(error.code === '23505' ? 'Ce carnet existe déjà.' : 'Erreur lors de la création du carnet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAttestation = async (attestationId: string, numeroAttestation: string) => {
    if (currentUser !== 'Hamza') {
      alert('Seul Hamza peut vider les données d\'une attestation');
      return;
    }
    if (!window.confirm(`Vider les données de l'attestation n° ${numeroAttestation} ?`)) return;

    try {
      const { error } = await supabase
        .from(selectedCarnet)
        .update({
          numero_contrat: null, assure: null, date_impression: null,
          montant: null, updated_at: new Date().toISOString()
        })
        .eq('id', attestationId);

      if (error) throw error;
      alert(`Attestation n° ${numeroAttestation} vidée avec succès`);
      await loadAttestationsFromCarnet(selectedCarnet);
      await loadStatistics();
      await loadCarnetRemaining();
      await loadCarnetDetailStats(selectedCarnet);
    } catch (error) {
      alert('Erreur lors de la réinitialisation');
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
          .lt('date_impression', new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0]);
        if (data) allImprimees = allImprimees.concat(data);
      }

      const ws = XLSX.utils.json_to_sheet(allImprimees.map(a => ({
        'N° Attestation': a.numero_attestation,
        'N° Contrat': a.numero_contrat || '',
        'Assuré': a.assure || '',
        'Date Impression': a.date_impression ? new Date(a.date_impression).toLocaleString('fr-FR') : '',
        'Montant': a.montant || ''
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Imprimées Aujourd'hui");
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
        if (printedData.length > 1) {
          printedData.sort((a, b) => parseInt(a.numero_attestation) - parseInt(b.numero_attestation));
          for (let i = 1; i < printedData.length; i++) {
            const current = parseInt(printedData[i].numero_attestation);
            const previous = parseInt(printedData[i - 1].numero_attestation);
            for (let missing = previous + 1; missing < current; missing++) {
              const found = allData.find(a => parseInt(a.numero_attestation) === missing);
              if (found?.statut === null) {
                allRatees.push({ numero_attestation: missing.toString(), carnet: carnet.table_name, statut: 'Ratée' });
              }
            }
          }
        }
      }

      const ws = XLSX.utils.json_to_sheet(allRatees.map(a => ({
        'N° Attestation': a.numero_attestation, 'Carnet': a.carnet, 'Statut': a.statut
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attestations Ratées');
      XLSX.writeFile(wb, `attestations_ratees_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Erreur export:', error);
    }
  };

  const handleExportCarnets = () => {
    if (carnets.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(carnets.map(c => ({
      'Nom Carnet': c.nom_carnet,
      'Numéro Début': c.numero_debut,
      'Numéro Fin': c.numero_fin,
      'Nombre Total': c.nombre_total,
      'Date Création': new Date(c.created_at).toLocaleString('fr-FR')
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Carnets');
    XLSX.writeFile(wb, `carnets_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCarnetDetails = async () => {
    if (!selectedCarnet) return;
    try {
      const { data, error } = await supabase
        .from(selectedCarnet)
        .select('*')
        .order('numero_attestation', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) { alert('Aucune donnée à exporter'); return; }

      const carnetInfo = carnets.find(c => c.table_name === selectedCarnet);
      const ws = XLSX.utils.json_to_sheet(data.map(a => ({
        'N° Attestation': a.numero_attestation,
        'N° Contrat': a.numero_contrat || '',
        'Assuré': a.assure || '',
        'Date Impression': a.date_impression ? new Date(a.date_impression).toLocaleString('fr-FR') : '',
        'Montant': a.montant || '',
        'Statut': a.statut || 'Non utilisée',
        'Motif Annulation': a.motif_annulation || ''
      })));
      ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Carnet Complet');
      XLSX.writeFile(wb, `carnet_${carnetInfo?.nom_carnet || 'complet'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      alert('Erreur lors de l\'export');
    }
  };

  const handleExportAutresStatuts = () => {
    if (carnetDetailStats.autresDetails.length === 0) return;
    const carnetInfo = carnets.find(c => c.table_name === selectedCarnet);
    const ws = XLSX.utils.json_to_sheet(carnetDetailStats.autresDetails.map(a => ({
      'N° Attestation': a.numero_attestation,
      'Statut': a.statut || '',
      'Motif': a.motif_annulation || '',
      'N° Contrat': a.numero_contrat || '',
      'Assuré': a.assure || '',
      'Utilisateur': a.user_annule || ''
    })));
    ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Autres Statuts');
    XLSX.writeFile(wb, `autres_statuts_${carnetInfo?.nom_carnet || selectedCarnet}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleOpenBarreesModal = async () => {
    setBarreesModal({ open: true, attestations: [], loading: true, selectedImage: null });
    try {
      const { data: carnetsData } = await supabase.from('carnets_attestations').select('table_name');
      if (!carnetsData) return;

      let allBarrees: Attestation[] = [];
      for (const carnet of carnetsData) {
        const { data } = await supabase
          .from(carnet.table_name)
          .select('id, numero_attestation, numero_contrat, assure, date_impression, montant, statut, motif_annulation, user_annule, scan_barree_url, annule_par')
          .not('statut', 'is', null)
          .not('statut', 'in', '("imprimee","servie")')
          .order('numero_attestation', { ascending: true });
        if (data) allBarrees = allBarrees.concat(data as Attestation[]);
      }
      setBarreesModal(m => ({ ...m, attestations: allBarrees, loading: false }));
    } catch {
      setBarreesModal(m => ({ ...m, loading: false }));
    }
  };

  const handleOpenRemainingModal = async () => {    if (!selectedCarnet || !selectedCarnetInfo) return;
    setRemainingModal({ open: true, carnetName: selectedCarnetInfo.nom_carnet, attestations: [], loading: true });
    try {
      const { data, error } = await supabase
        .from(selectedCarnet)
        .select('id, numero_attestation, statut')
        .is('statut', null)
        .order('numero_attestation', { ascending: true });
      if (error) throw error;
      setRemainingModal(m => ({ ...m, attestations: (data || []) as Attestation[], loading: false }));
    } catch {
      setRemainingModal(m => ({ ...m, loading: false }));
    }
  };

  const handleExport = () => {
    if (attestations.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(attestations.map(a => ({
      'N° Attestation': a.numero_attestation,
      'N° Contrat': a.numero_contrat || '',
      'Assuré': a.assure || '',
      'Date Impression': a.date_impression ? new Date(a.date_impression).toLocaleString('fr-FR') : '',
      'Montant': a.montant || ''
    })));
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attestations');
    XLSX.writeFile(wb, `attestations_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const paginatedAttestations = attestations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(attestations.length / itemsPerPage);

  const selectedCarnetInfo = carnets.find(c => c.table_name === selectedCarnet);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-shadow"
          onClick={handleExportImprimees}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Attestations Imprimées</p>
              <p className="text-3xl font-bold mt-2">{statistics.imprimees}</p>
              <p className="text-blue-100 text-xs mt-1">Aujourd'hui — cliquer pour télécharger</p>
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
              <p className="text-red-100 text-xs mt-1">Non séquentielles — cliquer pour télécharger</p>
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
              <p className="text-green-100 text-xs mt-1">Enregistrés — cliquer pour télécharger</p>
            </div>
            <Download className="w-12 h-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Carnets Accomplis</p>
              <p className="text-3xl font-bold mt-2">{carnetsAccomplis}</p>
              <p className="text-orange-100 text-xs mt-1">
                sur {carnets.length} carnet{carnets.length !== 1 ? 's' : ''} — toutes attestions utilisées
              </p>
            </div>
            <FileText className="w-12 h-12 text-orange-200" />
          </div>
        </div>
      </div>


      {/* Nouveau Carnet — Hamza seulement */}
      {currentUser === 'Hamza' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">Nouveau Carnet d'Attestations</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de Début</label>
                <input
                  type="text"
                  value={numeroDebut}
                  onChange={(e) => setNumeroDebut(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de Fin</label>
                <input
                  type="text"
                  value={numeroFin}
                  onChange={(e) => setNumeroFin(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 1050"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre d'Attestations</label>
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
      )}

      {/* Sélecteur de carnet + Statistiques du carnet */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-800">Statistiques du Carnet</h3>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={selectedCarnet}
              onChange={(e) => { setSelectedCarnet(e.target.value); setShowCarnetStats(false); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {carnets.map((carnet) => (
                <option key={carnet.id} value={carnet.table_name}>
                  {carnet.nom_carnet} ({carnet.numero_debut} – {carnet.numero_fin})
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCarnetStats(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              {showCarnetStats ? 'Masquer stats' : 'Voir statistiques'}
            </button>
            {currentUser === 'Hamza' && (
              <button
                onClick={handleOpenBarreesModal}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Ban className="w-4 h-4" />
                Attestations Barrées
              </button>
            )}
          </div>
        </div>

        {selectedCarnetInfo && (
          <p className="text-sm text-gray-500 mb-4">
            Carnet <strong>{selectedCarnetInfo.nom_carnet}</strong> —{' '}
            <button
              onClick={handleOpenRemainingModal}
              className="text-blue-600 font-semibold underline hover:text-blue-800 transition-colors"
            >
              {carnetRemaining[selectedCarnet] ?? '...'} attestation(s) restante(s)
            </button>{' '}
            sur {selectedCarnetInfo.nombre_total}
          </p>
        )}

        {showCarnetStats && (
          <div className="space-y-4">
            {isLoadingCarnetStats ? (
              <div className="text-center py-6 text-gray-400">Chargement des statistiques...</div>
            ) : (
              <>
                {/* Progression du carnet sélectionné */}
                {selectedCarnetInfo && (() => {
                  const remaining = carnetRemaining[selectedCarnet] ?? selectedCarnetInfo.nombre_total;
                  const used = selectedCarnetInfo.nombre_total - remaining;
                  const pct = selectedCarnetInfo.nombre_total > 0 ? (used / selectedCarnetInfo.nombre_total) * 100 : 0;
                  const isComplete = remaining === 0;
                  return (
                    <div className="space-y-1 pb-4 border-b border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-700">Taux d'accomplissement</span>
                        <span className={`font-bold text-lg ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{used} / {selectedCarnetInfo.nombre_total}</span>
                      </div>
                    </div>
                  );
                })()}
                {/* Stat cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-emerald-700">Attestations Imprimées</p>
                        <p className="text-4xl font-bold text-emerald-800 mt-1">{carnetDetailStats.imprimees}</p>
                        <p className="text-xs text-emerald-600 mt-1">statut = imprimee ou servie</p>
                      </div>
                      <FileText className="w-10 h-10 text-emerald-400" />
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-amber-700">Autres Statuts</p>
                        <p className="text-4xl font-bold text-amber-800 mt-1">{carnetDetailStats.autres}</p>
                        <p className="text-xs text-amber-600 mt-1">annulée, servie, etc.</p>
                      </div>
                      <AlertCircle className="w-10 h-10 text-amber-400" />
                    </div>
                  </div>
                </div>

                {/* Détails des autres statuts */}
                {carnetDetailStats.autres > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-gray-700">
                        Détails — Autres Statuts ({carnetDetailStats.autres})
                      </h4>
                      <button
                        onClick={handleExportAutresStatuts}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Exporter Excel
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">N° Attestation</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Statut</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Motif</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">N° Contrat</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Assuré</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Utilisateur</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {carnetDetailStats.autresDetails.map((a) => (
                            <tr key={a.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{a.numero_attestation}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                  a.statut === 'annulee'
                                    ? 'bg-red-100 text-red-700'
                                    : a.statut === 'servie'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {a.statut}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{a.motif_annulation || '-'}</td>
                              <td className="px-4 py-3 text-gray-700">{a.numero_contrat || '-'}</td>
                              <td className="px-4 py-3 text-gray-700">{a.assure || '-'}</td>
                              <td className="px-4 py-3 text-gray-700">{a.user_annule || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {carnetDetailStats.imprimees === 0 && carnetDetailStats.autres === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <Search className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    Aucune attestation utilisée dans ce carnet
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tableau des attestations imprimées */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Attestations Imprimées du Carnet
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleExportCarnetDetails}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Carnet Complet
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
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
                        <td className="px-4 py-3 text-sm text-gray-700">{attestation.numero_contrat || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{attestation.assure || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {attestation.date_impression
                            ? new Date(attestation.date_impression).toLocaleString('fr-FR')
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {attestation.montant
                            ? `${attestation.montant.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT`
                            : '-'}
                        </td>
                        {currentUser === 'Hamza' && (
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleResetAttestation(attestation.id, attestation.numero_attestation)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                            >
                              <X className="w-3 h-3" />
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
                  Affichage {(currentPage - 1) * itemsPerPage + 1} à{' '}
                  {Math.min(currentPage * itemsPerPage, attestations.length)} sur {attestations.length}
                </div>
                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Précédent
                    </button>
                    <span className="px-4 py-2 text-gray-700 text-sm">
                      Page {currentPage} sur {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
      {/* Modal — Attestations Restantes */}
      {remainingModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Attestations Restantes</h3>
                <p className="text-sm text-gray-500 mt-0.5">Carnet : {remainingModal.carnetName}</p>
              </div>
              <button
                onClick={() => setRemainingModal(m => ({ ...m, open: false }))}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {remainingModal.loading ? (
                <div className="text-center py-10 text-gray-400">Chargement...</div>
              ) : remainingModal.attestations.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  Aucune attestation restante dans ce carnet
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-semibold text-blue-600">{remainingModal.attestations.length}</span> attestation(s) non utilisée(s)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {remainingModal.attestations.map((a) => (
                      <div
                        key={a.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center text-sm font-medium text-gray-700"
                      >
                        {a.numero_attestation}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setRemainingModal(m => ({ ...m, open: false }))}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal — Attestations Barrées (Hamza only) */}
      {barreesModal.open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Ban className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Attestations Barrées / Annulées</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Tous carnets confondus</p>
                </div>
              </div>
              <button
                onClick={() => setBarreesModal(m => ({ ...m, open: false, selectedImage: null }))}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {barreesModal.loading ? (
                <div className="text-center py-16 text-gray-400">Chargement...</div>
              ) : barreesModal.attestations.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Ban className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Aucune attestation barrée ou annulée trouvée</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    <span className="font-semibold text-red-600">{barreesModal.attestations.length}</span> attestation(s) trouvée(s)
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">N° Attestation</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Statut</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Motif</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">N° Contrat</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Assuré</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Annulé par</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Image</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {barreesModal.attestations.map((a) => (
                          <tr key={a.id} className="hover:bg-red-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{a.numero_attestation}</td>
                            <td className="px-4 py-3">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                                {a.statut}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{a.motif_annulation || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{a.numero_contrat || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{a.assure || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{a.annule_par || a.user_annule || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {a.date_impression
                                ? new Date(a.date_impression).toLocaleDateString('fr-FR')
                                : '-'}
                            </td>
                            <td className="px-4 py-3">
                              {a.scan_barree_url ? (
                                <button
                                  onClick={() => setBarreesModal(m => ({ ...m, selectedImage: a.scan_barree_url }))}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors text-xs"
                                >
                                  <ZoomIn className="w-3 h-3" />
                                  Voir
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">Pas d'image</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setBarreesModal(m => ({ ...m, open: false, selectedImage: null }))}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox — Image scan attestation barrée */}
      {barreesModal.selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setBarreesModal(m => ({ ...m, selectedImage: null }))}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setBarreesModal(m => ({ ...m, selectedImage: null }))}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={barreesModal.selectedImage}
              alt="Scan attestation barrée"
              className="w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttestationSequences;
