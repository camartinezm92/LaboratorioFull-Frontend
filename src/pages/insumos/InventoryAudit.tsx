import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  History, 
  Filter, 
  Calendar,
  Package,
  Tag,
  Hash,
  Info
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { formatColombia } from '../../utils/dateUtils';

interface KardexEntry {
  id: string;
  supplyId: string;
  supplyName?: string;
  supplyCategory?: string;
  date: any;
  createdAt?: any;
  type: 'input' | 'output' | 'action';
  quantity: number;
  balance: number;
  responsible: string;
  observations: string;
  batch: string;
  expirationDate: string;
  actionType?: string; // e.g., 'edit_batch', 'delete_batch', 'edit_supply'
  invimaRecord?: string;
}

export const InventoryAudit: React.FC = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<KardexEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'input' | 'output' | 'action'>('all');
  const [categoryFilter, setCategoryFilter] = useState('Todas');

  useEffect(() => {
    const q = query(collection(db, 'kardexEntries'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KardexEntry));
      setEntries(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'kardexEntries'));

    return () => unsubscribe();
  }, []);

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = 
      (entry.supplyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (entry.batch?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (entry.responsible?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || entry.type === typeFilter;
    const matchesCategory = categoryFilter === 'Todas' || entry.supplyCategory === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const categories = ['Todas', ...Array.from(new Set(entries.map(e => e.supplyCategory).filter(Boolean)))];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/insumos/kardex')}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">Auditoría de Movimientos</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Lista Maestra de Logs e Historial Completo</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* Filters Section */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 mb-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por insumo, lote o responsable..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 bg-zinc-50 p-1 rounded-2xl border border-zinc-200">
              {(['all', 'input', 'output', 'action'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                    typeFilter === f 
                      ? 'bg-white text-zinc-900 shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {f === 'all' ? 'Todo' : f === 'input' ? 'Entradas' : f === 'output' ? 'Salidas' : 'Acciones'}
                </button>
              ))}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-sm font-medium"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                  <th className="px-6 py-4">Fecha Movimiento</th>
                  <th className="px-6 py-4">Fecha Registro</th>
                  <th className="px-6 py-4">Insumo / Categoría</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Cantidad / Saldo</th>
                  <th className="px-6 py-4">Lote / Vence</th>
                  <th className="px-6 py-4">Responsable / Obs.</th>
                  <th className="px-6 py-4">Reg. INVIMA</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-zinc-400 italic">
                      No se encontraron registros que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-zinc-600 font-medium whitespace-nowrap">
                          <Calendar size={14} className="text-zinc-400" />
                          {entry.date ? formatColombia(entry.date) : 'Pendiente...'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-zinc-400 text-xs whitespace-nowrap">
                          <Calendar size={12} className="text-zinc-300" />
                          {entry.createdAt ? formatColombia(entry.createdAt) : 'Pendiente...'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900">{entry.supplyName || 'Insumo Eliminado'}</span>
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{entry.supplyCategory || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          entry.type === 'input' ? 'bg-emerald-50 text-emerald-700' : 
                          entry.type === 'output' ? 'bg-red-50 text-red-700' : 
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {entry.type === 'input' ? 'Entrada' : entry.type === 'output' ? 'Salida' : `Acción: ${entry.actionType || 'Modificación'}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900">
                            {entry.type === 'input' ? '+' : entry.type === 'output' ? '-' : ''}{entry.quantity}
                          </span>
                          <span className="text-[10px] text-zinc-400">Saldo: {entry.balance}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs text-zinc-500">
                          <div className="flex items-center gap-1">
                            <Hash size={12} className="text-zinc-400" />
                            <span>Lote: {entry.batch}</span>
                          </div>
                          {entry.expirationDate && (
                            <div className="flex items-center gap-1">
                              <Calendar size={12} className="text-zinc-400" />
                              <span>Vence: {entry.expirationDate}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col max-w-xs">
                          <span className="text-zinc-600 font-medium truncate">{entry.responsible}</span>
                          {entry.observations && (
                            <div className="flex items-start gap-1 mt-1">
                              <Info size={12} className="text-zinc-400 mt-0.5 shrink-0" />
                              <span className="text-[10px] text-zinc-500 italic line-clamp-2">{entry.observations}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-600 text-xs">
                        {entry.invimaRecord || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
