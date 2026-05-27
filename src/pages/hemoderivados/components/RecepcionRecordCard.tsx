import React, { useState } from 'react';
import { ReceivedUnitRecord } from '../types';
import { Package, Calendar, Droplets, CheckCircle, XCircle, Trash2, User, Eye, X, Thermometer, Info, ClipboardCheck, UserCheck, Edit2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RecepcionRecordCardProps {
  record: ReceivedUnitRecord;
  isUsed?: boolean;
  isReserved?: boolean;
  onDelete: (id: string) => void;
  onEdit?: (record: ReceivedUnitRecord) => void;
  onReclassify?: (record: ReceivedUnitRecord) => void;
  currentUserUid?: string;
  isAdmin?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const RecepcionRecordCard: React.FC<RecepcionRecordCardProps> = ({ 
  record, 
  isUsed, 
  isReserved, 
  onDelete, 
  onEdit, 
  onReclassify, 
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
    <div className={`rounded-3xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow relative ${
      isUsed ? 'bg-red-50/50' : 
      isReserved ? 'bg-amber-50/50' : 
      'bg-white'
    }`}>
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          onClick={() => setShowDetails(true)}
          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
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
        <div className={`p-3 rounded-2xl ${record.accepted === 'Sí' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          <Package size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-zinc-900 mb-1">Bolsa: {record.unitId}</h3>
          <p className="text-sm text-zinc-600 font-medium mb-1">Sello: {record.qualitySeal}</p>
          <p className="text-zinc-500 flex items-center gap-2">
            <Calendar size={14} />
            {record.receptionDate} {record.receptionTime}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-50 p-3 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">Tipo</p>
          <p className="font-semibold text-zinc-800">{record.hemoderivativeType}</p>
        </div>
        <div className="bg-zinc-50 p-3 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">Grupo y Rh</p>
          <p className="font-bold text-red-600 flex items-center gap-1">
            <Droplets size={14} />
            {record.bloodGroup}{record.rh}
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-zinc-500">Estado de Recepción</span>
          <div className="flex items-center gap-2">
            {record.reclassified === 'Sí' && (
              <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700">
                Reclasificado
              </span>
            )}
            {record.reclassified === 'Novedad' && (
              <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-700">
                Novedad Reclasificación
              </span>
            )}
            {record.accepted === 'Sí' && (
              <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                isUsed ? 'bg-blue-100 text-blue-700' : 
                isReserved ? 'bg-orange-100 text-orange-700' : 
                'bg-green-100 text-green-700'
              }`}>
                {isUsed ? 'Utilizada' : isReserved ? 'Reservada' : 'Disponible'}
              </span>
            )}
            {record.accepted === 'Sí' ? (
              <span className="flex items-center gap-1 text-sm font-bold text-green-600">
                <CheckCircle size={16} /> Aceptado
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-bold text-red-600">
                <XCircle size={16} /> Rechazado
              </span>
            )}
          </div>
        </div>
        
        {record.accepted === 'No' && record.rejectionReason && (
          <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-sm text-red-800"><span className="font-bold">Motivo:</span> {record.rejectionReason}</p>
          </div>
        )}

        {record.accepted === 'Sí' && !isUsed && !record.reclassified && onReclassify && (
          <div className="mt-4">
            <button
              onClick={() => onReclassify(record)}
              className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors"
            >
              <ClipboardCheck size={18} />
              Reclasificar
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
          <User size={12} />
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
                  <div className={`p-2 rounded-xl ${record.accepted === 'Sí' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    <Info size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">Detalles de Recepción</h3>
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
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Número de Bolsa</p>
                    <p className="text-2xl font-black text-zinc-900">{record.unitId}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Sello de Calidad</p>
                    <p className="text-xl font-bold text-blue-600">{record.qualitySeal}</p>
                  </div>
                </div>

                {/* Información Básica */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                      <ClipboardCheck size={16} /> Información del Producto
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Tipo:</span>
                        <span className="font-bold text-zinc-800">{record.hemoderivativeType}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Grupo y Rh:</span>
                        <span className="font-bold text-red-600">{record.bloodGroup}{record.rh}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Proveedor:</span>
                        <span className="font-bold text-zinc-800">{record.provider}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Fecha Toma:</span>
                        <span className="font-bold text-zinc-800">{record.sampleDate}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Vencimiento:</span>
                        <span className="font-bold text-zinc-800">{record.expirationDate}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Volumen:</span>
                        <span className="font-bold text-zinc-800">{record.volume} mL</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                      <Thermometer size={16} /> Verificación Física
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Temperatura:</span>
                        <span className="font-bold text-blue-600">{record.temperature}°C</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Empaque:</span>
                        <span className={`font-bold ${record.packagingIntegrity === 'Íntegro' ? 'text-green-600' : 'text-red-600'}`}>
                          {record.packagingIntegrity}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50">
                        <span className="text-zinc-500">Aspecto:</span>
                        <span className={`font-bold ${record.contentAspect === 'Normal' ? 'text-green-600' : 'text-red-600'}`}>
                          {record.contentAspect}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                {record.observations && (
                  <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Observaciones</h4>
                    <p className="text-zinc-700 italic leading-relaxed">"{record.observations}"</p>
                  </div>
                )}

                {/* Reclasificación (si aplica) */}
                {record.reclassified === 'Novedad' && (
                  <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 space-y-4">
                    <div className="flex items-center gap-2 text-orange-800 font-bold">
                      <AlertTriangle size={20} /> NOVEDAD DE RECLASIFICACIÓN
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-orange-700"><span className="font-bold">Nuevo Grupo Sanguíneo:</span> {record.reclassifiedBloodGroup || record.bloodGroup}</p>
                      <p className="text-sm text-orange-700"><span className="font-bold">Nuevo Factor Rh:</span> {record.reclassifiedRh || record.rh}</p>
                      <p className="text-sm text-orange-700"><span className="font-bold">Comentario:</span> {record.reclassifiedComment}</p>
                    </div>
                  </div>
                )}

                {/* Firmas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-zinc-100">
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                      <UserCheck size={16} /> Receptor
                    </h4>
                    <p className="font-bold text-zinc-800">{record.receiverName}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                      <UserCheck size={16} /> Supervisor
                    </h4>
                    <p className="font-bold text-zinc-800">{record.supervisorName}</p>
                  </div>
                </div>

                {/* Rechazo (si aplica) */}
                {record.accepted === 'No' && (
                  <div className="bg-red-50 p-6 rounded-3xl border border-red-100 space-y-4">
                    <div className="flex items-center gap-2 text-red-800 font-bold">
                      <XCircle size={20} /> DETALLES DEL RECHAZO
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-red-700"><span className="font-bold">Motivo:</span> {record.rejectionReason}</p>
                      <p className="text-sm text-red-700"><span className="font-bold">Acciones:</span> {record.actionsTaken}</p>
                      <p className="text-sm text-red-700"><span className="font-bold">Reportado por:</span> {record.reporterName}</p>
                    </div>
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
