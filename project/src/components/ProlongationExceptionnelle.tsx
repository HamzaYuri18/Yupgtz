import React, { useState } from 'react';
import {
  Search, AlertTriangle, CheckCircle, Download,
  FileText, Car, MapPin, Calendar,
  RotateCcw, Shield
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';

// Noms des mois sans accents pour les noms de tables
const MOIS_TABLE: Record<number, string> = {
  0: 'janvier', 1: 'fevrier', 2: 'mars', 3: 'avril', 4: 'mai', 5: 'juin',
  6: 'juillet', 7: 'aout', 8: 'septembre', 9: 'octobre', 10: 'novembre', 11: 'decembre'
};



interface ProlongForm {
  numero_contrat: string;
  assure: string;
  prime: number;
  date_echeance: string;    // YYYY-MM-DD (référence 49 jours)
  pour_le_compte: string;
  classe: string;
  date_effet: string;
  date_fin_prolongation: string;
  marque: string;
  puissance: string;
  immatriculation: string;
  usage: string;
  adresse: string;
}

// ── Utilitaires date ──────────────────────────────────────────────────────────

const formatDateFR = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR');
};

const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const daysDiff = (isoA: string, isoB: string): number => {
  const a = new Date(isoA + 'T00:00:00').getTime();
  const b = new Date(isoB + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
};

// ── Génération PDF (deux coupons sur une page A4) ─────────────────────────────

const generateProlongationPDF = (f: ProlongForm) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const drawCoupon = (yOffset: number, withAdresse: boolean) => {
    const lx = 15;
    const rx = 118;
    let y = yOffset;

    // Cadre coupon
    doc.setDrawColor(100, 100, 120);
    doc.setLineWidth(0.4);
    doc.rect(10, yOffset - 4, W - 20, 76);

    // Code compagnie
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('503', lx, y);

    // Ligne séparatrice verticale
    doc.setLineWidth(0.2);
    doc.line(rx - 5, yOffset - 4, rx - 5, yOffset + 72);

    // ── Colonne gauche ───────────────────────────────────
    y += 9;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Numéro Contrat :', lx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(f.numero_contrat, lx + 38, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Classe :', lx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(f.classe, lx + 20, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Date effet :', lx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDateFR(f.date_effet), lx + 27, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Date fin prolongation :', lx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDateFR(f.date_fin_prolongation), lx + 51, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Assuré :', lx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(f.assure, lx + 20, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Pour le compte de :', lx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(f.pour_le_compte || '—', lx + 45, y);

    if (withAdresse && f.adresse) {
      y += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Adresse :', lx, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(f.adresse, 95);
      doc.text(lines, lx + 24, y);
    }

    // ── Colonne droite ───────────────────────────────────
    let ry = yOffset + 9;

    doc.setFont('helvetica', 'bold');
    doc.text('Marque :', rx, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(f.marque, rx + 22, ry);

    ry += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Puissance :', rx, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(f.puissance, rx + 28, ry);

    ry += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Immatriculation :', rx, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(f.immatriculation, rx + 40, ry);

    ry += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Usage :', rx, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(f.usage, rx + 18, ry);

    ry += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Date :', rx, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, rx + 16, ry);

    ry += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Heure :', rx, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(timeStr, rx + 19, ry);
  };

  // Coupon 1 (haut de page)
  drawCoupon(18, false);
  // Coupon 2 (milieu)
  drawCoupon(105, true);

  // ── Bloc récapitulatif bas de page ───────────────────────────────────────────
  doc.setDrawColor(60, 60, 80);
  doc.setFillColor(240, 240, 248);
  doc.setLineWidth(0.5);
  doc.rect(10, 192, W - 20, 48, 'FD');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 80);
  doc.text('Date fin prolongation :', W / 2, 204, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDateFR(f.date_fin_prolongation), W / 2, 215, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(20, 221, W - 20, 221);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Immatriculation :', W / 2, 231, { align: 'center' });

  doc.setFontSize(16);
  doc.text(f.immatriculation, W / 2, 242, { align: 'center' });

  doc.setTextColor(0, 0, 0);

  doc.save(`prolongation_${f.numero_contrat.replace(/\//g, '-')}.pdf`);
};


// ── Sauvegarde Supabase ───────────────────────────────────────────────────────

const saveProlongation = async (f: ProlongForm): Promise<void> => {
  const now = new Date();
  const { error } = await supabase.from('prolongation').insert([{
    numero_contrat: f.numero_contrat,
    assure: f.assure,
    prime: f.prime,
    date_echeance: f.date_echeance,
    pour_le_compte: f.pour_le_compte,
    classe: f.classe,
    date_effet: f.date_effet,
    date_fin_prolongation: f.date_fin_prolongation,
    marque: f.marque,
    puissance: f.puissance,
    immatriculation: f.immatriculation,
    usage: f.usage,
    adresse: f.adresse,
    date_demande: now.toISOString().split('T')[0],
    heure_demande: now.toTimeString().slice(0, 5),
  }]);
  if (error) throw new Error(error.message);
};

// ── Composant principal ───────────────────────────────────────────────────────

type Step = 'search' | 'form' | 'done';

const ProlongationExceptionnelle: React.FC = () => {
  const [step, setStep]           = useState<Step>('search');
  const [searchNum, setSearchNum] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm]           = useState<ProlongForm | null>(null);
  const [sending, setSending]     = useState(false);
  const [finErr, setFinErr]       = useState<string | null>(null);

  // ── Step 1 : Recherche ──────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchNum.trim() || !searchDate) {
      setError('Veuillez renseigner le numéro de contrat et la date d\'échéance.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const d = new Date(searchDate + 'T00:00:00');
      const monthKey = MOIS_TABLE[d.getMonth()];
      const year     = d.getFullYear();
      const tableName = `table_terme_${monthKey}_${year}`;

      // 1. Recherche dans la table mensuelle
      const { data: termeData, error: termeErr } = await supabase
        .from(tableName)
        .select('numero_contrat, assure, prime, echeance')
        .ilike('numero_contrat', searchNum.trim())
        .maybeSingle();

      if (termeErr) {
        setError(`Table "${tableName}" introuvable ou erreur : ${termeErr.message}`);
        return;
      }
      if (!termeData) {
        setError(`Aucun contrat trouvé dans la table ${tableName} pour ce numéro.`);
        return;
      }

      // 2. Vérifier si une prolongation existe déjà
      const { data: existing } = await supabase
        .from('prolongation')
        .select('id')
        .ilike('numero_contrat', searchNum.trim())
        .maybeSingle();

      if (existing) {
        setError('⛔ Ce contrat fait déjà l\'objet d\'une prolongation exceptionnelle. Nouvelle demande impossible.');
        return;
      }

      // 3. Initialiser le formulaire
      setForm({
        numero_contrat: termeData.numero_contrat,
        assure: termeData.assure || '',
        prime: Number(termeData.prime) || 0,
        date_echeance: searchDate,
        pour_le_compte: '',
        classe: '',
        date_effet: searchDate,
        date_fin_prolongation: '',
        marque: '',
        puissance: '',
        immatriculation: '',
        usage: '',
        adresse: '',
      });
      setStep('form');
    } catch (err: any) {
      setError(`Erreur inattendue : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Validation date fin ─────────────────────────────────────────────────────

  const validateFin = (val: string): string | null => {
    if (!val || !form) return null;
    const diff = daysDiff(form.date_echeance, val);
    if (diff <= 0) return 'La date de fin doit être après la date d\'échéance.';
    if (diff > 49) return `Maximum 49 jours après l'échéance (≤ ${addDays(form.date_echeance, 49)}).`;
    return null;
  };

  const handleFinChange = (val: string) => {
    setFinErr(validateFin(val));
    setForm(f => f ? { ...f, date_fin_prolongation: val } : f);
  };

  // ── Step 2 : Soumission ─────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form) return;

    // Validation finale
    const err = validateFin(form.date_fin_prolongation);
    if (err) { setFinErr(err); return; }
    if (!form.date_fin_prolongation) { setFinErr('La date de fin de prolongation est obligatoire.'); return; }
    if (!form.classe.trim())         { setError('La classe est obligatoire.'); return; }
    if (!form.marque.trim())         { setError('La marque est obligatoire.'); return; }
    if (!form.immatriculation.trim()) { setError('L\'immatriculation est obligatoire.'); return; }

    setSending(true);
    setError(null);

    try {
      await saveProlongation(form);
      setStep('done');
    } catch (err: any) {
      setError(`Erreur lors de l'enregistrement : ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const upd = (field: keyof ProlongForm, val: string) =>
    setForm(f => f ? { ...f, [field]: val } : f);

  const reset = () => {
    setStep('search');
    setSearchNum('');
    setSearchDate('');
    setForm(null);
    setError(null);
    setFinErr(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-violet-900 rounded-2xl p-6 text-white shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <Shield className="w-7 h-7 text-violet-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prolongation Exceptionnelle</h1>
            <p className="text-slate-400 text-sm mt-0.5">Demande de prolongation de couverture — max. 49 jours</p>
          </div>
        </div>

        {/* Étapes */}
        <div className="mt-5 flex items-center gap-3">
          {(['search', 'form', 'done'] as Step[]).map((s, i) => {
            const labels = ['Recherche', 'Formulaire', 'Confirmation'];
            const active = step === s;
            const done   = (['search', 'form', 'done'] as Step[]).indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? 'bg-violet-500 text-white' :
                  done   ? 'bg-emerald-600/60 text-emerald-200' :
                           'bg-white/10 text-white/40'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    active ? 'bg-white text-violet-600' :
                    done   ? 'bg-emerald-400 text-white' :
                             'bg-white/20 text-white/50'
                  }`}>{done ? '✓' : i + 1}</span>
                  {labels[i]}
                </div>
                {i < 2 && <div className="w-6 h-0.5 bg-white/20 rounded" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── ÉTAPE 1 : RECHERCHE ─────────────────────────────────────────────── */}
      {step === 'search' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <Search className="w-5 h-5 text-violet-600" />
            Identifier le contrat
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Numéro de contrat
              </label>
              <input
                type="text"
                value={searchNum}
                onChange={e => { setSearchNum(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="ex: CI0554N00478804"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-mono focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Date d'échéance
                <span className="ml-1 text-xs text-slate-500">(détermine la table terme à consulter)</span>
              </label>
              <input
                type="date"
                value={searchDate}
                onChange={e => { setSearchDate(e.target.value); setError(null); }}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
              {searchDate && (
                <p className="mt-1 text-xs text-slate-500">
                  → Table : <span className="font-mono font-semibold text-violet-700">
                    table_terme_{MOIS_TABLE[new Date(searchDate + 'T00:00:00').getMonth()]}_{new Date(searchDate + 'T00:00:00').getFullYear()}
                  </span>
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-6 flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg"
          >
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Recherche en cours…</>
            ) : (
              <><Search className="w-4 h-4" />Rechercher le contrat</>
            )}
          </button>
        </div>
      )}

      {/* ── ÉTAPE 2 : FORMULAIRE ────────────────────────────────────────────── */}
      {step === 'form' && form && (
        <div className="space-y-5">
          {/* Récapitulatif contrat */}
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-violet-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Contrat identifié
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'N° Contrat',   value: form.numero_contrat, mono: true },
                { label: 'Assuré',       value: form.assure },
                { label: 'Prime',        value: `${form.prime} DT` },
                { label: 'Échéance',     value: formatDateFR(form.date_echeance) },
              ].map(({ label, value, mono }) => (
                <div key={label} className="bg-white rounded-xl p-3 border border-violet-100">
                  <p className="text-xs text-violet-600 font-medium mb-1">{label}</p>
                  <p className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Formulaire complet */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Car className="w-5 h-5 text-violet-600" />
              Informations du véhicule
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Marque *" value={form.marque} onChange={v => upd('marque', v)} placeholder="ex: Peugeot" />
              <Field label="Puissance" value={form.puissance} onChange={v => upd('puissance', v)} placeholder="ex: 5 CV" />
              <Field label="Immatriculation *" value={form.immatriculation} onChange={v => upd('immatriculation', v)} placeholder="ex: 123 TU 4567" mono />
              <Field label="Usage" value={form.usage} onChange={v => upd('usage', v)} placeholder="ex: Voiture de tourisme" />
              <Field label="Classe *" value={form.classe} onChange={v => upd('classe', v)} placeholder="ex: Classe A" />
              <Field label="Pour le compte de" value={form.pour_le_compte} onChange={v => upd('pour_le_compte', v)} placeholder="Nom de la compagnie" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-violet-600" />
              Dates de prolongation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Date effet */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date d'effet</label>
                <input
                  type="date"
                  value={form.date_effet}
                  onChange={e => upd('date_effet', e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Date fin prolongation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Date fin de prolongation *
                  <span className="ml-1 text-xs text-slate-500">
                    (max: {formatDateFR(addDays(form.date_echeance, 49))} — 49 j après l'échéance)
                  </span>
                </label>
                <input
                  type="date"
                  value={form.date_fin_prolongation}
                  min={addDays(form.date_echeance, 1)}
                  max={addDays(form.date_echeance, 49)}
                  onChange={e => handleFinChange(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none ${
                    finErr ? 'border-red-400 bg-red-50' : 'border-slate-300'
                  }`}
                />
                {finErr && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />{finErr}
                  </p>
                )}
                {form.date_fin_prolongation && !finErr && (
                  <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {daysDiff(form.date_echeance, form.date_fin_prolongation)} jour(s) de prolongation
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-violet-600" />
              Assuré
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Assuré</label>
                <input
                  type="text"
                  value={form.assure}
                  readOnly
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-slate-600"
                />
              </div>
              <Field
                label="Adresse"
                value={form.adresse}
                onChange={v => upd('adresse', v)}
                placeholder="Adresse de l'assuré"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Nouvelle recherche
            </button>
            <button
              onClick={handleSubmit}
              disabled={sending || !!finErr || !form.date_fin_prolongation}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg"
            >
              {sending ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Enregistrement…</>
              ) : (
                <><CheckCircle className="w-4 h-4" />Enregistrer la prolongation</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : CONFIRMATION ──────────────────────────────────────────── */}
      {step === 'done' && form && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Demande enregistrée</h2>
            <p className="text-slate-500 mt-1">La prolongation a été sauvegardée dans Supabase.</p>
          </div>

          {/* Récap */}
          <div className="bg-slate-50 rounded-xl p-5 text-left max-w-lg mx-auto space-y-2">
            {[
              ['Contrat',              form.numero_contrat],
              ['Assuré',               form.assure],
              ['Classe',               form.classe],
              ['Marque / Immat.',      `${form.marque} — ${form.immatriculation}`],
              ['Date fin prolongation', formatDateFR(form.date_fin_prolongation)],
              ['Durée prolongation',   `${daysDiff(form.date_echeance, form.date_fin_prolongation)} jour(s)`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold text-slate-800">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => generateProlongationPDF(form)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg"
            >
              <Download className="w-4 h-4" />
              Télécharger le document PDF
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Nouvelle prolongation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Champ texte réutilisable ──────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}> = ({ label, value, onChange, placeholder, mono }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none ${mono ? 'font-mono' : ''}`}
    />
  </div>
);

export default ProlongationExceptionnelle;
