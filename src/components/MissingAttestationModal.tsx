import React, { useState } from 'react';
import { X, Upload, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MissingAttestationModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingNumbers: string[];
  currentUser: string;
  carnetTable: string;
  onComplete: () => void;
}

interface MissingAttestation {
  numero: string;
  motif: 'PRG' | 'TRUMAN' | 'Annulé' | '';
  scanFile: File | null;
  scanUrl: string;
}

export default function MissingAttestationModal({
  isOpen,
  onClose,
  missingNumbers,
  currentUser,
  carnetTable,
  onComplete
}: MissingAttestationModalProps) {
  const [attestations, setAttestations] = useState<MissingAttestation[]>(
    missingNumbers.map(num => ({
      numero: num,
      motif: '' as any,
      scanFile: null,
      scanUrl: ''
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  console.log('Modal opened with:', { missingNumbers, currentUser, carnetTable, attestations });

  if (!isOpen) return null;

  // Vérification de sécurité
  if (attestations.length === 0) {
    return null;
  }

  const currentAttestation = attestations[currentIndex];

  // Double vérification
  if (!currentAttestation) {
    return null;
  }

  const handleMotifChange = (motif: 'PRG' | 'TRUMAN' | 'Annulé') => {
    const updated = [...attestations];
    updated[currentIndex].motif = motif;
    setAttestations(updated);
    console.log('Motif changed to:', motif);
    console.log('Updated attestations:', updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const updated = [...attestations];
      updated[currentIndex].scanFile = file;
      setAttestations(updated);
    }
  };

  const uploadScanToSupabase = async (file: File, numeroAttestation: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `attestation_${numeroAttestation}_${Date.now()}.${fileExt}`;
      const filePath = `attestations_barrees/${fileName}`;

      const { data, error } = await supabase.storage
        .from('attestations')
        .upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('attestations')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading scan:', error);
      return null;
    }
  };

  const handleNext = async () => {
    console.log('handleNext called');
    console.log('Current attestation:', currentAttestation);
    console.log('Current motif:', currentAttestation.motif);

    if (!currentAttestation.motif) {
      alert('Veuillez sélectionner un motif');
      return;
    }

    if (currentAttestation.motif === 'Annulé' && !currentAttestation.scanFile) {
      alert('Veuillez scanner l\'attestation barrée');
      return;
    }

    if (currentIndex < attestations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      for (const attestation of attestations) {
        let scanUrl = '';

        if (attestation.motif === 'Annulé' && attestation.scanFile) {
          const uploadedUrl = await uploadScanToSupabase(attestation.scanFile, attestation.numero);
          if (uploadedUrl) {
            scanUrl = uploadedUrl;
          }
        }

        const { error } = await supabase.rpc('record_missing_attestation', {
          p_numero_attestation: attestation.numero,
          p_motif: attestation.motif,
          p_scan_url: scanUrl,
          p_user: currentUser,
          p_carnet_table: carnetTable
        });

        if (error) throw error;
      }

      alert(`${attestations.length} attestation(s) manquante(s) enregistrée(s) avec succès`);
      onComplete();
      onClose();
    } catch (error) {
      console.error('Error recording missing attestations:', error);
      alert('Erreur lors de l\'enregistrement des attestations manquantes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-red-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Attestation Manquante Détectée</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-semibold text-yellow-800 mb-1">
                  Vous avez raté {attestations.length} attestation(s)
                </p>
                <p className="text-sm text-yellow-700">
                  Attestation {currentIndex + 1} sur {attestations.length}: N° {currentAttestation.numero}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Numéro d'Attestation Manquante
              </label>
              <input
                type="text"
                value={currentAttestation.numero}
                readOnly
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-bold text-lg text-center"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Motif <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['PRG', 'TRUMAN', 'Annulé'] as const).map((motif) => (
                  <button
                    key={motif}
                    type="button"
                    onClick={() => handleMotifChange(motif)}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      currentAttestation.motif === motif
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {motif}
                  </button>
                ))}
              </div>
            </div>

            {currentAttestation.motif === 'Annulé' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Scanner l'Attestation Barrée <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="scan-upload"
                  />
                  <label
                    htmlFor="scan-upload"
                    className="cursor-pointer flex flex-col items-center gap-3"
                  >
                    <Upload className="w-12 h-12 text-gray-400" />
                    {currentAttestation.scanFile ? (
                      <div>
                        <p className="text-sm font-semibold text-green-600">
                          {currentAttestation.scanFile.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Cliquez pour changer
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          Cliquez pour scanner ou sélectionner une image
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG jusqu'à 10MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t">
            <div className="text-sm text-gray-600">
              Progression: {currentIndex + 1} / {attestations.length}
            </div>
            <div className="flex gap-3">
              {currentIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
              )}
              <button
                onClick={() => {
                  console.log('Button clicked!');
                  handleNext();
                }}
                disabled={isSubmitting || !currentAttestation.motif}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              >
                {isSubmitting
                  ? 'Enregistrement...'
                  : currentIndex < attestations.length - 1
                  ? 'Suivant'
                  : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
