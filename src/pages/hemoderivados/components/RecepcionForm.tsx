import React, { useState } from 'react';
import { ReceivedUnitRecord } from '../types';
import { Save, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp, Layers, CheckCircle } from 'lucide-react';
import { getColombiaDateString, getColombiaTimeShort } from '../../../utils/dateUtils';

interface RecepcionFormProps {
  onSubmit: (records: Omit<ReceivedUnitRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>[]) => Promise<void>;
  isSubmitting: boolean;
  initialData?: ReceivedUnitRecord;
}

export const RecepcionForm: React.FC<RecepcionFormProps> = ({ onSubmit, isSubmitting, initialData }) => {
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

  const supervisores = [
    "Luis Israel Valeriano Rodríguez",
    "Omadis Emelda Meza González"
  ].sort((a, b) => a.localeCompare(b));

  const [generalInfo, setGeneralInfo] = useState({
    receptionDate: initialData?.receptionDate || getColombiaDateString(),
    receptionTime: initialData?.receptionTime || getColombiaTimeShort(),
    provider: initialData?.provider || '' as ReceivedUnitRecord['provider'],
    receiverName: initialData?.receiverName || '',
    supervisorName: initialData?.supervisorName || '',
  });

  const [units, setUnits] = useState<Partial<ReceivedUnitRecord>[]>(initialData ? [{
    hemoderivativeType: initialData.hemoderivativeType,
    unitId: initialData.unitId,
    qualitySeal: initialData.qualitySeal,
    bloodGroup: initialData.bloodGroup,
    rh: initialData.rh,
    volume: initialData.volume,
    sampleDate: initialData.sampleDate,
    expirationDate: initialData.expirationDate,
    packagingIntegrity: initialData.packagingIntegrity,
    contentAspect: initialData.contentAspect,
    temperature: initialData.temperature,
    observations: initialData.observations,
    accepted: initialData.accepted,
    reclassified: initialData.reclassified || '',
    reclassifiedRh: initialData.reclassifiedRh || '',
    reclassifiedComment: initialData.reclassifiedComment || '',
    rejectionReason: initialData.rejectionReason,
    actionsTaken: initialData.actionsTaken,
    reporterName: initialData.reporterName,
  }] : [{
    hemoderivativeType: '',
    unitId: '',
    qualitySeal: '',
    bloodGroup: '',
    rh: '',
    volume: '',
    sampleDate: '',
    expirationDate: '',
    packagingIntegrity: '',
    contentAspect: '',
    temperature: '',
    observations: '',
    accepted: '',
    reclassified: '',
    reclassifiedRh: '',
    reclassifiedComment: '',
    rejectionReason: '',
    actionsTaken: '',
    reporterName: '',
  }]);

  const [collapsedUnits, setCollapsedUnits] = useState<boolean[]>([false]);
  const [error, setError] = useState('');

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setGeneralInfo({ ...generalInfo, [name]: value });

    // Automation for Hemocentro: if provider is Hemocentro, sync qualitySeal with unitId for all units
    if (name === 'provider' && value === 'Hemocentro') {
      setUnits(prevUnits => prevUnits.map(unit => ({
        ...unit,
        qualitySeal: unit.unitId || ''
      })));
    }
  };

  const handleUnitChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [name]: value };

    // Automation for Hemocentro: if provider is Hemocentro and unitId changes, sync qualitySeal
    if (generalInfo.provider === 'Hemocentro' && name === 'unitId') {
      newUnits[index].qualitySeal = value;
    }

    // Calculate expiration date based on sampleDate and hemoderivativeType
    if (name === 'sampleDate' || name === 'hemoderivativeType') {
      const sampleDateStr = newUnits[index].sampleDate;
      const type = newUnits[index].hemoderivativeType;
      
      if (sampleDateStr && type) {
        const sampleDate = new Date(sampleDateStr);
        let expirationDate = new Date(sampleDate);
        
        switch (type) {
          case 'Plasma Fresco Congelado':
          case 'Crioprecipitado':
            expirationDate.setFullYear(expirationDate.getFullYear() + 1);
            break;
          case 'Plaquetas AFERESIS':
          case 'Plaquetas (Estándar)':
            expirationDate.setDate(expirationDate.getDate() + 5);
            break;
          case 'Globulos Rojos':
            expirationDate.setDate(expirationDate.getDate() + 45);
            break;
        }
        
        newUnits[index].expirationDate = expirationDate.toISOString().split('T')[0];
      }
    }

    setUnits(newUnits);
  };

  const addUnit = () => {
    setUnits([...units, {
      hemoderivativeType: '',
      unitId: '',
      qualitySeal: '',
      bloodGroup: '',
      rh: '',
      volume: '',
      sampleDate: '',
      expirationDate: '',
      packagingIntegrity: '',
      contentAspect: '',
      temperature: '',
      observations: '',
      accepted: '',
      reclassified: '',
      reclassifiedRh: '',
      reclassifiedComment: '',
      rejectionReason: '',
      actionsTaken: '',
      reporterName: '',
    }]);
    setCollapsedUnits([...collapsedUnits, false]);
  };

  const removeUnit = (index: number) => {
    if (units.length > 1) {
      const newUnits = units.filter((_, i) => i !== index);
      setUnits(newUnits);
      const newCollapsed = collapsedUnits.filter((_, i) => i !== index);
      setCollapsedUnits(newCollapsed);
    }
  };

  const toggleCollapse = (index: number) => {
    const newCollapsed = [...collapsedUnits];
    newCollapsed[index] = !newCollapsed[index];
    setCollapsedUnits(newCollapsed);
  };

  const collapseAll = () => {
    setCollapsedUnits(units.map(() => true));
  };

  const expandAll = () => {
    setCollapsedUnits(units.map(() => false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!generalInfo.provider || !generalInfo.receiverName || !generalInfo.supervisorName) {
      setError('Por favor complete la información general (Proveedor, Receptor, Supervisor).');
      return;
    }

    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u.hemoderivativeType || !u.unitId || !u.bloodGroup || !u.rh || !u.sampleDate || !u.expirationDate || !u.accepted) {
        setError(`Por favor complete los campos obligatorios de la unidad ${i + 1} (Tipo, Número de bolsa, Grupo, Rh, Fecha de toma, Vencimiento, Aceptación).`);
        return;
      }
      if (u.accepted === 'No' && (!u.rejectionReason || !u.reporterName)) {
        setError(`Si la unidad ${i + 1} es rechazada, debe indicar el motivo y el encargado del reporte.`);
        return;
      }
    }

    const recordsToSubmit = units.map(u => ({
      ...generalInfo,
      ...u
    })) as Omit<ReceivedUnitRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>[];

    try {
      await onSubmit(recordsToSubmit);
      // Reset form
      setGeneralInfo({
        receptionDate: getColombiaDateString(),
        receptionTime: getColombiaTimeShort(),
        provider: '' as ReceivedUnitRecord['provider'],
        receiverName: '',
        supervisorName: '',
      });
      setUnits([{
        hemoderivativeType: '',
        unitId: '',
        qualitySeal: '',
        bloodGroup: '',
        rh: '',
        volume: '',
        sampleDate: '',
        expirationDate: '',
        packagingIntegrity: '',
        contentAspect: '',
        temperature: '',
        observations: '',
        accepted: '',
        reclassified: '',
        reclassifiedRh: '',
        reclassifiedComment: '',
        rejectionReason: '',
        actionsTaken: '',
        reporterName: '',
      }]);
      setCollapsedUnits([false]);
    } catch (err) {
      setError('Error al guardar los registros.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-zinc-100 overflow-hidden">
      <div className="bg-blue-600 p-6 text-white">
        <h2 className="text-2xl font-bold">{initialData ? 'Editar Recepción de Hemoderivado' : 'Formato de Recepción de Hemoderivados'}</h2>
        <p className="text-blue-100 mt-1">{initialData ? 'Modifique la información del ingreso' : 'Complete la información del ingreso'}</p>
      </div>

      <div className="p-8 space-y-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle size={20} />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Información General */}
        <section className="space-y-6">
          <h3 className="text-lg font-bold text-zinc-800 border-b pb-2">Información General</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Fecha de recepción</label>
              <input
                type="date"
                name="receptionDate"
                value={generalInfo.receptionDate}
                onChange={handleGeneralChange}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Hora de recepción</label>
              <input
                type="time"
                name="receptionTime"
                value={generalInfo.receptionTime}
                onChange={handleGeneralChange}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Proveedor (Banco de Sangre)</label>
              <select
                name="provider"
                value={generalInfo.provider}
                onChange={handleGeneralChange}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              >
                <option value="">Seleccione un proveedor...</option>
                <option value="Hemolife">Hemolife</option>
                <option value="Hemocentro">Hemocentro</option>
                <option value="FUHECO">FUHECO</option>
              </select>
            </div>
          </div>
        </section>

        {/* Unidades */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-zinc-800">Información de los Hemoderivados</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                {units.length} {units.length === 1 ? 'Unidad' : 'Unidades'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!initialData && units.length > 1 && (
                <div className="flex items-center bg-zinc-100 rounded-lg p-1 mr-2">
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="p-1.5 text-zinc-600 hover:bg-white hover:shadow-sm rounded-md transition-all"
                    title="Contraer todo"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={expandAll}
                    className="p-1.5 text-zinc-600 hover:bg-white hover:shadow-sm rounded-md transition-all"
                    title="Expandir todo"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
              )}
              {!initialData && (
                <button
                  type="button"
                  onClick={addUnit}
                  className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  <Plus size={18} /> Agregar Unidad
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {units.map((unit, index) => (
              <div key={index} className={`bg-zinc-50 rounded-2xl border transition-all duration-300 ${collapsedUnits[index] ? 'border-zinc-200 shadow-sm' : 'border-blue-200 shadow-md ring-1 ring-blue-100'}`}>
                {/* Header de la Unidad (siempre visible) */}
                <div 
                  className={`p-4 flex items-center justify-between cursor-pointer select-none ${collapsedUnits[index] ? 'hover:bg-zinc-100' : 'border-b border-zinc-200'}`}
                  onClick={() => toggleCollapse(index)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${collapsedUnits[index] ? 'bg-zinc-200 text-zinc-600' : 'bg-blue-600 text-white'}`}>
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-800">
                        {unit.unitId ? `Bolsa: ${unit.unitId}` : `Unidad #${index + 1}`}
                      </h4>
                      {collapsedUnits[index] && (
                        <div className="flex items-center gap-3 mt-0.5">
                          {unit.hemoderivativeType && (
                            <span className="text-xs text-zinc-500 font-medium">{unit.hemoderivativeType}</span>
                          )}
                          {unit.bloodGroup && (
                            <span className="text-xs bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-bold">
                              {unit.bloodGroup}{unit.rh}
                            </span>
                          )}
                          {unit.accepted && (
                            <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${unit.accepted === 'Sí' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {unit.accepted === 'Sí' ? 'Aceptada' : 'Rechazada'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(index);
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${collapsedUnits[index] ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                      >
                        {collapsedUnits[index] ? <ChevronDown size={14} /> : <CheckCircle size={14} />}
                        {collapsedUnits[index] ? 'Editar' : 'Finalizar Edición'}
                      </button>
                      {!initialData && units.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeUnit(index);
                        }}
                        className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Eliminar unidad"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <div className="p-1 text-zinc-400">
                      {collapsedUnits[index] ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                    </div>
                  </div>
                </div>

                {/* Contenido de la Unidad (colapsable) */}
                {!collapsedUnits[index] && (
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Tipo de hemoderivado</label>
                        <select
                          name="hemoderivativeType"
                          value={unit.hemoderivativeType}
                          onChange={(e) => handleUnitChange(index, e)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          required
                        >
                          <option value="">Seleccione...</option>
                          <option value="Globulos Rojos">Glóbulos Rojos</option>
                          <option value="Plasma Fresco Congelado">Plasma Fresco Congelado</option>
                          <option value="Crioprecipitado">Crioprecipitado</option>
                          <option value="Plaquetas (Estándar)">Plaquetas (Estándar)</option>
                          <option value="Plaquetas AFERESIS">Plaquetas AFERESIS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Número de bolsa</label>
                        <input
                          type="text"
                          name="unitId"
                          value={unit.unitId}
                          onChange={(e) => handleUnitChange(index, e)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          placeholder="Ej. 123456"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Sello de calidad</label>
                        <input
                          type="text"
                          name="qualitySeal"
                          value={unit.qualitySeal}
                          onChange={(e) => handleUnitChange(index, e)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          placeholder="Opcional"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Grupo Sanguíneo</label>
                        <select
                          name="bloodGroup"
                          value={unit.bloodGroup}
                          onChange={(e) => handleUnitChange(index, e)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          required
                        >
                          <option value="">Seleccione...</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="AB">AB</option>
                          <option value="O">O</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Factor Rh</label>
                        <select
                          name="rh"
                          value={unit.rh}
                          onChange={(e) => handleUnitChange(index, e)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          required
                        >
                          <option value="">Seleccione...</option>
                          <option value="+">Positivo (+)</option>
                          <option value="-">Negativo (-)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Volumen (mL)</label>
                        <input
                          type="number"
                          name="volume"
                          value={unit.volume}
                          onChange={(e) => handleUnitChange(index, e)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          placeholder="Ej. 250"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Fecha de toma de muestra</label>
                        <input
                          type="date"
                          name="sampleDate"
                          value={unit.sampleDate}
                          onChange={(e) => handleUnitChange(index, e)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Fecha de vencimiento</label>
                        <input
                          type="date"
                          name="expirationDate"
                          value={unit.expirationDate}
                          onChange={(e) => handleUnitChange(index, e)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-zinc-100"
                          required
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="border-t border-zinc-200 pt-4 mt-4">
                      <h5 className="font-medium text-zinc-700 mb-4">Verificación del Estado</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-2">Empaque y marcado</label>
                          <select
                            name="packagingIntegrity"
                            value={unit.packagingIntegrity}
                            onChange={(e) => handleUnitChange(index, e)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          >
                            <option value="">Seleccione...</option>
                            <option value="Íntegro">Íntegro</option>
                            <option value="Dañado">Dañado</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-2">Aspecto del contenido</label>
                          <select
                            name="contentAspect"
                            value={unit.contentAspect}
                            onChange={(e) => handleUnitChange(index, e)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                          >
                            <option value="">Seleccione...</option>
                            <option value="Normal">Normal</option>
                            <option value="Anormal">Anormal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-2">Temperatura (°C)</label>
                          <input
                            type="number"
                            step="0.1"
                            name="temperature"
                            value={unit.temperature}
                            onChange={(e) => handleUnitChange(index, e)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                            placeholder="Ej. 4.0"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-zinc-700 mb-2">Observaciones adicionales</label>
                          <textarea
                            name="observations"
                            value={unit.observations}
                            onChange={(e) => handleUnitChange(index, e)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-200 pt-4 mt-4">
                      <h5 className="font-medium text-zinc-700 mb-4">Aprobación de la Recepción</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-2">¿Cumple requisitos para ser aceptado?</label>
                          <select
                            name="accepted"
                            value={unit.accepted}
                            onChange={(e) => handleUnitChange(index, e)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white font-bold"
                            required
                          >
                            <option value="">Seleccione...</option>
                            <option value="Sí">Sí, Aceptado</option>
                            <option value="No">No, Rechazado</option>
                          </select>
                        </div>
                      </div>

                      {unit.accepted === 'No' && (
                        <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 space-y-4">
                          <h6 className="font-bold text-red-800">Registro de Incidentes (Rechazo)</h6>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-red-800 mb-2">Motivo del rechazo</label>
                              <input
                                type="text"
                                name="rejectionReason"
                                value={unit.rejectionReason}
                                onChange={(e) => handleUnitChange(index, e)}
                                className="w-full px-4 py-3 rounded-xl border border-red-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-white"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!initialData && (
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <button
                type="button"
                onClick={addUnit}
                className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium"
              >
                <Plus size={20} /> Agregar otra unidad a esta recepción
              </button>
              {units.length > 3 && (
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-6 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronUp size={20} /> Contraer Todas
                </button>
              )}
            </div>
          )}
        </section>

        {/* Firmas Generales */}
        <section className="space-y-6 border-t pt-6">
          <h3 className="text-lg font-bold text-zinc-800">Firmas de Recepción</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Receptor (Quien recibe)</label>
              <select
                name="receiverName"
                value={generalInfo.receiverName}
                onChange={handleGeneralChange}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              >
                <option value="">Seleccione un receptor...</option>
                {receptores.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Supervisor (Quien verifica)</label>
              <select
                name="supervisorName"
                value={generalInfo.supervisorName}
                onChange={handleGeneralChange}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              >
                <option value="">Seleccione un supervisor...</option>
                {supervisores.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={24} />
              {initialData ? 'Actualizar Registro' : 'Guardar Recepción'}
            </>
          )}
        </button>
      </div>
    </form>
  );
};
