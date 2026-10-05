import React, { useState } from 'react';
import { X, FileText, Download, AlertTriangle, Building2 } from 'lucide-react';
import { generateDeclarationEspeceDocx, downloadBlob } from '../utils/declarationEspece';

export interface SinistreEspece {
  numero_sinistre: string;
  montant: number;
  client: string;
}

interface Props {
  sinistre: SinistreEspece;
  onClose: () => void;
}

const DeclarationEspeceModal: React.FC<Props> = ({ sinistre, onClose }) => {
  const [isSociete, setIsSociete] = useState(false);
  const [nomManuel, setNomManuel] = useState('');
  const [cin, setCin] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const nomAssure = isSociete ? nomManuel.trim() : sinistre.client;

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
    setIsGenerating(true);
    try {
      const blob = await generateDeclarationEspeceDocx({
        nomAssure,
        montant: sinistre.montant,
        cin: cin.trim(),
        numeroSinistre: sinistre.numero_sinistre,
      });
      downloadBlob(blob, `Declaration_espece_sinistre_${sinistre.numero_sinistre}.docx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération du document.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-black via-gray-900 to-emerald-900 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-white font-bold">Déclaration de paiement en espèce</h3>
              <p className="text-emerald-200/70 text-xs">Sinistre n° {sinistre.numero_sinistre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">Étape indispensable :</span> imprimez le modèle de déclaration, faites-le signer par l'assuré et faites-le légaliser. Sans cette déclaration signée et légalisée, la caisse ne pourra pas être clôturée.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Montant</p>
              <p className="font-semibold text-slate-800">{Math.abs(sinistre.montant).toFixed(3)} DT</p>
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
                value={sinistre.client}
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
