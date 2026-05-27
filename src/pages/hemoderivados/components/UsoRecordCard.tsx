import React, { useState } from 'react';
import { TransfusionUseRecord } from '../types';
import { Activity, Calendar, Clock, User, Package, AlertCircle, Trash2, Eye, X, ClipboardCheck, Info, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UsoRecordCardProps {
  record: TransfusionUseRecord;
  onDelete: (id: string) => void;
  onEdit?: (record: TransfusionUseRecord) => void;
  currentUserUid?: string;
  isAdmin?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const UsoRecordCard: React.FC<UsoRecordCardProps> = ({ 
  record, 
  onDelete, 
  onEdit, 
  currentUserUid, 
  isAdmin,
  canEdit: customCanEdit,
  canDelete: customCanDelete
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const isOwner = currentUserUid === record.uid;
  const canDelete = customCanDelete !== undefined ? customCanDelete : isAdmin;
  const canEdit = customCanEdit !== undefined ? customCanEdit : isAdmin;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow relative group">
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          onClick={() => setShowDetails(true)}
          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
          title="Ver detalles completos"
        >
          <Eye size={20} />
        </button>
        {canEdit && onEdit && (
          <button
            onClick={() => onEdit(record)}
            className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
            title="Editar registro"
          >
            <Edit2 size={20} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => record.id && onDelete(record.id)}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Eliminar registro"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
          <Activity size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-zinc-900 mb-1">{record.patientName}</h3>
          <p className="text-sm text-zinc-600 font-medium mb-1">ID: {record.patientId}</p>
          <p className="text-zinc-500 flex items-center gap-2 text-xs">
            <Calendar size={14} />
            {record.transfusionDate} {record.transfusionTime}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-50 p-3 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">Servicio</p>
          <p className="font-semibold text-zinc-800 text-sm truncate">{record.service}</p>
        </div>
        <div className="bg-zinc-50 p-3 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">Unidad</p>
          <p className="font-bold text-emerald-600 flex items-center gap-1 text-sm">
            <Package size={14} />
            {record.unitId}
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500">Estado Transfusional</span>
          <div className="flex items-center gap-2">
            {record.adverseReaction === 'Sí' ? (
              <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                <AlertCircle size={14} /> Reacción Adversa
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                <ClipboardCheck size={14} /> Sin Reacciones
              </span>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-2 text-[10px] text-zinc-400">
          <User size={10} />
          <span>Registrado por: {record.userEmail || 'Desconocido'}</span>
        </div>
      </div>

      {/* Modal de Detalles */}
      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="sticky top-0 bg-white border-b border-zinc-100 p-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Info size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">Detalles del Acto Transfusional</h3>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-900"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Cabecera del Reporte */}
                <div className="flex flex-wrap gap-4 items-center justify-between bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Paciente</p>
                    <p className="text-2xl font-black text-zinc-900">{record.patientName}</p>
                    <p className="text-sm text-zinc-500">ID: {record.patientId} • {record.age} años • {record.gender}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Servicio</p>
                    <p className="text-xl font-bold text-emerald-600">{record.service}</p>
                  </div>
                </div>

                {/* Información de la Unidad */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                      <Package size={16} /> Información de la Unidad
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">ID Unidad:</span>
                        <span className="font-bold text-zinc-800">{record.unitId}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Sello de Calidad:</span>
                        <span className="font-bold text-blue-600">{record.qualitySeal}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Hemocomponente:</span>
                        <span className="font-bold text-zinc-800">{record.hemoderivativeType}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Grupo y Rh:</span>
                        <span className="font-bold text-red-600">{record.bloodGroup}{record.rh}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                      <Clock size={16} /> Tiempos y Oportunidad
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Fecha Orden:</span>
                        <span className="font-bold text-zinc-800">{record.orderDate} {record.orderTime}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Fecha Transfusión:</span>
                        <span className="font-bold text-zinc-800">{record.transfusionDate} {record.transfusionTime}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Oportunidad:</span>
                        <span className="font-bold text-emerald-600">{record.opportunity}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verificaciones */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                    <ClipboardCheck size={16} /> Verificaciones de Seguridad
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between p-3 bg-zinc-50 rounded-xl">
                      <span className="text-xs text-zinc-500">Formato Prescripción:</span>
                      <span className={`text-xs font-bold ${record.prescriptionFormat === 'Sí' ? 'text-green-600' : 'text-red-600'}`}>{record.prescriptionFormat}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-zinc-50 rounded-xl">
                      <span className="text-xs text-zinc-500">Consentimiento:</span>
                      <span className={`text-xs font-bold ${record.informedConsent === 'Sí' ? 'text-green-600' : 'text-red-600'}`}>{record.informedConsent}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-zinc-50 rounded-xl">
                      <span className="text-xs text-zinc-500">Lista Chequeo:</span>
                      <span className={`text-xs font-bold ${record.adminChecklist === 'Sí' ? 'text-green-600' : 'text-red-600'}`}>{record.adminChecklist}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-zinc-50 rounded-xl">
                      <span className="text-xs text-zinc-500">Nota Enfermería:</span>
                      <span className={`text-xs font-bold ${record.nursingNote === 'Sí' ? 'text-green-600' : 'text-red-600'}`}>{record.nursingNote}</span>
                    </div>
                  </div>
                </div>

                {/* Reacción Adversa */}
                {record.adverseReaction === 'Sí' && (
                  <div className="bg-red-50 p-6 rounded-3xl border border-red-100 space-y-4">
                    <div className="flex items-center gap-2 text-red-800 font-bold">
                      <AlertCircle size={20} /> DETALLES DE REACCIÓN ADVERSA
                    </div>
                    <p className="text-sm text-red-700 leading-relaxed">{record.reactionDescription}</p>
                  </div>
                )}

                {/* Evento de Seguridad */}
                {record.safetyEvent && (
                  <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 space-y-4">
                    <div className="flex items-center gap-2 text-amber-800 font-bold">
                      <AlertCircle size={20} /> EVENTO DE SEGURIDAD
                    </div>
                    <p className="text-sm text-amber-700 leading-relaxed">{record.safetyEvent}</p>
                  </div>
                )}

                {/* Observaciones */}
                {record.observations && (
                  <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Observaciones</h4>
                    <p className="text-zinc-700 italic leading-relaxed">"{record.observations}"</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-zinc-50 flex justify-end">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
