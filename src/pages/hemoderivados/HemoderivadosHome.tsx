import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Droplets, Inbox, Activity, CheckCircle, ArrowRight, FileText, ArrowLeft, Lock } from 'lucide-react';
import { TraceabilityExportModal } from './components/TraceabilityExportModal';
import { SimpleConfirmModal } from '../../components/SimpleConfirmModal';
import { ExcelExportButton } from '../../components/ExcelExportButton';
import { usePermissions } from '../../hooks/usePermissions';

export const HemoderivadosHome: React.FC = () => {
  const navigate = useNavigate();
  const [isTraceabilityModalOpen, setIsTraceabilityModalOpen] = useState(false);
  const { permissions, isAdmin, loading } = usePermissions();

  useEffect(() => {
    document.title = 'Hemocomponentes';
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (!isAdmin && !permissions) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[2.5rem] shadow-xl border border-zinc-200 text-center max-w-md">
          <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-600">
            <Lock size={40} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-4">Acceso Restringido</h1>
          <p className="text-zinc-500 mb-8">
            No tiene permisos activos para acceder al sistema. Por favor, inicie sesión o contacte con el administrador.
          </p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  const modules = [
    {
      id: 'recepcion',
      title: 'Recepción',
      description: 'Gestión de ingreso y registro inicial de hemoderivados.',
      icon: <Inbox size={32} />,
      color: 'bg-blue-50 text-blue-600',
      hoverColor: 'hover:bg-blue-600 hover:text-white',
      path: '/hemoderivados/recepcion'
    },
    {
      id: 'pre-transfusional',
      title: 'Pre-transfusional',
      description: 'Pruebas cruzadas y compatibilidad sanguínea.',
      icon: <Droplets size={32} />,
      color: 'bg-red-50 text-red-600',
      hoverColor: 'hover:bg-red-600 hover:text-white',
      path: '/hemoderivados/pre-transfusional'
    },
    {
      id: 'uso',
      title: 'Uso',
      description: 'Registro de transfusiones y seguimiento de pacientes.',
      icon: <Activity size={32} />,
      color: 'bg-emerald-50 text-emerald-600',
      hoverColor: 'hover:bg-emerald-600 hover:text-white',
      path: '/hemoderivados/uso'
    },
    {
      id: 'disposicion',
      title: 'Disposición Final',
      description: 'Control de unidades descartadas y disposición final.',
      icon: <CheckCircle size={32} />,
      color: 'bg-purple-50 text-purple-600',
      hoverColor: 'hover:bg-purple-600 hover:text-white',
      path: '/hemoderivados/disposicion'
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          Volver al Menú Principal
        </button>
        <div className="text-center mb-12">
          <div className="bg-white p-4 rounded-3xl shadow-sm inline-block mb-6">
            <img 
              src="/logo.png" 
              alt="Logo UCI Honda" 
              className="h-16 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-4 tracking-tight">
            Sistema de Gestión de Hemoderivados
          </h1>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Seleccione el módulo al que desea acceder para continuar con la gestión y control de unidades sanguíneas.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <button
            onClick={() => setIsTraceabilityModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-colors shadow-lg"
          >
            <FileText size={20} />
            Exportar Trazabilidad (PDF)
          </button>
          <ExcelExportButton 
            filename="Hemocomponentes"
            collections={[
              { 
                name: 'receivedUnits', 
                label: 'Recepción', 
                sortField: 'createdAt',
                columnMapping: {
                  receptionDate: 'Fecha de Recepción',
                  receptionTime: 'Hora de Recepción',
                  provider: 'Proveedor',
                  hemoderivativeType: 'Tipo de Hemoderivado',
                  unitId: 'ID de Unidad',
                  qualitySeal: 'Sello de Calidad',
                  bloodGroup: 'Grupo Sanguíneo',
                  rh: 'RH',
                  volume: 'Volumen',
                  expirationDate: 'Fecha de Expiración',
                  packagingIntegrity: 'Integridad del Empaque',
                  contentAspect: 'Aspecto del Contenido',
                  temperature: 'Temperatura',
                  observations: 'Observaciones',
                  accepted: 'Aceptado',
                  receiverName: 'Nombre de quien recibe',
                  supervisorName: 'Nombre del supervisor',
                  rejectionReason: 'Motivo de rechazo',
                  actionsTaken: 'Acciones tomadas',
                  reporterName: 'Nombre del reportante',
                  createdAt: 'Fecha de Registro'
                }
              },
              { 
                name: 'bloodTestRecords', 
                label: 'Pre-transfusional', 
                sortField: 'createdAt',
                columnMapping: {
                  patientName: 'Nombre del Paciente',
                  patientId: 'ID del Paciente',
                  eps: 'EPS',
                  age: 'Edad',
                  gender: 'Género',
                  zone: 'Zona',
                  bloodGroup: 'Grupo Sanguíneo',
                  rh: 'RH',
                  testDate: 'Fecha de Prueba',
                  result: 'Resultado',
                  unitId: 'ID de Unidad',
                  unitGroup: 'Grupo de Unidad',
                  unitRh: 'RH de Unidad',
                  unitExpirationDate: 'Fecha Expiración Unidad',
                  irregularAntibodies: 'Anticuerpos Irregulares',
                  autocontrol: 'Autocontrol',
                  temperature: 'Temperatura',
                  provider: 'Proveedor',
                  requestedHemoderivative: 'Hemoderivado Solicitado',
                  requestType: 'Tipo de Solicitud',
                  qualitySeal: 'Sello de Calidad',
                  bacteriologist: 'Bacteriólogo',
                  registryNumber: 'Número de Registro',
                  observations: 'Observaciones',
                  createdAt: 'Fecha de Registro'
                }
              },
              { 
                name: 'transfusionUse', 
                label: 'Uso', 
                sortField: 'createdAt',
                columnMapping: {
                  service: 'Servicio',
                  patientName: 'Nombre del Paciente',
                  patientId: 'ID del Paciente',
                  age: 'Edad',
                  gender: 'Género',
                  hemoderivativeType: 'Tipo de Hemoderivado',
                  bloodGroup: 'Grupo Sanguíneo',
                  rh: 'RH',
                  orderDate: 'Fecha de Orden',
                  orderTime: 'Hora de Orden',
                  transfusionDate: 'Fecha de Transfusión',
                  transfusionTime: 'Hora de Transfusión',
                  opportunity: 'Oportunidad',
                  qualitySeal: 'Sello de Calidad',
                  unitId: 'ID de Unidad',
                  prescriptionFormat: 'Formato de Prescripción',
                  informedConsent: 'Consentimiento Informado',
                  adminChecklist: 'Lista de Chequeo Admin',
                  adverseReaction: 'Reacción Adversa',
                  safetyEvent: 'Evento de Seguridad',
                  reactionDescription: 'Descripción de Reacción',
                  responsibleDoctor: 'Médico Responsable',
                  responsibleNurse: 'Enfermero Responsable',
                  observations: 'Observaciones',
                  createdAt: 'Fecha de Registro'
                }
              },
              { 
                name: 'finalDisposition', 
                label: 'Disposición Final', 
                sortField: 'createdAt',
                columnMapping: {
                  unitId: 'ID de Unidad',
                  qualitySeal: 'Sello de Calidad',
                  dispositionDate: 'Fecha de Disposición',
                  dispositionType: 'Motivo de Disposición',
                  reason: 'Observaciones',
                  responsiblePerson: 'Persona Responsable',
                  observations: 'Notas Adicionales',
                  createdAt: 'Fecha de Registro'
                }
              }
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {modules.map((mod, idx) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => navigate(mod.path)}
              className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors ${mod.color} ${mod.hoverColor}`}>
                {mod.icon}
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2 group-hover:text-zinc-800 transition-colors">
                {mod.title}
              </h2>
              <p className="text-zinc-500 mb-6">
                {mod.description}
              </p>
              <div className="flex items-center text-sm font-bold text-zinc-400 group-hover:text-zinc-900 transition-colors">
                Ingresar al módulo <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 text-center text-sm text-zinc-400">
          © {new Date().getFullYear()} UCI Honda Tecnología. Todos los derechos reservados.
        </div>
      </div>

      <TraceabilityExportModal 
        isOpen={isTraceabilityModalOpen} 
        onClose={() => setIsTraceabilityModalOpen(false)} 
      />
    </div>
  );
};
