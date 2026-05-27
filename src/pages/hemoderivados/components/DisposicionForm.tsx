import React, { useState } from 'react';
import { FinalDispositionRecord, ReceivedUnitRecord } from '../types';
import { getColombiaDateString } from '../../../utils/dateUtils';
import { Save, AlertCircle, Trash2, Truck, CheckCircle, Search, AlertTriangle } from 'lucide-react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface DisposicionFormProps {
  onSubmit: (record: Omit<FinalDispositionRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>) => Promise<void>;
  isSubmitting: boolean;
  initialData?: FinalDispositionRecord;
}

export const DisposicionForm: React.FC<DisposicionFormProps> = ({ onSubmit, isSubmitting, initialData }) => {
  const [formData, setFormData] = useState({
    unitId: initialData?.unitId || '',
    qualitySeal: initialData?.qualitySeal || '',
    dispositionDate: initialData?.dispositionDate || getColombiaDateString(),
    dispositionType: initialData?.dispositionType || '' as FinalDispositionRecord['dispositionType'],
    reason: initialData?.reason || '',
    responsiblePerson: initialData?.responsiblePerson || '',
    observations: initialData?.observations || '',
  });

  const [error, setError] = useState('');
  const [searchingUnit, setSearchingUnit] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const lookupUnit = async (value: string, type: 'qualitySeal' | 'unitId') => {
    if (!value || value.length < 3) return;
    setSearchingUnit(true);
    try {
      const q = query(collection(db, 'receivedUnits'), where(type, '==', value), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const unit = querySnapshot.docs[0].data() as ReceivedUnitRecord;
        setFormData(prev => ({
          ...prev,
          unitId: unit.unitId,
          qualitySeal: unit.qualitySeal,
        }));
      } else {
        setAlertMessage(`NOVEDAD: La unidad con ${type === 'qualitySeal' ? 'Sello' : 'ID'} "${value}" no se encuentra en los registros de RECEPCIÓN.`);
      }
    } catch (err) {
      console.error('Error looking up unit:', err);
    } finally {
      setSearchingUnit(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLookupUnit = (type: 'qualitySeal' | 'unitId') => {
    lookupUnit(formData[type], type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.unitId || !formData.dispositionType || !formData.responsiblePerson) {
      setError('Por favor complete los campos obligatorios (ID Unidad, Motivo de Disposición, Responsable).');
      return;
    }

    await onSubmit(formData as any);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 space-y-8">
      <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
        <div className="bg-rose-100 p-2 rounded-lg">
          <Trash2 className="text-rose-600" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">Disposición Final</h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 flex items-center gap-2">
              ID Unidad *
            </label>
            <div className="flex gap-2">
              <input type="text" name="unitId" value={formData.unitId} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-rose-500 outline-none" required />
              <button type="button" onClick={() => handleLookupUnit('unitId')} disabled={searchingUnit} className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50">
                <Search size={16} className={searchingUnit ? 'animate-spin' : ''} />
                {searchingUnit ? 'Buscando...' : 'Validar'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 flex items-center gap-2">
              Sello Calidad
            </label>
            <div className="flex gap-2">
              <input type="text" name="qualitySeal" value={formData.qualitySeal} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-rose-500 outline-none" />
              <button type="button" onClick={() => handleLookupUnit('qualitySeal')} disabled={searchingUnit} className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50">
                <Search size={16} className={searchingUnit ? 'animate-spin' : ''} />
                {searchingUnit ? 'Buscando...' : 'Validar'}
              </button>
            </div>
          </div>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Fecha *</label>
              <input type="date" name="dispositionDate" value={formData.dispositionDate} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-rose-500 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Responsable *</label>
              <input type="text" name="responsiblePerson" value={formData.responsiblePerson} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-rose-500 outline-none" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Motivo de Disposición *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'Transfundido', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'Descarte', icon: Trash2, color: 'text-rose-600', bg: 'bg-rose-50' },
                { id: 'Traslado', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' }
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, dispositionType: type.id as any }))}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    formData.dispositionType === type.id 
                    ? 'border-zinc-900 bg-zinc-900 text-white' 
                    : 'border-zinc-100 bg-white text-zinc-600 hover:border-zinc-200'
                  }`}
                >
                  <type.icon size={24} className={formData.dispositionType === type.id ? 'text-white' : type.color} />
                  <span className="text-xs font-bold">{type.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Observaciones</label>
            <textarea name="reason" value={formData.reason} onChange={handleChange} placeholder="Ej: Vencimiento, Hemólisis, Traslado a otra sede..." className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-rose-500 outline-none h-24" />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Notas Adicionales</label>
            <textarea name="observations" value={formData.observations} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-rose-500 outline-none h-24" />
          </div>
        </div>

      {/* Botón de Registro */}
      <button type="submit" disabled={isSubmitting} className="w-full bg-rose-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3">
        {isSubmitting ? (
          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Save size={24} />
        )}
        {initialData ? 'Actualizar Disposición Final' : 'Registrar Disposición Final'}
      </button>

      {/* Alerta de Novedad */}
      {alertMessage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Aviso de Novedad</h3>
            <p className="text-zinc-600 mb-6">{alertMessage}</p>
            <button type="button" onClick={() => setAlertMessage(null)} className="w-full px-4 py-3 bg-amber-600 text-white hover:bg-amber-700 rounded-xl font-bold transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
