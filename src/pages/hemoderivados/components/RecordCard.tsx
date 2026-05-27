import React from 'react';
import { BloodTestRecord } from '../types';
import { formatColombia } from '../../../utils/dateUtils';
import { FileText, Download, User, Calendar, Droplets, Eye, Trash2, Edit2, CheckCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generatePDF } from '../utils/pdfGenerator';

interface RecordCardProps {
  record: BloodTestRecord;
  onView: (record: BloodTestRecord) => void;
  onDelete: (id: string) => void;
  onEdit?: (record: BloodTestRecord) => void;
  onAccept?: (record: BloodTestRecord) => void;
  onReturn?: (record: BloodTestRecord) => void;
  currentUserUid?: string;
  isAdmin?: boolean;
  isUsed?: boolean;
  isReserved?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const RecordCard: React.FC<RecordCardProps> = ({ 
  record, 
  onView, 
  onDelete, 
  onEdit, 
  onAccept, 
  onReturn, 
  currentUserUid, 
  isAdmin, 
  isUsed, 
  isReserved,
  canEdit: customCanEdit,
  canDelete: customCanDelete
}) => {
  const canDelete = customCanDelete !== undefined ? customCanDelete : isAdmin;
  const canEdit = customCanEdit !== undefined ? customCanEdit : isAdmin;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-red-50 p-2 rounded-lg shrink-0">
            <Droplets className="text-red-600" size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-900 truncate" title={record.patientName}>{record.patientName}</h3>
            <p className="text-xs text-zinc-500">ID: {record.patientId}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          <button
            onClick={() => onView(record)}
            className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver Detalles"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={() => generatePDF(record)}
            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Descargar PDF"
          >
            <Download size={18} />
          </button>
          {canEdit && onEdit && (
            <button
              onClick={() => onEdit(record)}
              className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Editar Registro"
            >
              <Edit2 size={18} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => record.id && onDelete(record.id)}
              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar Registro"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div className="flex items-center gap-2 text-zinc-600">
          <Droplets size={14} className="text-zinc-400" />
          <span>Grupo: {record.bloodGroup} {record.rh}</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-600">
          <Calendar size={14} className="text-zinc-400" />
          <span>{formatColombia(record.testDate)}</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-600">
          <User size={14} className="text-zinc-400" />
          <span>{record.bacteriologist || record.responsiblePerson}</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-600">
          <FileText size={14} className="text-zinc-400" />
          <span className={`truncate font-semibold px-2 py-0.5 rounded-full text-xs ${
            record.result === 'Compatible' ? 'bg-green-100 text-green-700' : 
            record.result === 'Unidad disponible' ? 'bg-blue-100 text-blue-700' : 
            'bg-red-100 text-red-700'
          }`}>
            {record.result}
          </span>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {record.requestedHemoderivative && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-red-600 mb-1">
              {record.requestedHemoderivative}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {record.returned ? (
              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 whitespace-nowrap">
                Devuelta
              </span>
            ) : (
              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${
                isUsed ? 'bg-blue-100 text-blue-700' : 
                isReserved ? 'bg-orange-100 text-orange-700' : 
                'bg-green-100 text-green-700'
              }`}>
                {isUsed ? 'Utilizada' : isReserved ? 'Reservada' : 'Disponible'}
              </span>
            )}
            {record.acceptedBy && !record.returned && (
              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 whitespace-nowrap">
                Aceptada
              </span>
            )}
            {record.qualitySeal && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 whitespace-nowrap">
                Sello: {record.qualitySeal}
              </span>
            )}
          </div>
          {(record.unitId || record.hemoderivativeUnit) && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 truncate">
              Unidad: {record.unitId || record.hemoderivativeUnit}
            </span>
          )}
        </div>
        
        <div className="flex gap-2 shrink-0">
          {!record.acceptedBy && !record.returned && onAccept && (
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(record); }}
              disabled={isReserved}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                isReserved 
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed opacity-70' 
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-sm'
              }`}
              title={isReserved ? "Esta unidad ya está reservada para otro paciente" : "Aceptar unidad"}
            >
              <CheckCircle size={14} />
              Aceptar
            </button>
          )}
          {record.acceptedBy && !record.returned && !isUsed && onReturn && (
            <button
              onClick={(e) => { e.stopPropagation(); onReturn(record); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
            >
              <RotateCcw size={14} />
              Devolver
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
