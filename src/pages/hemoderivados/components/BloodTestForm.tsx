import React, { useState, useEffect } from 'react';
import { BloodTestRecord, ReceivedUnitRecord } from '../types';
import { generateInterpretation } from '../utils/bloodTestUtils';
import { PROFESSIONALS } from '../../../constants';
import { getColombiaISO, getNowISO } from '../../../utils/dateUtils';
import { Save, User, IdCard, Calendar, Droplets, ShieldCheck, UserCheck, FileText, Activity, AlertTriangle, MapPin, Hash, CheckCircle, XCircle, Search, Package } from 'lucide-react';

export const computeBloodGroupAndRh = (a: string, b: string, ab: string, d: string): { group: 'A' | 'B' | 'AB' | 'O' | ''; rh: '+' | '-' | '' } => {
  const combination = `${a},${b},${ab},${d}`;
  switch (combination) {
    case '+,0,+,+': return { group: 'A', rh: '+' };
    case '+,0,+,0': return { group: 'A', rh: '-' };
    case '0,+,+,+': return { group: 'B', rh: '+' };
    case '0,+,+,0': return { group: 'B', rh: '-' };
    case '+,+,+,+': return { group: 'AB', rh: '+' };
    case '+,+,+,0': return { group: 'AB', rh: '-' };
    case '0,0,0,+': return { group: 'O', rh: '+' };
    case '0,0,0,0': return { group: 'O', rh: '-' };
    default: return { group: '', rh: '' }; // Invalid/unrecognized combinations
  }
};

export const reverseMapBloodGroup = (group: string, rh: string): { a: '0' | '+'; b: '0' | '+'; ab: '0' | '+'; d: '0' | '+' } => {
  const g = group?.toUpperCase().trim();
  const r = rh?.trim();
  if (g === 'A' && r === '+') return { a: '+', b: '0', ab: '+', d: '+' };
  if (g === 'A' && r === '-') return { a: '+', b: '0', ab: '+', d: '0' };
  if (g === 'B' && r === '+') return { a: '0', b: '+', ab: '+', d: '+' };
  if (g === 'B' && r === '-') return { a: '0', b: '+', ab: '+', d: '0' };
  if (g === 'AB' && r === '+') return { a: '+', b: '+', ab: '+', d: '+' };
  if (g === 'AB' && r === '-') return { a: '+', b: '+', ab: '+', d: '0' };
  if (g === 'O' && r === '+') return { a: '0', b: '0', ab: '0', d: '+' };
  if (g === 'O' && r === '-') return { a: '0', b: '0', ab: '0', d: '0' };
  return { a: '0', b: '0', ab: '0', d: '+' }; // default O+
};

interface BloodTestFormProps {
  onSave: (record: BloodTestRecord) => void;
  userEmail?: string;
  existingRecords: BloodTestRecord[];
  receivedUnits?: ReceivedUnitRecord[];
  transfusionRecords?: any[];
  dispositionRecords?: any[];
  isSyncing?: boolean;
  initialData?: BloodTestRecord;
}

export const BloodTestForm: React.FC<BloodTestFormProps> = ({ 
  onSave, 
  userEmail, 
  existingRecords, 
  receivedUnits = [], 
  transfusionRecords = [],
  dispositionRecords = [],
  isSyncing,
  initialData
}) => {
  const [formData, setFormData] = useState<Partial<BloodTestRecord>>(() => {
    const init: BloodTestRecord = (initialData || {
      bloodGroup: 'O',
      rh: '+',
      testDate: getColombiaISO(), // Usar hora de Colombia
      result: '',
      patientName: '',
      patientId: '',
      eps: '',
      age: '',
      gender: 'M',
      unitId: '',
      unitGroup: 'O',
      unitRh: '+',
      unitExpirationDate: '',
      irregularAntibodies: 'NEGATIVO',
      autocontrol: '0',
      temperature: '',
      provider: 'Hemolife',
      requestedHemoderivative: 'Globulos Rojos',
      requestType: 'Reserva',
      qualitySeal: '',
      justification: '',
      siheviReport: 'No',
      siheviDescription: '',
      siheviPredefinedText: '',
      bacteriologist: '',
      registryNumber: '',
      // Phase fields initialize
      salinaPruebaCruzada: '0',
      salinaAutocontrol: '0',
      salinaTemperatura: '',
      incubacionPruebaCruzada: '0',
      incubacionAutocontrol: '0',
      incubacionTemperatura: '',
      proteicaPruebaCruzada: '0',
      proteicaAutocontrol: '0',
      proteicaTemperatura: '',
      createdAt: getNowISO()
    }) as BloodTestRecord;
    const defaultBins = reverseMapBloodGroup(init.bloodGroup || 'O', init.rh || '+');
    return {
      ...init,
      patientBloodA: init.patientBloodA || defaultBins.a,
      patientBloodB: init.patientBloodB || defaultBins.b,
      patientBloodAB: init.patientBloodAB || defaultBins.ab,
      patientBloodD: init.patientBloodD || defaultBins.d,
    };
  });

  const receptores = [
    "Andrés Fernando Villegas Quintero",
    "Carmenza Suarez Martinez",
    "Leidy Katherine Rubiano Rico",
    "Margie Lizeth Moreno Reyes",
    "María Alejandra Figueroa Delgado",
    "Olivia Lozano Vásquez",
    "Silvia María López Ávila",
    "Luis Israel Valeriano Rodríguez",
    "Omadis Emelda Meza González"
  ].sort((a, b) => a.localeCompare(b));

  const JUSTIFICATION_OPTIONS: Record<string, string[]> = {
    'Globulos Rojos': [
      'Hb < 7 Sepsis severa o choque séptico.',
      'Paciente coronario con Hb < 10',
      'Paciente con dobutamina > 8 mcg/kg/min e hipoperfusión tisular',
      'Sospecha de hipercoagulabilidad',
      'Anemia o pérdida activa por choque hipovolémico'
    ],
    'Plaquetas (Estándar)': [
      'Paciente con plaquetas < 50000 y requiere cirugía',
      'Paciente con plaquetas < 10000',
      'Paciente con plaquetas < 20000 y patología de HTA, DM, Ancianos, Coronarios',
      'Paciente con plaquetas < 50000 y descenso del 50 % en 24 horas'
    ],
    'Plaquetas AFERESIS': [
      'Paciente con plaquetas < 50000 y requiere cirugía',
      'Paciente con plaquetas < 10000',
      'Paciente con plaquetas < 20000 y patología de HTA, DM, Ancianos, Coronarios',
      'Paciente con plaquetas < 50000 y descenso del 50 % en 24 horas'
    ],
    'Plasma Fresco Congelado': [
      'INR > 20',
      'INR? Sangrado con antecedente de Warfarina ambulatoria',
      'INR > 12 requiere cirugía'
    ]
  };

  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{message: string, onConfirm: () => void} | null>(null);
  const [validationMessage, setValidationMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [unitValidationMessage, setUnitValidationMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [searchingUnit, setSearchingUnit] = useState(false);
  const [patientFound, setPatientFound] = useState(false);
  const [unitFound, setUnitFound] = useState(false);

  useEffect(() => {
    if (initialData) {
      const defaultBins = reverseMapBloodGroup(initialData.bloodGroup || 'O', initialData.rh || '+');
      setFormData({
        ...initialData,
        patientBloodA: initialData.patientBloodA || defaultBins.a,
        patientBloodB: initialData.patientBloodB || defaultBins.b,
        patientBloodAB: initialData.patientBloodAB || defaultBins.ab,
        patientBloodD: initialData.patientBloodD || defaultBins.d,
      });
    }
  }, [initialData]);

  const handleValidatePatient = async () => {
    const patientId = formData.patientId?.trim();
    if (!patientId) {
      setValidationMessage({ text: 'Ingrese un ID para validar', type: 'error' });
      setTimeout(() => setValidationMessage(null), 3000);
      return;
    }

    setSearchingPatient(true);
    // Simulate a small delay for better UX feedback
    await new Promise(resolve => setTimeout(resolve, 500));

    // Sort by createdAt descending to get the most recent record for this patient
    const patientRecords = existingRecords
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (patientRecords.length > 0) {
      const latestRecord = patientRecords[0];
      const defaultBins = reverseMapBloodGroup(latestRecord.bloodGroup || 'O', latestRecord.rh || '+');
      setFormData(prev => ({
        ...prev,
        patientName: latestRecord.patientName,
        eps: latestRecord.eps || '',
        age: latestRecord.age || '',
        gender: latestRecord.gender || 'M',
        bloodGroup: latestRecord.bloodGroup || 'O',
        rh: latestRecord.rh || '+',
        patientBloodA: defaultBins.a,
        patientBloodB: defaultBins.b,
        patientBloodAB: defaultBins.ab,
        patientBloodD: defaultBins.d,
      }));
      setPatientFound(true);
      setValidationMessage({ text: 'Paciente encontrado. Datos cargados.', type: 'success' });
    } else {
      setPatientFound(false);
      setAlertMessage(`NOVEDAD: El paciente con ID "${patientId}" no se encuentra en los registros previos.`);
    }
    
    setSearchingPatient(false);
    setTimeout(() => setValidationMessage(null), 3000);
  };

  const handleValidateUnit = async () => {
    const unitId = formData.unitId?.trim();
    if (!unitId) {
      setUnitValidationMessage({ text: 'Ingrese un Número de Bolsa para validar', type: 'error' });
      setTimeout(() => setUnitValidationMessage(null), 3000);
      return;
    }

    setSearchingUnit(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const unitRecord = receivedUnits.find(u => u.unitId === unitId || u.qualitySeal === unitId);
    
    // A unit is blocked if it's already used in transfusion/disposition 
    // OR if it has an active (accepted and not returned) cross-match record
    const isTransfusedOrDisposed = transfusionRecords.some(t => t.unitId === unitId || t.qualitySeal === unitId) ||
                                  dispositionRecords.some(d => d.unitId === unitId || d.qualitySeal === unitId);
    
    const hasActiveCrossmatch = existingRecords.some(r => 
      (r.unitId === unitId || r.qualitySeal === unitId) && 
      r.acceptedBy && 
      !r.returned
    );

    if (unitRecord) {
      if (isTransfusedOrDisposed) {
        setAlertMessage(`NOVEDAD: La unidad "${unitId}" ya ha sido UTILIZADA o tiene una DISPOSICIÓN FINAL.`);
        setUnitValidationMessage({ text: 'Unidad no disponible (Utilizada)', type: 'error' });
        return;
      }
      
      if (hasActiveCrossmatch) {
        setUnitValidationMessage({ 
          text: 'Unidad con reserva activa. Se permite crear la prueba pero no podrá aceptarse hasta que la bolsa se devuelva.', 
          type: 'success' 
        });
      } else {
        setUnitValidationMessage({ text: 'Unidad encontrada en Recepción. Datos cargados.', type: 'success' });
      }

      setFormData(prev => ({
        ...prev,
        unitGroup: unitRecord.bloodGroup,
        unitRh: unitRecord.rh,
        unitExpirationDate: unitRecord.expirationDate,
        provider: unitRecord.provider,
        requestedHemoderivative: unitRecord.hemoderivativeType,
        qualitySeal: unitRecord.qualitySeal || prev.qualitySeal,
      }));
      setUnitFound(true);
    } else {
      setUnitFound(false);
      setAlertMessage(`NOVEDAD: La unidad "${unitId}" no se encuentra en los registros de RECEPCIÓN.`);
    }
    
    setSearchingUnit(false);
    setTimeout(() => setUnitValidationMessage(null), 3000);
  };

  const proceedToSave = (finalPatientName: string) => {
    const newRecord: BloodTestRecord = {
      ...(formData as BloodTestRecord),
      patientName: finalPatientName,
      patientId: formData.patientId?.trim() || '',
      userEmail: userEmail || '',
      createdAt: getNowISO(),
    };

    onSave(newRecord);
    // Reset form
    setFormData({
      bloodGroup: 'O',
      rh: '+',
      patientBloodA: '0',
      patientBloodB: '0',
      patientBloodAB: '0',
      patientBloodD: '+',
      testDate: getColombiaISO(),
      result: '',
      patientName: '',
      patientId: '',
      eps: '',
      age: '',
      gender: 'M',
      unitId: '',
      unitGroup: 'O',
      unitRh: '+',
      unitExpirationDate: '',
      irregularAntibodies: 'NEGATIVO',
      autocontrol: '0',
      temperature: '',
      salinaPruebaCruzada: '0',
      salinaAutocontrol: '0',
      salinaTemperatura: '',
      incubacionPruebaCruzada: '0',
      incubacionAutocontrol: '0',
      incubacionTemperatura: '',
      proteicaPruebaCruzada: '0',
      proteicaAutocontrol: '0',
      proteicaTemperatura: '',
      provider: 'Hemolife',
      requestedHemoderivative: 'Globulos Rojos',
      requestType: 'Reserva',
      qualitySeal: '',
      bacteriologist: '',
      registryNumber: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que la unidad exista en recepción antes de permitir el registro
    const unitExists = receivedUnits.some(
      u => u.unitId === formData.unitId || u.qualitySeal === formData.qualitySeal
    );

    if (!unitExists) {
      setAlertMessage('ERROR: No se puede registrar la prueba. La unidad no se encuentra en los registros de recepción. Por favor, valide la unidad primero.');
      return;
    }

    if (!formData.bloodGroup || !formData.rh) {
      setAlertMessage('ERROR: El grupo de sangre o Rh del paciente no se ha podido determinar. Por favor verifique la validación de sangre del paciente (A, B, AB, D).');
      return;
    }

    if (!formData.bacteriologist) {
      setAlertMessage('Por favor seleccione el Bacteriólogo Responsable de realizar la prueba.');
      return;
    }

    if (!formData.patientName || !formData.patientId || !formData.testDate) {
      setAlertMessage('Por favor complete los campos obligatorios.');
      return;
    }

    const patientNameUpper = formData.patientName.toUpperCase().trim();
    const patientId = formData.patientId.trim();

    // Validate ID uniqueness / name match
    const existingPatient = existingRecords.find(r => r.patientId === patientId);
    if (existingPatient) {
      if (existingPatient.patientName.toUpperCase().trim() !== patientNameUpper) {
        setAlertMessage(`El ID ${patientId} ya está registrado con el nombre "${existingPatient.patientName}". Los nombres deben coincidir para el mismo ID.`);
        return;
      }
    }

    // Validate Unit Reuse - No longer blocking, just ensuring logic consistency
    // We allow multiple tests for the same unit as requested by user.
    // The actual block happens in PreTransfusionalApp when trying to "Accept" a unit already reserved by someone else.

    proceedToSave(patientNameUpper);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'patientId') setPatientFound(false);
    if (name === 'unitId') setUnitFound(false);
    
    setFormData(prev => {
      const updated = { 
        ...prev, 
        [name]: name === 'patientName' ? value.toUpperCase() : name === 'patientId' ? value.trim() : value 
      };
      
      if (name === 'unitId' && updated.provider === 'Hemocentro') {
        updated.qualitySeal = value;
      } else if (name === 'provider' && value === 'Hemocentro') {
        updated.qualitySeal = updated.unitId;
      }

      // Logic for non-RBC hemoderivatives
      if (name === 'requestedHemoderivative') {
        if (value !== 'Globulos Rojos') {
          updated.autocontrol = 'Unidad disponible';
          updated.result = 'Unidad disponible';
          updated.irregularAntibodies = 'NO APLICA';
        } else {
          updated.autocontrol = '0';
          updated.result = 'Compatible';
          updated.irregularAntibodies = 'NEGATIVO';
        }
        // Reset justification when hemoderivative changes
        updated.justification = '';
      }

      // Cross-match auto-conclusion logic for three phases
      if ([
        'salinaPruebaCruzada', 
        'incubacionPruebaCruzada', 
        'proteicaPruebaCruzada', 
        'requestedHemoderivative'
      ].includes(name)) {
        if (updated.requestedHemoderivative !== 'Globulos Rojos') {
          updated.result = 'Unidad disponible';
          updated.irregularAntibodies = 'NO APLICA';
        } else {
          const sPC = name === 'salinaPruebaCruzada' ? value : (updated.salinaPruebaCruzada || '0');
          const iPC = name === 'incubacionPruebaCruzada' ? value : (updated.incubacionPruebaCruzada || '0');
          const pPC = name === 'proteicaPruebaCruzada' ? value : (updated.proteicaPruebaCruzada || '0');
          
          if (sPC === '+' || iPC === '+' || pPC === '+') {
            updated.result = 'Incompatible';
            updated.irregularAntibodies = 'POSITIVO';
          } else {
            updated.result = 'Compatible';
            updated.irregularAntibodies = 'NEGATIVO';
          }
        }
      }

      // SIHEVI Logic
      if (['siheviReport', 'siheviDescription', 'patientId', 'patientName'].includes(name)) {
        const report = name === 'siheviReport' ? value : updated.siheviReport;
        const desc = name === 'siheviDescription' ? value : updated.siheviDescription;
        const pId = name === 'patientId' ? value : updated.patientId;
        const pName = name === 'patientName' ? value : updated.patientName;

        if (report === 'Sí') {
          updated.siheviPredefinedText = `Paciente (${pId} y ${pName}) presenta reporte en SIHEVI mostrando lo siguiente: ${desc || ''}`;
        } else if (report === 'No') {
          updated.siheviPredefinedText = `El paciente (${pId} y ${pName}) no tiene reportes a la fecha de IH registrados ni RAT reportadas asociados`;
        } else {
          updated.siheviPredefinedText = '';
        }
      }

      // Professional Logic
      if (name === 'bacteriologist') {
        const professional = PROFESSIONALS.find(p => p.name === value);
        if (professional) {
          updated.registryNumber = professional.registry;
        }
      }
      
      return updated;
    });
  };

  const handleBloodPillChange = (key: 'patientBloodA' | 'patientBloodB' | 'patientBloodAB' | 'patientBloodD', val: '0' | '+') => {
    setFormData(prev => {
      const updated = { ...prev, [key]: val };
      const res = computeBloodGroupAndRh(
        updated.patientBloodA || '0',
        updated.patientBloodB || '0',
        updated.patientBloodAB || '0',
        updated.patientBloodD || '+'
      );
      updated.bloodGroup = res.group;
      updated.rh = res.rh;
      return updated;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-8">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-4">
        <FileText className="text-red-600" size={24} />
        <h2 className="text-xl font-bold text-zinc-900">{initialData ? 'Editar Prueba de Compatibilidad' : 'Nueva Prueba de Compatibilidad'}</h2>
      </div>

      {/* Patient Info Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <User size={16} /> Información del Paciente
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">CC / Identificación *</label>
            <div className="flex gap-2">
              <input type="text" name="patientId" value={formData.patientId} onChange={handleChange} required className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" placeholder="ID" />
              <button 
                type="button" 
                onClick={handleValidatePatient}
                disabled={searchingPatient}
                className="shrink-0 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
              >
                <Search size={16} className={searchingPatient ? 'animate-spin' : ''} />
                {searchingPatient ? 'Buscando...' : 'Validar'}
              </button>
            </div>
            {validationMessage && (
              <p className={`text-xs font-medium ${validationMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {validationMessage.text}
              </p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-zinc-700">Nombre del Paciente *</label>
            <input type="text" name="patientName" value={formData.patientName} onChange={handleChange} required readOnly={patientFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${patientFound ? 'bg-zinc-50 text-zinc-500' : ''}`} placeholder="Nombre completo" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">EPS</label>
            <input type="text" name="eps" value={formData.eps} onChange={handleChange} readOnly={patientFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${patientFound ? 'bg-zinc-50 text-zinc-500' : ''}`} placeholder="Ej: PARTICULAR" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Edad</label>
            <input type="text" name="age" value={formData.age} onChange={handleChange} readOnly={patientFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${patientFound ? 'bg-zinc-50 text-zinc-500' : ''}`} placeholder="Ej: 68 A" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Sexo</label>
            <select name="gender" value={formData.gender} onChange={handleChange} disabled={patientFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${patientFound ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : ''}`}>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        </div>

        {/* VALIDATE BLOOD GROUP & RH INTERACTIVE GRID */}
        <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 mt-4 space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
            <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Droplets className="text-red-600" size={18} /> Validar Sangre (Inmunohematología del Paciente)
            </h4>
            <span className="text-xs text-zinc-500 font-medium">Auto-clasificación en tiempo real</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
            {/* The 4 boxes */}
            <div className="sm:col-span-4 grid grid-cols-4 gap-2">
              {(['patientBloodA', 'patientBloodB', 'patientBloodAB', 'patientBloodD'] as const).map((field, idx) => {
                const label = ['A', 'B', 'AB', 'D'][idx];
                const currentVal = formData[field] || '0';
                return (
                  <div key={field} className="bg-white border border-zinc-200 rounded-xl p-3 flex flex-col items-center justify-between shadow-sm space-y-2">
                    <span className="text-xs font-black text-zinc-400 tracking-wider uppercase mb-1">{label}</span>
                    <div className="flex gap-1 w-full justify-center">
                      <button
                        type="button"
                        onClick={() => handleBloodPillChange(field, '0')}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition-all ${
                          currentVal === '0'
                            ? 'bg-zinc-900 text-white font-extrabold shadow-sm'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBloodPillChange(field, '+')}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition-all ${
                          currentVal === '+'
                            ? 'bg-red-600 text-white font-extrabold shadow-sm'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Realtime conclusion display inside the same panel */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-center justify-center h-full min-h-[96px] text-center">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Resultado</span>
              <span className="text-4xl font-black text-red-700 tracking-tight select-none">
                {formData.bloodGroup && formData.rh ? `${formData.bloodGroup}${formData.rh}` : '❓'}
              </span>
              <span className="text-[10px] text-red-600 font-medium mt-1">
                {formData.bloodGroup && formData.rh ? 'Calculado' : 'No válido'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Unit Info Section - MOVING UP as requested */}
      <div className="space-y-4 pt-4 border-t border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Package size={16} /> Información de la Unidad (Bolsa)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Número de Unidad *</label>
            <div className="flex gap-2 items-center">
              <input 
                type="text" 
                name="unitId" 
                value={formData.unitId} 
                onChange={handleChange} 
                required
                className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-mono" 
                placeholder="Ej: 2331044178" 
              />
              <button 
                type="button" 
                onClick={handleValidateUnit}
                disabled={searchingUnit}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium disabled:opacity-50 h-[38px]"
                title="Validar en Recepción"
              >
                <Search size={14} className={searchingUnit ? 'animate-spin' : ''} />
                {searchingUnit ? '...' : 'Validar'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Sello de Calidad</label>
            <input type="text" name="qualitySeal" value={formData.qualitySeal} onChange={handleChange} readOnly={unitFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-mono ${unitFound ? 'bg-zinc-50 text-zinc-500' : ''}`} placeholder="Ej: SC-12345" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Fecha de Vencimiento Unidad</label>
            <input type="date" name="unitExpirationDate" value={formData.unitExpirationDate} onChange={handleChange} readOnly={unitFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${unitFound ? 'bg-zinc-50 text-zinc-500' : ''}`} />
          </div>
          
          {unitValidationMessage && (
            <div className="md:col-span-3">
              <p className={`text-xs flex items-center gap-1 ${unitValidationMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {unitValidationMessage.type === 'success' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                {unitValidationMessage.text}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Proveedor</label>
            <select name="provider" value={formData.provider} onChange={handleChange} disabled={unitFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${unitFound ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : ''}`}>
              <option value="Hemolife">Hemolife</option>
              <option value="Hemocentro">Hemocentro</option>
              <option value="FUHECO">FUHECO</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Hemoderivado Solicitado</label>
            <select name="requestedHemoderivative" value={formData.requestedHemoderivative} onChange={handleChange} disabled={unitFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${unitFound ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : ''}`}>
              <option value="Globulos Rojos">Glóbulos Rojos</option>
              <option value="Plasma Fresco Congelado">Plasma Fresco Congelado</option>
              <option value="Plaquetas (Estándar)">Plaquetas (Estándar)</option>
              <option value="Plaquetas AFERESIS">Plaquetas AFERESIS</option>
              <option value="Crioprecipitado">Crioprecipitado</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Tipo de Solicitud</label>
            <select name="requestType" value={formData.requestType} onChange={handleChange} className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm">
              <option value="Reserva">Reserva</option>
              <option value="Transfusion">Transfusion</option>
              <option value="Urgencia Vital">Urgencia Vital</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-600">Grupo de la Unidad</label>
            <select name="unitGroup" value={formData.unitGroup} onChange={handleChange} disabled={unitFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${unitFound ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : ''}`}>
              <option value="A">A</option><option value="B">B</option><option value="AB">AB</option><option value="O">O</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-600">Rh de la Unidad</label>
            <select name="unitRh" value={formData.unitRh} onChange={handleChange} disabled={unitFound} className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm ${unitFound ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : ''}`}>
              <option value="+">POSITIVO (+)</option><option value="-">NEGATIVO (-)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Test Details Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Activity size={16} /> Detalles del Examen
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Fecha y Hora del Examen *</label>
            <input type="datetime-local" step="1" name="testDate" value={formData.testDate} onChange={handleChange} required className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" />
          </div>
        </div>

        {/* Justification and SIHEVI Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-50">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-700 uppercase">Justificación Clínica</label>
            <select 
              name="justification" 
              value={formData.justification} 
              onChange={handleChange} 
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
            >
              <option value="">Seleccione una justificación...</option>
              {formData.requestedHemoderivative && JUSTIFICATION_OPTIONS[formData.requestedHemoderivative]?.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-700 uppercase">¿Paciente presenta IH o RAT en SIHEVI?</label>
            <select 
              name="siheviReport" 
              value={formData.siheviReport} 
              onChange={handleChange} 
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
            >
              <option value="No">No</option>
              <option value="Sí">Sí</option>
            </select>
          </div>
        </div>

        {formData.siheviReport === 'Sí' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Descripción del Reporte SIHEVI</label>
            <textarea
              name="siheviDescription"
              value={formData.siheviDescription}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm h-20 resize-none"
              placeholder="Describa el reporte encontrado..."
            />
          </div>
        )}

        {formData.siheviPredefinedText && (
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
            <p className="text-xs font-bold text-zinc-400 uppercase mb-2 tracking-wider">Vista Previa de Reporte</p>
            <p className="text-sm text-zinc-600 italic leading-relaxed">
              {formData.siheviPredefinedText}
            </p>
          </div>
        )}

        <div className="space-y-6 pt-4 border-t border-zinc-100">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-zinc-700 uppercase tracking-widest flex items-center gap-1.5">
              <Activity size={14} className="text-red-500" /> Rastreo de Anticuerpos Irregulares (Por Fases)
            </h4>
            <span className="text-xs text-zinc-400 italic font-medium">Auto-conclusión de compatibilidad</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SALINA PHASE */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/80"></div>
              <h5 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Fase Salina</h5>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Prueba Cruzada *</label>
                  <select 
                    name="salinaPruebaCruzada" 
                    value={formData.salinaPruebaCruzada} 
                    onChange={handleChange} 
                    disabled={formData.requestedHemoderivative !== 'Globulos Rojos'}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-semibold"
                  >
                    <option value="0">0</option>
                    <option value="+">+</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Autocontrol *</label>
                  <select 
                    name="salinaAutocontrol" 
                    value={formData.salinaAutocontrol} 
                    onChange={handleChange} 
                    disabled={formData.requestedHemoderivative !== 'Globulos Rojos'}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  >
                    <option value="0">0</option>
                    <option value="+">+</option>
                    <option value="++">++</option>
                    <option value="+++">+++</option>
                    <option value="++++">++++</option>
                    <option value="Unidad disponible">Unidad disponible</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Temperatura (°C)</label>
                  <input 
                    type="text" 
                    name="salinaTemperatura" 
                    value={formData.salinaTemperatura} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" 
                    placeholder="Ej: 22 o TA" 
                  />
                </div>
              </div>
            </div>

            {/* INCUBACION PHASE */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500/80"></div>
              <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Fase Incubación</h5>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Prueba Cruzada *</label>
                  <select 
                    name="incubacionPruebaCruzada" 
                    value={formData.incubacionPruebaCruzada} 
                    onChange={handleChange} 
                    disabled={formData.requestedHemoderivative !== 'Globulos Rojos'}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-semibold"
                  >
                    <option value="0">0</option>
                    <option value="+">+</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Autocontrol *</label>
                  <select 
                    name="incubacionAutocontrol" 
                    value={formData.incubacionAutocontrol} 
                    onChange={handleChange} 
                    disabled={formData.requestedHemoderivative !== 'Globulos Rojos'}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  >
                    <option value="0">0</option>
                    <option value="+">+</option>
                    <option value="++">++</option>
                    <option value="+++">+++</option>
                    <option value="++++">++++</option>
                    <option value="Unidad disponible">Unidad disponible</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Temperatura (°C)</label>
                  <input 
                    type="text" 
                    name="incubacionTemperatura" 
                    value={formData.incubacionTemperatura} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" 
                    placeholder="Ej: 37" 
                  />
                </div>
              </div>
            </div>

            {/* PROTEICA PHASE */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500/80"></div>
              <h5 className="text-xs font-bold text-red-800 uppercase tracking-wider">Fase Proteica (Coombs)</h5>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Prueba Cruzada *</label>
                  <select 
                    name="proteicaPruebaCruzada" 
                    value={formData.proteicaPruebaCruzada} 
                    onChange={handleChange} 
                    disabled={formData.requestedHemoderivative !== 'Globulos Rojos'}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-semibold"
                  >
                    <option value="0">0</option>
                    <option value="+">+</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Autocontrol *</label>
                  <select 
                    name="proteicaAutocontrol" 
                    value={formData.proteicaAutocontrol} 
                    onChange={handleChange} 
                    disabled={formData.requestedHemoderivative !== 'Globulos Rojos'}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  >
                    <option value="0">0</option>
                    <option value="+">+</option>
                    <option value="++">++</option>
                    <option value="+++">+++</option>
                    <option value="++++">++++</option>
                    <option value="Unidad disponible">Unidad disponible</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 uppercase">Temperatura (°C)</label>
                  <input 
                    type="text" 
                    name="proteicaTemperatura" 
                    value={formData.proteicaTemperatura} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" 
                    placeholder="Ej: 37" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RESULTADO FINAL MOVING TO THE END */}
        <div className="space-y-2 pt-4 border-t border-zinc-100">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} className="text-red-600" /> Resultado Final del Cruce *
          </label>
          <select 
            name="result" 
            value={formData.result} 
            onChange={handleChange} 
            required 
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-base font-bold transition-all ${
              formData.result === 'Compatible' 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : formData.result === 'Unidad disponible' 
              ? 'bg-blue-50 text-blue-700 border-blue-200' 
              : formData.result === 'Incompatible'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-white border-zinc-200 text-zinc-400'
            }`}
          >
            <option value="">SELECCIONE RESULTADO...</option>
            <option value="Compatible">COMPATIBLE</option>
            <option value="Incompatible">INCOMPATIBLE</option>
            <option value="Unidad disponible">UNIDAD DISPONIBLE</option>
          </select>
        </div>
      </div>

      {/* Interpretation Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <FileText size={16} /> Interpretación
        </h3>
        
        <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm italic border border-blue-100 min-h-[50px]">
          {formData.result ? generateInterpretation(formData) : 'Seleccione el resultado final para ver la interpretación.'}
        </div>
      </div>

      {/* Professional Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-100">
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-700">Bacteriólogo Responsable *</label>
          <select 
            name="bacteriologist" 
            value={formData.bacteriologist || ''} 
            onChange={handleChange} 
            required
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
          >
            <option value="">-- SELECCIONE BACTERIÓLOGO --</option>
            {PROFESSIONALS.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-700">Registro</label>
          <input type="text" name="registryNumber" value={formData.registryNumber} onChange={handleChange} className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm bg-zinc-50" readOnly />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-700">Usuario (Email)</label>
          <input type="text" value={userEmail || 'No disponible'} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none text-sm bg-zinc-50 text-zinc-500" readOnly />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button 
          type="submit" 
          disabled={isSyncing}
          className={`bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-red-100 transition-all active:scale-95 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSyncing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <Save size={20} />
          )}
          {isSyncing ? 'Sincronizando...' : initialData ? 'Actualizar Registro' : 'Guardar Registro'}
        </button>
      </div>

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Atención</h3>
            <p className="text-zinc-600 mb-6">{alertMessage}</p>
            <button type="button" onClick={() => setAlertMessage(null)} className="w-full px-4 py-3 bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
