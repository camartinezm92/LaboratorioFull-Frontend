import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, History, LogIn, LogOut, ShieldCheck, Trash2, Plus, Search, LayoutGrid, Users, User as UserIcon, Edit2, AlertTriangle, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UsoForm } from '../components/UsoForm';
import { UsoRecordCard } from '../components/UsoRecordCard';
import { TransfusionUseRecord } from '../types';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from '../../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, where, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { DeleteConfirmationModal } from '../../laboratorio/components/DeleteConfirmationModal';
import { saveRecord as apiSaveRecord, deleteRecord as apiDeleteRecord } from '../../../lib/api';
import { getNowISO } from '../../../utils/dateUtils';

interface PatientCheck {
  id?: string;
  reporteSIHEVI: boolean;
  labsMultitransfundidos: boolean;
  updatedAt: string;
  updatedBy: string;
}

export const UsoApp: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<TransfusionUseRecord[]>([]);
  const [patientChecks, setPatientChecks] = useState<Record<string, PatientCheck>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TransfusionUseRecord | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [isSystemUnlocked, setIsSystemUnlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPermissions, setUserPermissions] = useState<{
    crear: boolean;
    consultar: boolean;
    editar: boolean;
    eliminar: boolean;
  }>({
    crear: true,
    consultar: true,
    editar: true,
    eliminar: true
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Uso - Hemocomponentes';
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsSystemUnlocked(false);
        setIsAdmin(false);
        setIsAuthReady(true);
      } else {
        // Auto-unlock system if current user is active and registered in the database
        try {
          const isSuper = currentUser.uid === 'admin' || currentUser.email?.toLowerCase() === 'ingbiomedico@ucihonda.com.co';
          if (isSuper) {
            setIsAdmin(true);
            setIsSystemUnlocked(true);
            setUserPermissions({
              crear: true,
              consultar: true,
              editar: true,
              eliminar: true
            });
            setIsAuthReady(true);
            return;
          }

          const { getDoc, doc } = await import('firebase/firestore');
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.active) {
              setIsSystemUnlocked(true);
              setIsAdmin(data.role === 'admin');

              // Fallbacks for older individual permissions
              const p = data.permissions || {};
              const hemoPerms = p.hemoderivados || {};
              const usoPerms = p.uso || {};

              setUserPermissions({
                crear: hemoPerms.crear !== undefined ? hemoPerms.crear : (usoPerms.crear !== undefined ? usoPerms.crear : true),
                consultar: hemoPerms.consultar !== undefined ? hemoPerms.consultar : (usoPerms.consultar !== undefined ? usoPerms.consultar : true),
                editar: hemoPerms.editar !== undefined ? hemoPerms.editar : (usoPerms.editar !== undefined ? usoPerms.editar : true),
                eliminar: hemoPerms.eliminar !== undefined ? hemoPerms.eliminar : (usoPerms.eliminar !== undefined ? usoPerms.eliminar : true)
              });
            } else {
              setIsSystemUnlocked(false);
            }
          } else if (currentUser.email?.toLowerCase().endsWith('@ucihonda.com.co')) {
            setIsSystemUnlocked(true);
            setUserPermissions({
              crear: true,
              consultar: true,
              editar: true,
              eliminar: true
            });
          } else {
            setIsSystemUnlocked(false);
          }
        } catch (error) {
          console.error('Error pre-loading permissions:', error);
          setIsSystemUnlocked(false);
        } finally {
          setIsAuthReady(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user || !isSystemUnlocked) return;

    const path = 'transfusionUse';

    // Auto-cleanup: Delete records older than 30 days
    const cleanupOldRecords = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffTimestamp = thirtyDaysAgo.toISOString();

        const cleanupQuery = query(
          collection(db, path),
          where('createdAt', '<', cutoffTimestamp)
        );
        
        const snapshot = await getDocs(cleanupQuery);
        
        if (!snapshot.empty) {
          console.log(`Auto-limpieza: Borrando ${snapshot.size} registros antiguos...`);
          const deletePromises = snapshot.docs.map(docSnapshot => 
            apiDeleteRecord(path, docSnapshot.id)
          );
          await Promise.all(deletePromises);
          console.log('Auto-limpieza completada.');
        }
      } catch (error) {
        console.error('Error en auto-limpieza de registros antiguos:', error);
      }
    };

    if (isAdmin || userPermissions.eliminar) {
      cleanupOldRecords();
    }

    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData: TransfusionUseRecord[] = [];
      snapshot.forEach((doc) => {
        recordsData.push({ id: doc.id, ...doc.data() } as TransfusionUseRecord);
      });
      setRecords(recordsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    // Listen for patient checks
    const checksUnsubscribe = onSnapshot(collection(db, 'usoPatientChecks'), (snapshot) => {
      const checksMap: Record<string, PatientCheck> = {};
      snapshot.forEach((doc) => {
        checksMap[doc.id] = { id: doc.id, ...doc.data() } as PatientCheck;
      });
      setPatientChecks(checksMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'usoPatientChecks');
    });

    return () => {
      unsubscribe();
      checksUnsubscribe();
    };
  }, [isAuthReady, user, isSystemUnlocked]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const normalizedUsername = username.trim().toLowerCase();
    const isSuperAdminEmail = user?.email?.toLowerCase() === 'ingbiomedico@ucihonda.com.co';

    if (
      (normalizedUsername === 'usohemo' && password === 'Usohemo2026*') ||
      (normalizedUsername === 'admin' && password === 'admin') ||
      isSuperAdminEmail
    ) {
      setIsSystemUnlocked(true);
      if (normalizedUsername === 'admin' || isSuperAdminEmail) {
        setIsAdmin(true);
      }
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user.active) {
          setIsSystemUnlocked(true);
          const rootRole = data.user.role === 'admin';
          setIsAdmin(rootRole);

          const p = data.user.permissions || {};
          const hemoPerms = p.hemoderivados || {};
          const usoPerms = p.uso || {};

          setUserPermissions({
            crear: hemoPerms.crear !== undefined ? hemoPerms.crear : (usoPerms.crear !== undefined ? usoPerms.crear : true),
            consultar: hemoPerms.consultar !== undefined ? hemoPerms.consultar : (usoPerms.consultar !== undefined ? usoPerms.consultar : true),
            editar: hemoPerms.editar !== undefined ? hemoPerms.editar : (usoPerms.editar !== undefined ? usoPerms.editar : true),
            eliminar: hemoPerms.eliminar !== undefined ? hemoPerms.eliminar : (usoPerms.eliminar !== undefined ? usoPerms.eliminar : true)
          });
          return;
        }
      }
    } catch (err) {
      console.error("Error on dynamic login in UsoApp:", err);
    }

    setLoginError('Usuario o contraseña incorrectos.');
  };

  const handleSubmit = async (formData: Omit<TransfusionUseRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      if (editingRecord?.id) {
        const updateData = {
          ...editingRecord,
          ...formData,
          updatedAt: getNowISO(),
          updatedBy: user.email || 'Desconocido'
        };
        await apiSaveRecord('transfusionUse', updateData, user.email || 'Desconocido');
        setEditingRecord(null);
      } else {
        const fullRecord = {
          ...formData,
          createdAt: getNowISO(),
          uid: user.uid,
          userEmail: user.email || 'Desconocido'
        };

        await apiSaveRecord('transfusionUse', fullRecord, user.email || 'Desconocido');
      }
      
      setShowForm(false);
    } catch (error) {
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'transfusionUse');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setRecordToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (recordToDelete) {
      try {
        await apiDeleteRecord('transfusionUse', recordToDelete);
        setRecordToDelete(null);
        setShowDeleteConfirm(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `transfusionUse/${recordToDelete}`);
      }
    }
  };

  const handleEdit = (record: TransfusionUseRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleNewRecord = () => {
    setEditingRecord(null);
    setShowForm(true);
  };

  const togglePatientCheck = async (patientId: string, field: 'reporteSIHEVI' | 'labsMultitransfundidos') => {
    if (!user) return;
    const current = patientChecks[patientId] || {
      reporteSIHEVI: false,
      labsMultitransfundidos: false,
      updatedAt: getNowISO(),
      updatedBy: user.email || 'Desconocido'
    };

    const { id, ...dataToSave } = current;
    const updated = {
      ...dataToSave,
      [field]: !current[field],
      updatedAt: getNowISO(),
      updatedBy: user.email || 'Desconocido'
    };

    try {
      await setDoc(doc(db, 'usoPatientChecks', patientId), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `usoPatientChecks/${patientId}`);
    }
  };

  const filteredRecords = records.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      (r.patientName && r.patientName.toLowerCase().includes(term)) ||
      (r.patientId && r.patientId.includes(term)) ||
      (r.unitId && r.unitId.toLowerCase().includes(term)) ||
      (r.qualitySeal && (r.qualitySeal || '').toLowerCase().includes(term))
    );

    const matchesPatient = !selectedPatientId || r.patientId === selectedPatientId;

    return matchesSearch && matchesPatient;
  });

  const groupedRecords = filteredRecords.reduce((acc, record) => {
    const patientKey = `${record.patientId || 'unknown'}_${(record.patientName || '').trim().toLowerCase()}`;
    
    if (!acc[patientKey]) {
      acc[patientKey] = {
        patientId: record.patientId || 'Desconocido',
        patientName: record.patientName || 'Desconocido',
        bloodGroup: record.bloodGroup || '',
        rh: record.rh || '',
        records: []
      };
    }
    acc[patientKey].records.push(record);
    
    return acc;
  }, {} as Record<string, { 
    patientId: string, 
    patientName: string, 
    bloodGroup: string, 
    rh: string, 
    records: TransfusionUseRecord[] 
  }>);

  if (!isAuthReady) return <div className="min-h-screen bg-zinc-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/hemoderivados')} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 transition-colors rounded-xl hover:bg-zinc-100"><ArrowLeft size={24} /></button>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2.5 rounded-xl shadow-sm"><Activity className="text-white" size={24} /></div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 leading-tight">HemoMatch</h1>
                <p className="text-xs font-medium text-zinc-500">Módulo de Uso</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && isSystemUnlocked && (isAdmin || userPermissions.crear || showForm) && (
              <button onClick={showForm ? () => setShowForm(false) : handleNewRecord} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">
                {showForm ? <History size={18} /> : <Plus size={18} />}
                {showForm ? 'Ver Historial' : 'Nuevo Registro'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {!user ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-6">
            <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-red-600 shadow-sm">
              <Lock size={40} />
            </div>
            <h2 className="text-3xl font-bold text-zinc-900">Acceso Restringido</h2>
            <p className="text-zinc-500 leading-relaxed">
              No ha iniciado sesión en el sistema. Por favor ingrese desde la pantalla principal para continuar.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-zinc-900 text-white py-4 rounded-xl font-bold hover:bg-zinc-800 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg"
            >
              Ir a la Pantalla Principal
            </button>
          </div>
        ) : !isSystemUnlocked ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-6">
            <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-red-600 shadow-sm">
              <Lock size={40} />
            </div>
            <h2 className="text-3xl font-bold text-zinc-900">Acceso No Autorizado</h2>
            <p className="text-zinc-500 leading-relaxed">
              Su usuario no tiene los permisos requeridos para gestionar el módulo de Uso. Por favor, contacte a un administrador para activarlos.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => logout()}
                className="flex-1 bg-white border border-zinc-200 text-zinc-600 py-4 rounded-xl font-bold hover:bg-zinc-50 transition-all"
              >
                Cerrar Sesión
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 bg-zinc-900 text-white py-4 rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-md"
              >
                Ir a Inicio
              </button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {showForm ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto"
              >
                <UsoForm 
                  onSubmit={handleSubmit} 
                  isSubmitting={isSyncing} 
                  initialData={editingRecord || undefined} 
                />
              </motion.div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar */}
                <aside className="w-full lg:w-72 shrink-0 space-y-6">
                  <div className="bg-white rounded-[32px] p-6 border border-zinc-200 shadow-sm sticky top-32">
                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                      <Users size={16} className="text-emerald-600" />
                      Pacientes
                    </h3>
                    
                    <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      <button
                        onClick={() => setSelectedPatientId(null)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          selectedPatientId === null 
                          ? 'bg-zinc-900 text-white shadow-md' 
                          : 'text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        Todos los pacientes
                      </button>
                      
                      {Object.values(groupedRecords).length > 0 ? (
                        Object.values(groupedRecords).map(group => {
                          const count = group.records.length;
                          const isHigh = count >= 6;
                          const isWarning = count >= 4 && count < 6;
                          const isSelected = selectedPatientId === group.patientId;

                          return (
                            <button
                              key={group.patientId}
                              onClick={() => setSelectedPatientId(group.patientId)}
                              className={`w-full text-left px-3 py-4 rounded-2xl text-sm font-medium transition-all border relative overflow-hidden ${
                                isSelected 
                                  ? (isHigh ? 'bg-red-100 border-red-300 text-red-900 shadow-sm' : isWarning ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-sm' : 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-sm') 
                                  : (isHigh ? 'bg-red-50 border-red-100 text-red-800 hover:bg-red-100/50' : isWarning ? 'bg-amber-50 border-amber-100 text-amber-800 hover:bg-amber-100/50' : 'bg-white border-transparent text-zinc-600 hover:bg-zinc-50')
                              }`}
                            >
                              <div className="flex justify-between items-start relative z-10">
                                <div className="flex items-center gap-1.5">
                                  {isHigh && <AlertTriangle size={14} className="text-red-600" />}
                                  {isWarning && <AlertTriangle size={14} className="text-amber-600" />}
                                  <div className="truncate max-w-[120px] font-bold">{group.patientName}</div>
                                </div>
                                <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                  isSelected 
                                    ? (isHigh ? 'bg-red-200 text-red-900' : isWarning ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-800') 
                                    : (isHigh ? 'bg-red-100 text-red-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500')
                                }`}>
                                  {count}
                                </div>
                              </div>
                              <div className={`text-[10px] mt-1 font-medium ${
                                isSelected 
                                  ? (isHigh ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-emerald-700') 
                                  : (isHigh ? 'text-red-500/80' : isWarning ? 'text-amber-500/80' : 'text-zinc-400')
                              }`}>
                                ID: {group.patientId}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-zinc-400 py-4 text-center">No hay pacientes</p>
                      )}
                    </div>
                  </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1 space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
                        Historial de Uso
                      </h2>
                      <p className="text-zinc-500">
                        {selectedPatientId 
                          ? `Visualizando bolsas usadas para el paciente seleccionado.`
                          : `Consulta el seguimiento de hemocomponentes transfundidos.`}
                      </p>
                    </div>
                    
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input
                        type="text"
                        placeholder="Buscar por paciente, unidad..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 pr-6 py-3 bg-white border border-zinc-200 rounded-2xl w-full md:w-80 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {Object.keys(groupedRecords).length > 0 ? (
                    <div className="space-y-10">
                      {Object.entries(groupedRecords).map(([patientKey, group], idx) => {
                        const count = group.records.length;
                        const isHigh = count >= 6;
                        const isWarning = count >= 4 && count < 6;

                        return (
                          <motion.div
                            key={patientKey}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`border rounded-[2.5rem] p-8 shadow-sm transition-all ${
                              isHigh ? 'bg-red-50/30 border-red-100' : isWarning ? 'bg-amber-50/30 border-amber-100' : 'bg-white border-zinc-200'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between mb-8 border-b border-zinc-100 pb-6 gap-4">
                              <div className="flex items-center gap-4">
                                <div className={`p-4 rounded-2xl transition-colors ${
                                  isHigh ? 'bg-red-100 text-red-600' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-zinc-100 text-zinc-600'
                                }`}>
                                  {isHigh || isWarning ? <AlertTriangle size={28} /> : <UserIcon size={28} />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-2xl font-black text-zinc-900">{group.patientName}</h3>
                                    {isHigh && <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider animate-pulse">Multitrasnfundido</span>}
                                    {isWarning && <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">Riesgo de Multitransfusion</span>}
                                  </div>
                                  <p className="text-sm text-zinc-500 font-medium mt-1">
                                    Identificación: <span className="text-zinc-900 font-bold">{group.patientId}</span> • Bolsas Usadas: <span className={`font-black ${isHigh ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>{count}</span>
                                  </p>
                                </div>
                              </div>

                              {isHigh && (
                                <div className="flex flex-wrap gap-4 px-6 py-4 bg-red-100/50 rounded-2xl border border-red-200/50">
                                  <div className="flex items-center gap-3">
                                    <input 
                                      type="checkbox" 
                                      id={`sihevi-${group.patientId}`}
                                      checked={patientChecks[group.patientId]?.reporteSIHEVI || false}
                                      onChange={() => togglePatientCheck(group.patientId, 'reporteSIHEVI')}
                                      className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                    />
                                    <label htmlFor={`sihevi-${group.patientId}`} className="text-xs font-bold text-red-900 cursor-pointer select-none">Reporte SIHEVI</label>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <input 
                                      type="checkbox" 
                                      id={`labs-${group.patientId}`}
                                      checked={patientChecks[group.patientId]?.labsMultitransfundidos || false}
                                      onChange={() => togglePatientCheck(group.patientId, 'labsMultitransfundidos')}
                                      className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                    />
                                    <label htmlFor={`labs-${group.patientId}`} className="text-xs font-bold text-red-900 cursor-pointer select-none">Laboratorios Multitransfundidos</label>
                                  </div>
                                </div>
                              )}
                              
                              <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-colors ${
                                isHigh ? 'bg-red-100 border-red-200 text-red-700' : isWarning ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                              }`}>
                                 <Activity size={18} />
                                 <span className="text-sm font-bold">Grupo: {group.bloodGroup}{group.rh}</span>
                              </div>
                            </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {group.records.map((record) => (
                              <UsoRecordCard
                                key={record.id}
                                record={record}
                                onDelete={handleDeleteClick}
                                onEdit={handleEdit}
                                currentUserUid={user?.uid}
                                isAdmin={isAdmin}
                                canEdit={isAdmin || userPermissions.editar}
                                canDelete={isAdmin || userPermissions.eliminar}
                              />
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                    </div>
                  ) : (
                    <div className="bg-white border border-dashed border-zinc-200 rounded-[32px] p-20 text-center">
                      <History className="mx-auto text-zinc-200 mb-4" size={64} />
                      <h3 className="text-xl font-bold text-zinc-900 mb-2">No se encontraron registros</h3>
                      <p className="text-zinc-500">Intenta ajustar los criterios de búsqueda o selecciona otro paciente.</p>
                      {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="mt-4 text-emerald-600 font-bold hover:underline">Limpiar búsqueda</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </AnimatePresence>
        )}
      </main>

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setRecordToDelete(null);
        }}
        onConfirm={confirmDelete}
        expectedUsername="usohemo"
        expectedPassword="Usohemo2026*"
      />
    </div>
  );
};
