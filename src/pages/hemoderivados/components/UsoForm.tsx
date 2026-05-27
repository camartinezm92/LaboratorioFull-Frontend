import React, { useState } from 'react';
import { TransfusionUseRecord, ReceivedUnitRecord, BloodTestRecord } from '../types';
import { getColombiaDateString } from '../../../utils/dateUtils';
import { Save, AlertCircle, Clock, Thermometer, Activity, Search, User, Package, AlertTriangle } from 'lucide-react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

interface UsoFormProps {
  onSubmit: (record: Omit<TransfusionUseRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>) => Promise<void>;
  isSubmitting: boolean;
  initialData?: TransfusionUseRecord;
}

export const UsoForm: React.FC<UsoFormProps> = ({ onSubmit, isSubmitting, initialData }) => {
  const [formData, setFormData] = useState<Omit<TransfusionUseRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>>({
    service: initialData?.service || '',
    patientName: initialData?.patientName || '',
    patientId: initialData?.patientId || '',
    age: initialData?.age || '',
    gender: initialData?.gender || '',
    hemoderivativeType: initialData?.hemoderivativeType || '',
    bloodGroup: initialData?.bloodGroup || '',
    rh: initialData?.rh || '',
    orderDate: initialData?.orderDate || getColombiaDateString(),
    orderTime: initialData?.orderTime || '',
    transfusionDate: initialData?.transfusionDate || getColombiaDateString(),
    transfusionTime: initialData?.transfusionTime || '',
    opportunity: initialData?.opportunity || '',
    qualitySeal: initialData?.qualitySeal || '',
    unitId: initialData?.unitId || '',
    prescriptionFormat: initialData?.prescriptionFormat || '',
    informedConsent: initialData?.informedConsent || '',
    adminChecklist: initialData?.adminChecklist || '',
    nursingNote: initialData?.nursingNote || '',
    adverseReaction: initialData?.adverseReaction || '',
    safetyEvent: initialData?.safetyEvent || '',
    reactionDescription: initialData?.reactionDescription || '',
    observations: initialData?.observations || '',
  });

  const [error, setError] = useState('');
  const [searchingUnit, setSearchingUnit] = useState(false);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Cross-validate patient and unit whenever either changes
  React.useEffect(() => {
    const validateCrossMatch = async () => {
      if (formData.patientId && (formData.unitId || formData.qualitySeal)) {
        const type = formData.unitId ? 'unitId' : 'qualitySeal';
        const value = formData.unitId || formData.qualitySeal;
        
        const qTest = query(
          collection(db, 'bloodTestRecords'), 
          where(type, '==', value), 
          where('patientId', '==', formData.patientId)
        );
        const snapTest = await getDocs(qTest);
        
        // Filter out returned tests
        const validTests = snapTest.docs.filter(doc => !doc.data().returned);
        
        if (validTests.length === 0) {
          setAlertMessage(`ALERTA DE NOVEDAD: No se encontró una PRUEBA DE COMPATIBILIDAD válida (no devuelta) registrada para el paciente ${formData.patientId} con la unidad ${value}.`);
        }
      }
    };
    
    // Debounce or only run on specific triggers to avoid excessive reads
    // For now, simple check is fine as it's a small app
    if (formData.patientId.length >= 3 && (formData.unitId.length >= 3 || formData.qualitySeal.length >= 3)) {
      validateCrossMatch();
    }
  }, [formData.patientId, formData.unitId, formData.qualitySeal]);

  // Calculate Oportunidad automatically
  React.useEffect(() => {
    if (formData.orderDate && formData.orderTime && formData.transfusionDate && formData.transfusionTime) {
      const order = new Date(`${formData.orderDate}T${formData.orderTime}`);
      const transfusion = new Date(`${formData.transfusionDate}T${formData.transfusionTime}`);
      
      if (!isNaN(order.getTime()) && !isNaN(transfusion.getTime())) {
        const diffMs = transfusion.getTime() - order.getTime();
        if (diffMs >= 0) {
          const diffMins = Math.floor(diffMs / 60000);
          const hours = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          
          let opportunityText = '';
          if (hours > 0) {
            opportunityText += `${hours} h `;
          }
          opportunityText += `${mins} min`;
          
          setFormData(prev => ({ ...prev, opportunity: opportunityText.trim() }));
        } else {
          setFormData(prev => ({ ...prev, opportunity: 'Error: Fecha/Hora inválida' }));
        }
      }
    } else {
      setFormData(prev => ({ ...prev, opportunity: '' }));
    }
  }, [formData.orderDate, formData.orderTime, formData.transfusionDate, formData.transfusionTime]);

  const lookupUnit = async (value: string, type: 'qualitySeal' | 'unitId') => {
    if (!value || value.length < 3) return;
    setSearchingUnit(true);
    try {
      // 1. Check Reception
      const qRec = query(collection(db, 'receivedUnits'), where(type, '==', value), limit(1));
      const snapRec = await getDocs(qRec);
      
      if (snapRec.empty) {
        setAlertMessage(`NOVEDAD: La unidad con ${type === 'qualitySeal' ? 'Sello' : 'ID'} "${value}" no se encuentra en los registros de RECEPCIÓN.`);
        return;
      }

      const unit = snapRec.docs[0].data() as ReceivedUnitRecord;
      
      // 2. Check Blood Test (Cross-match) with current patient if patientId is present
      if (formData.patientId) {
        const qTest = query(
          collection(db, 'bloodTestRecords'), 
          where(type, '==', value), 
          where('patientId', '==', formData.patientId)
        );
        const snapTest = await getDocs(qTest);
        
        // Filter out returned tests
        const validTests = snapTest.docs.filter(doc => !doc.data().returned);
        
        if (validTests.length === 0) {
          setAlertMessage(`ALERTA DE NOVEDAD: La unidad existe en recepción pero NO se encontró una PRUEBA DE COMPATIBILIDAD válida (no devuelta) registrada para el paciente ${formData.patientId} con esta unidad.`);
        }
      }

      setFormData(prev => ({
        ...prev,
        unitId: unit.unitId,
        qualitySeal: unit.qualitySeal,
        hemoderivativeType: unit.hemoderivativeType,
        bloodGroup: unit.bloodGroup,
        rh: unit.rh
      }));
    } catch (err) {
      console.error('Error looking up unit:', err);
    } finally {
      setSearchingUnit(false);
    }
  };

  const lookupPatient = async (id: string) => {
    if (!id || id.length < 3) return;
    setSearchingPatient(true);
    try {
      const q = query(collection(db, 'bloodTestRecords'), where('patientId', '==', id), orderBy('createdAt', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const patient = querySnapshot.docs[0].data() as BloodTestRecord;
        setFormData(prev => ({
          ...prev,
          patientName: patient.patientName,
          age: patient.age || '',
          gender: patient.gender || '',
        }));
      } else {
        setAlertMessage(`NOVEDAD: No se encontró información previa para el paciente con ID "${id}" en los registros de Pruebas de Hemo.`);
      }
    } catch (err) {
      console.error('Error looking up patient:', err);
    } finally {
      setSearchingPatient(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...(prev[parent as keyof typeof prev] as any), [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLookupPatient = () => {
    lookupPatient(formData.patientId);
  };

  const handleLookupUnit = (type: 'qualitySeal' | 'unitId') => {
    lookupUnit(formData[type], type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const required = ['service', 'patientId', 'patientName', 'unitId', 'qualitySeal', 'transfusionDate', 'transfusionTime'];
    const missing = required.filter(f => !formData[f as keyof typeof formData]);
    if (missing.length > 0) {
      setError(`Complete los campos obligatorios: ${missing.join(', ')}`);
      return;
    }
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 space-y-8">
      <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
        <div className="bg-emerald-100 p-2 rounded-lg"><Activity className="text-emerald-600" size={24} /></div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">{initialData ? 'Editar Registro de Uso' : 'Registro de Uso (Transfusión)'}</h2>
          <p className="text-sm text-zinc-500">{initialData ? 'Modifique la información del acto transfusional' : 'Diligencie la información del acto transfusional'}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="space-y-6">
        <h3 className="font-bold text-zinc-800 flex items-center gap-2 text-lg"><User className="text-emerald-500" size={20} /> Información del Paciente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Servicio donde se transfunde *</label>
            <select name="service" value={formData.service} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" required>
              <option value="">Seleccione...</option>
              <option value="UCI Crítico">UCI Crítico</option>
              <option value="UCI Intermedio">UCI Intermedio</option>
              <option value="Hospitalización">Hospitalización</option>
              <option value="Cirugía">Cirugía</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">DOCUMENTO IDENTIDAD *</label>
            <div className="flex gap-2">
              <input type="text" name="patientId" value={formData.patientId} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" required />
              <button type="button" onClick={handleLookupPatient} disabled={searchingPatient} className="shrink-0 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50">
                <Search size={16} className={searchingPatient ? 'animate-spin' : ''} />
                {searchingPatient ? 'Buscando...' : 'Validar'}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">NOMBRE PACIENTE *</label>
            <input type="text" name="patientName" value={formData.patientName} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Edad</label>
            <input type="text" name="age" value={formData.age} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Género</label>
            <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">...</option><option value="Masculino">M</option><option value="Femenino">F</option><option value="Otro">O</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="font-bold text-zinc-800 flex items-center gap-2 text-lg"><Package className="text-emerald-500" size={20} /> Información de la Unidad</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">SELLO CALIDAD *</label>
            <div className="flex gap-2">
              <input type="text" name="qualitySeal" value={formData.qualitySeal} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" required />
              <button type="button" onClick={() => handleLookupUnit('qualitySeal')} disabled={searchingUnit} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50">
                <Search size={16} className={searchingUnit ? 'animate-spin' : ''} />
                {searchingUnit ? 'Buscando...' : 'Validar'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">ID Unidad *</label>
            <div className="flex gap-2">
              <input type="text" name="unitId" value={formData.unitId} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" required />
              <button type="button" onClick={() => handleLookupUnit('unitId')} disabled={searchingUnit} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50">
                <Search size={16} className={searchingUnit ? 'animate-spin' : ''} />
                {searchingUnit ? 'Buscando...' : 'Validar'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">TIPO DE HEMOCOMPONENTE</label>
            <input type="text" name="hemoderivativeType" value={formData.hemoderivativeType} readOnly className="w-full px-4 py-2.5 rounded-xl border border-zinc-100 bg-zinc-50 text-zinc-600" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">GRUPO SANGUÍNEO</label>
            <input type="text" name="bloodGroup" value={formData.bloodGroup} readOnly className="w-full px-4 py-2.5 rounded-xl border border-zinc-100 bg-zinc-50 text-zinc-600" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">RH</label>
            <input type="text" name="rh" value={formData.rh} readOnly className="w-full px-4 py-2.5 rounded-xl border border-zinc-100 bg-zinc-50 text-zinc-600" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="font-bold text-zinc-800 flex items-center gap-2 text-lg"><Clock className="text-emerald-500" size={20} /> Tiempos y Oportunidad</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">FECHA ORDEN</label>
            <input type="date" name="orderDate" value={formData.orderDate} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">HORA ORDEN</label>
            <input type="time" name="orderTime" value={formData.orderTime} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">FECHA TRANSFUSION *</label>
            <input type="date" name="transfusionDate" value={formData.transfusionDate} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">HORA TRANSFUSION *</label>
            <input type="time" name="transfusionTime" value={formData.transfusionTime} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">OPORTUNIDAD</label>
            <input type="text" name="opportunity" value={formData.opportunity} readOnly placeholder="Cálculo automático" className="w-full px-4 py-2.5 rounded-xl border border-zinc-100 bg-zinc-50 text-zinc-600 outline-none" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="font-bold text-zinc-800 flex items-center gap-2 text-lg"><AlertCircle className="text-emerald-500" size={20} /> Verificaciones y Seguridad</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">FORMATO DE PRESCRIPCIÓN</label>
            <select name="prescriptionFormat" value={formData.prescriptionFormat} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">...</option><option value="Sí">Sí</option><option value="No">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">CONSENTIMIENTO INFORMADO (Correcto diligenciamiento-Completitud)</label>
            <select name="informedConsent" value={formData.informedConsent} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">...</option><option value="Sí">Sí</option><option value="No">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">LISTA DE CHEQUEO ADMINISTRACIÓN (Correcto diligenciamiento)</label>
            <select name="adminChecklist" value={formData.adminChecklist} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">...</option><option value="Sí">Sí</option><option value="No">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">NOTA DE ENFERMERÍA</label>
            <select name="nursingNote" value={formData.nursingNote} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">...</option><option value="Sí">Sí</option><option value="No">No</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">REACCION TRANSFUSIONAL</label>
            <select name="adverseReaction" value={formData.adverseReaction} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">...</option><option value="No">No</option><option value="Sí">Sí</option>
            </select>
            {formData.adverseReaction === 'Sí' && (
              <textarea name="reactionDescription" value={formData.reactionDescription} onChange={handleChange} placeholder="Describa la reacción..." className="w-full mt-2 px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none h-24" />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">EVENTO DE SEGURIDAD DEL PACIENTE RELACIONADO</label>
            <textarea name="safetyEvent" value={formData.safetyEvent} onChange={handleChange} placeholder="Describa si hubo algún evento..." className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none h-32" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Observaciones Adicionales</label>
          <textarea name="observations" value={formData.observations} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none h-24" />
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3">
        {isSubmitting ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={24} />}
        {initialData ? 'Actualizar Registro' : 'Guardar Registro de Uso'}
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
