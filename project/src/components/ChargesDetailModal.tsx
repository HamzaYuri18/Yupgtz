import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Receipt } from 'lucide-react';
import { expensesSupabase, ExpenseDetail } from '../lib/expensesSupabase';

interface Props {
  dateSession: string;
  onClose: () => void;
}

const formatDateTimeFR = (iso: string): string => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const ChargesDetailModal: React.FC<Props> = ({ dateSession, onClose }) => {
  const [rows, setRows] = useState<ExpenseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await expensesSupabase
          .from('expenses')
          .select('*')
          .eq('expense_date', dateSession)
          .order('created_at', { ascending: true });
        if (err) throw err;
        setRows(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des charges.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dateSession]);

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Détail des charges — {new Date(dateSession + 'T00:00:00').toLocaleDateString('fr-FR')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Chargement…</p>
          ) : error ? (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">Aucune charge détaillée pour cette session.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3">Catégorie</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2 pr-3">Créée le</th>
                      <th className="py-2 pr-3 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(r => (
                      <tr key={r.id}>
                        <td className="py-2.5 pr-3 text-gray-900">{r.description || '-'}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{r.category || '-'}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{r.source || '-'}</td>
                        <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{formatDateTimeFR(r.created_at)}</td>
                        <td className="py-2.5 pr-3 text-right font-medium text-gray-900">
                          {Number(r.amount).toFixed(2)} DT
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-600">Total</span>
                <span className="text-lg font-bold text-gray-900">{total.toFixed(2)} DT</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChargesDetailModal;
