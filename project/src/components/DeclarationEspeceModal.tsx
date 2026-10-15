import React, { useState } from 'react';
import { X, FileText, Download, AlertTriangle, Building2 } from 'lucide-react';
import { generateDeclarationDocx, downloadBlob, type TypeDeclaration } from '../utils/declarationEspece';

export interface DeclarationDossier {
  kind: 'sinistre' | 'ristourne';
  reference: string;
  numero_sinistre?: string;
  client: string;
  montant: number;
}

interface Props {
  dossier: DeclarationDossier;
  onClose: () => void;
}

const DeclarationEspeceModal: React.FC<Props> = ({ dossier, onClose }) => {
  const isRistourne = dossier.kind === 'ristourne';
  const [typeDoc, setTypeDoc] = useState<'ristourne' | 'bns'>('ristourne');
  const [isSociete, setIsSociete] = useState(false);
  const [nomManuel, setNomManuel] = useState('');
  const [cin, setCin] = useState('');
  const [numeroContrat, setNumeroContrat] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const nomAssure = isSociete ? nomManuel.trim() : dossier.client;

  const handleDownload = async () => {
    setError('');
    if (!nomAssure) {
      setError(isSociete ? 'Veuillez saisir le nom de la société ou de la société de leasing.' : 'Le nom de l\'assuré est manquant.');
      return;
    }
    if (!cin.trim()) {
      setError('Veuillez saisir le numéro de CIN.');
      return;
    }
    if (isRistourne && !numeroContrat.trim()) {
      setError('Veuillez saisir le numéro de contrat.');
      return;
    }
    const type: TypeDeclaration = isRistourne ? typeDoc : 'espece';
    setIsGenerating(true);
    try {
      const blob = await generateDeclarationDocx({
        type,
        nomAssure,
        montant: dossier.montant,
        cin: cin.trim(),
        numeroSinistre: dossier.numero_sinistre,
        numeroContrat: isRistourne ? numeroContrat.trim() : undefined,
      });
      const base = isRistourne
        ? `${typeDoc === 'bns' ? 'BNS' : 'Ristourne'}_${numeroContrat.trim()}`
        : `Declaration_espece_sinistre_${dossier.numero_sinistre}`;
      downloadBlob(blob, `${base}.docx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération du document.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-black via-gray-900 to-emerald-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-white font-bold">
                {isRistourne ? 'Déclaration de règlement en espèce' : 'Déclaration de paiement en espèce'}
              </h3>
              <p className="text-emerald-200/70 text-xs">
                {isRistourne ? 'Ristourne' : `Sinistre n° ${dossier.numero_sinistre}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">Étape indispensable :</span> imprimez le modèle, faites-le signer par l'assuré et faites-le légaliser. Sans cette déclaration signée et légalisée, la caisse ne pourra pas être clôturée (scan ou dérogation de Mr Hamza).
            </p>
          </div>

          {isRistourne && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Type de document</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'ristourne', label: 'Ristourne' },
                  { value: 'bns', label: 'BNS' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTypeDoc(opt.value)}
                    className={`px-4 py-2.5 rounded-xl border-2 font-semibold transition-colors ${
                      typeDoc === opt.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Montant</p>
              <p className="font-semibold text-slate-800">{Math.abs(dossier.montant).toFixed(3)} DT</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Date</p>
              <p className="font-semibold text-slate-800">{new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSociete}
              onChange={e => setIsSociete(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-700">Société ou société de leasing</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom de l'assuré {isSociete && <span className="text-red-500">*</span>}
            </label>
            {isSociete ? (
              <input
                type="text"
                value={nomManuel}
                onChange={e => setNomManuel(e.target.value)}
                placeholder="Nom de la société / société de leasing"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            ) : (
              <input
                type="text"
                value={dossier.client}
                readOnly
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 text-slate-700"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Numéro CIN <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cin}
              onChange={e => setCin(e.target.value.replace(/\s/g, ''))}
              placeholder="Demander le CIN à l'assuré"
              maxLength={8}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          {isRistourne && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Numéro de contrat <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={numeroContrat}
                onChange={e => setNumeroContrat(e.target.value)}
                placeholder="Saisir le numéro de contrat"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
          )}

          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-black via-gray-900 to-emerald-900 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isGenerating ? 'Génération…' : 'Télécharger le modèle rempli (Word)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeclarationEspeceModal;
