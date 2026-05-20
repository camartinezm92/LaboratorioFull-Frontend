import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BloodTestForm } from '../components/BloodTestForm';
import { generateInterpretation } from '../utils/bloodTestUtils';
import { RecordCard } from '../components/RecordCard';
import { BloodTestRecord } from '../types';
import { Droplets, History, Plus, Search, LogIn, LogOut, User as UserIcon, ShieldCheck, X, FileText, Calendar, UserCheck, Activity, AlertTriangle, ArrowLeft, CheckCircle, RotateCcw, Edit2, LayoutGrid, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from '../../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { saveRecord as apiSaveRecord, deleteRecord as apiDeleteRecord } from '../../../lib/api';
import { getNowISO } from '../../../utils/dateUtils';

const HEMO_TYPES = [
  'Globulos Rojos',
  'Plasma Fresco Congelado',
  'Crioprecipitado',
  'Plaquetas (Estándar)',
  'Plaquetas AFERESIS'
];

export const PreTransfusionalApp: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<BloodTestRecord[]>([]);
  const [receivedUnits, setReceivedUnits] = useState<any[]>([]);
  const [transfusionRecords, setTransfusionRecords] = useState<any[]>([]);
  const [dispositionRecords, setDispositionRecords] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BloodTestRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<BloodTestRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  
  const [selectedHemoType, setSelectedHemoType] = useState<string>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const [recordToAccept, setRecordToAccept] = useState<BloodTestRecord | null>(null);
  const [acceptPerson, setAcceptPerson] = useState('');
  const [recordToReturn, setRecordToReturn] = useState<BloodTestRecord | null>(null);
  const [returnComment, setReturnComment] = useState('');

  const [patientToEdit, setPatientToEdit] = useState<{ id: string, name: string } | null>(null);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientId, setNewPatientId] = useState('');

  const [isSystemUnlocked, setIsSystemUnlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    document.title = 'Pre-transfusional - Hemocomponentes';
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        setIsSystemUnlocked(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const normalizedUsername = username.trim().toLowerCase();
    if (
      (normalizedUsername === 'lvaleriano' && password === 'LAB2026*') ||
      (normalizedUsername === 'admin' && password === 'admin') ||
      (user?.email === 'ingbiomedico@ucihonda.com.co')
    ) {
      setIsSystemUnlocked(true);
      if (normalizedUsername === 'admin' || user?.email === 'ingbiomedico@ucihonda.com.co') {
        setIsAdmin(true);
      }
    } else {
      setLoginError('Usuario o contraseña incorrectos.');
    }
  };

  const handleLogout = async () => {
    setIsSystemUnlocked(false);
    await logout();
  };

  useEffect(() => {
    if (!isAuthReady || !user || !isSystemUnlocked) {
      setRecords([]);
      return;
    }

    const path = 'bloodTestRecords';

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

    cleanupOldRecords();

    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BloodTestRecord[];
      setRecords(fetchedRecords);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    const receivedUnitsPath = 'receivedUnits';
    const qReceivedUnits = query(collection(db, receivedUnitsPath), orderBy('createdAt', 'desc'));
    const unsubscribeReceivedUnits = onSnapshot(qReceivedUnits, (snapshot) => {
      const fetchedReceivedUnits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReceivedUnits(fetchedReceivedUnits);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, receivedUnitsPath);
    });

    const transfusionPath = 'transfusionUse';
    const qTransfusion = query(collection(db, transfusionPath));
    const unsubscribeTransfusion = onSnapshot(qTransfusion, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransfusionRecords(fetched);
    });

    const dispositionPath = 'finalDisposition';
    const qDisposition = query(collection(db, dispositionPath));
    const unsubscribeDisposition = onSnapshot(qDisposition, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDispositionRecords(fetched);
    });

    return () => {
      unsubscribe();
      unsubscribeReceivedUnits();
      unsubscribeTransfusion();
      unsubscribeDisposition();
    };
  }, [isAuthReady, user, isSystemUnlocked]);

  const saveRecord = async (recordData: Omit<BloodTestRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>) => {
    if (!user) return;

    const path = 'bloodTestRecords';
    try {
      if (editingRecord?.id) {
        // Update existing record
        const updateData = {
          ...editingRecord,
          ...recordData,
          updatedAt: getNowISO(),
          updatedBy: user.email || user.uid,
        };
        await apiSaveRecord(path, updateData, user.email || 'Desconocido');
      } else {
        // Create new record
        const newRecord = {
          ...recordData,
          status: 'Pendiente',
          uid: user.uid,
          userEmail: user.email || '',
          createdAt: getNowISO(),
        };
        await apiSaveRecord(path, newRecord, user.email || 'Desconocido');
      }

      setEditingRecord(null);
      setShowForm(false);
    } catch (error) {
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleEdit = (record: BloodTestRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleNewRecord = () => {
    setEditingRecord(null);
    setShowForm(true);
  };

  const deleteRecord = (id: string) => {
    setRecordToDelete(id);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    const path = 'bloodTestRecords';
    try {
      await apiDeleteRecord(path, recordToDelete);
      setRecordToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleAccept = async () => {
    if (!recordToAccept || !acceptPerson) return;
    const path = 'bloodTestRecords';
    try {
      const updateData = {
        ...recordToAccept,
        status: 'Disponible',
        acceptedBy: acceptPerson,
        acceptedAt: getNowISO(),
        updatedAt: getNowISO(),
        updatedBy: user?.email || user?.uid,
      };
      await apiSaveRecord(path, updateData, user?.email || 'Desconocido');
      setRecordToAccept(null);
      setAcceptPerson('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleReturn = async () => {
    if (!recordToReturn || !returnComment) return;
    const path = 'bloodTestRecords';
    try {
      const updateData = {
        ...recordToReturn,
        returned: true,
        returnComment: returnComment,
        returnedAt: getNowISO(),
        updatedAt: getNowISO(),
        updatedBy: user?.email || user?.uid,
      };
      await apiSaveRecord(path, updateData, user?.email || 'Desconocido');
      setRecordToReturn(null);
      setReturnComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpdatePatient = async () => {
    if (!patientToEdit || !newPatientName || !newPatientId) return;
    setIsSyncing(true);
    const path = 'bloodTestRecords';
    try {
      // Find all records with matching ID OR matching Name (to be safe with previous registration errors)
      const affectedRecords = records.filter(r => 
        r.patientId === patientToEdit.id || 
        r.patientName.toUpperCase().trim() === patientToEdit.name.toUpperCase().trim()
      );

      // We need to update each document in Firestore
      // Using Promise.all for simplicity
      await Promise.all(affectedRecords.map(record => {
        const updateData = {
          ...record,
          patientName: newPatientName.toUpperCase().trim(),
          patientId: newPatientId.trim(),
          updatedAt: getNowISO(),
          updatedBy: user?.email || user?.uid,
        };
        return apiSaveRecord(path, updateData, user?.email || 'Desconocido');
      }));

      setPatientToEdit(null);
      setNewPatientName('');
      setNewPatientId('');
    } catch (error) {
      console.error('Error updating patient info:', error);
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredRecords = records.filter(r => {
    // Search term filter
    const term = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      (r.patientName && r.patientName.toLowerCase().includes(term)) ||
      (r.patientId && r.patientId.includes(term)) ||
      (r.unitId && r.unitId.toLowerCase().includes(term)) ||
      (r.qualitySeal && r.qualitySeal.toLowerCase().includes(term)) ||
      (r.provider && r.provider.toLowerCase().includes(term)) ||
      (r.requestedHemoderivative && r.requestedHemoderivative.toLowerCase().includes(term)) ||
      (r.requestType && r.requestType.toLowerCase().includes(term))
    );

    // Hemo type filter
    const matchesType = selectedHemoType === 'all' || r.requestedHemoderivative === selectedHemoType;

    // Patient filter from sidebar
    const matchesPatient = !selectedPatientId || r.patientId === selectedPatientId;

    return matchesSearch && matchesType && matchesPatient;
  });

  const getCounts = (type: string) => {
    const typeRecords = type === 'all' 
      ? records 
      : records.filter(r => r.requestedHemoderivative === type);
    
    return typeRecords.length;
  };

  const groupedRecords = filteredRecords.reduce((acc, record) => {
    const patientKey = `${record.patientId || 'unknown'}_${(record.patientName || '').trim().toLowerCase()}_${record.bloodGroup || ''}${record.rh || ''}`;
    
    if (!acc[patientKey]) {
      acc[patientKey] = {
        patientId: record.patientId || 'Desconocido',
        patientName: record.patientName || 'Desconocido',
        bloodGroup: record.bloodGroup || '',
        rh: record.rh || '',
        hemoderivativeGroups: {}
      };
    }

    const hemoType = record.requestedHemoderivative || 'Otro';
    if (!acc[patientKey].hemoderivativeGroups[hemoType]) {
      acc[patientKey].hemoderivativeGroups[hemoType] = [];
    }
    acc[patientKey].hemoderivativeGroups[hemoType].push(record);
    
    return acc;
  }, {} as Record<string, { 
    patientId: string, 
    patientName: string, 
    bloodGroup: string, 
    rh: string, 
    hemoderivativeGroups: Record<string, BloodTestRecord[]> 
  }>);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Droplets className="text-red-600" size={48} />
          <p className="text-zinc-500 font-medium">Cargando Pruebas Cruzadas UCI Honda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-red-100 selection:text-red-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/hemoderivados')}
              className="p-2 mr-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors"
              title="Volver al Menú"
            >
              <ArrowLeft size={24} />
            </button>
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-10 w-auto object-contain hidden md:block"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-200 hidden">
              <Droplets className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Pruebas Cruzadas UCI Honda</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user && isSystemUnlocked ? (
              <>
                <button
                  onClick={showForm ? () => setShowForm(false) : handleNewRecord}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                    showForm 
                    ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' 
                    : 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-100'
                  }`}
                >
                  {showForm ? <History size={18} /> : <Plus size={18} />}
                  {showForm ? 'Ver Historial' : 'Nuevo Registro'}
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : !user ? (
              <button
                onClick={loginWithGoogle}
                className="flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-xl font-medium hover:bg-zinc-50 transition-all shadow-sm"
              >
                <LogIn size={18} />
                Iniciar Sesión
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-xl font-medium hover:bg-zinc-50 transition-all shadow-sm"
              >
                <LogOut size={18} />
                Cancelar
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {!user ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-6">
            <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto">
              <ShieldCheck className="text-red-600" size={40} />
            </div>
            <h2 className="text-3xl font-bold text-zinc-900">Paso 1: Autenticación</h2>
            <p className="text-zinc-500">
              Por favor, asocia tu cuenta de correo institucional para gestionar los registros (crear, editar, eliminar).
            </p>
            <button
              onClick={loginWithGoogle}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <LogIn size={24} />
              Continuar con Google
            </button>
          </div>
        ) : !isSystemUnlocked ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-6">
            <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto">
              <ShieldCheck className="text-red-600" size={40} />
            </div>
            <h2 className="text-3xl font-bold text-zinc-900">Paso 2: Acceso Restringido</h2>
            <p className="text-zinc-500">
              Por favor, ingresa tus credenciales de sistema para acceder a la gestión de hemoderivados.
            </p>
            
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  placeholder="Ingrese su usuario"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  placeholder="Ingrese su contraseña"
                  required
                />
              </div>
              
              {loginError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-3 mt-6"
              >
                <LogIn size={24} />
                Desbloquear Sistema
              </button>
            </form>
            <button onClick={handleLogout} className="text-zinc-500 text-sm hover:text-red-600 transition-colors">
              Cambiar cuenta de Google
            </button>
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
                <BloodTestForm 
                  onSave={saveRecord} 
                  userEmail={user.email || ''}
                  existingRecords={records}
                  isSyncing={isSyncing}
                  receivedUnits={receivedUnits}
                  transfusionRecords={transfusionRecords}
                  dispositionRecords={dispositionRecords}
                  initialData={editingRecord || undefined}
                />
              </motion.div>
            ) : (
              <motion.div
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Records Grid and Sidebar */}
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Sidebar with Patient List */}
                  <aside className="w-full lg:w-72 shrink-0 space-y-6">
                    {/* Hemo Type Categories */}
                    <div className="bg-white rounded-[32px] p-6 border border-zinc-200 shadow-sm sticky top-32">
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                        <LayoutGrid size={16} className="text-red-600" />
                        Tipos de Hemo
                      </h3>
                      
                      <div className="space-y-2">
                        <button
                          onClick={() => setSelectedHemoType('all')}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${
                            selectedHemoType === 'all' 
                            ? 'bg-red-600 text-white shadow-lg shadow-red-100' 
                            : 'text-zinc-600 hover:bg-zinc-50 border border-transparent'
                          }`}
                        >
                          <span className="font-bold text-sm">Todos</span>
                          <span className={`${selectedHemoType === 'all' ? 'text-red-100' : 'text-zinc-400'} text-xs font-bold`}>
                            {records.length}
                          </span>
                        </button>
                        
                        {HEMO_TYPES.map(type => {
                          const count = getCounts(type);
                          if (count === 0 && selectedHemoType !== type) return null;
                          return (
                            <button
                              key={type}
                              onClick={() => setSelectedHemoType(type)}
                              className={`w-full flex flex-col p-4 rounded-2xl border transition-all text-left ${
                                selectedHemoType === type 
                                ? 'bg-red-50 border-red-200 shadow-sm ring-1 ring-red-200' 
                                : 'bg-white border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold text-xs uppercase tracking-tight ${selectedHemoType === type ? 'text-red-700' : 'text-zinc-500'}`}>
                                  {type}
                                </span>
                                <span className={`text-xs font-black ${selectedHemoType === type ? 'text-red-600' : 'text-zinc-400'}`}>
                                  {count}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-8 pt-6 border-t border-zinc-100">
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                          <Users size={16} className="text-red-600" />
                          Pacientes
                        </h3>
                        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
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
                            Object.values(groupedRecords).map(group => (
                              <button
                                key={group.patientId}
                                onClick={() => setSelectedPatientId(group.patientId)}
                                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                  selectedPatientId === group.patientId 
                                  ? 'bg-red-600 text-white shadow-md' 
                                  : 'text-zinc-600 hover:bg-zinc-50'
                                }`}
                              >
                                <div className="truncate">{group.patientName}</div>
                                <div className={`text-[10px] ${selectedPatientId === group.patientId ? 'text-red-100' : 'text-zinc-400'}`}>
                                  ID: {group.patientId}
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-400 py-4 text-center">No hay pacientes</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </aside>

                  {/* Main History Feed */}
                  <div className="flex-1 space-y-8">
                    {/* Search and Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-3xl font-bold text-zinc-900">
                          {selectedHemoType === 'all' ? 'Historial de Pruebas' : selectedHemoType}
                        </h2>
                        <p className="text-zinc-500">
                          {selectedPatientId 
                            ? `Filtrando resultados para el paciente seleccionado.`
                            : `Consulta y gestiona los registros de hemoderivados.`}
                        </p>
                      </div>
                      
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-red-500 transition-colors" size={20} />
                        <input
                          type="text"
                          placeholder="Buscar por paciente o ID..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-12 pr-6 py-3 bg-white border border-zinc-200 rounded-2xl w-full md:w-80 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Records Grid */}
                    {Object.keys(groupedRecords).length > 0 ? (
                      <div className="space-y-10">
                        {Object.entries(groupedRecords).map(([patientKey, group], idx) => (
                          <motion.div
                            key={patientKey}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
                              <div className="flex items-center gap-3">
                                <div className="bg-zinc-100 p-3 rounded-xl">
                                  <UserIcon className="text-zinc-600" size={24} />
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-zinc-900">{group.patientName}</h3>
                                  <p className="text-sm text-zinc-500 font-medium">
                                    ID: {group.patientId} • Grupo: <span className="text-red-600 font-bold">{group.bloodGroup}{group.rh}</span>
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  setPatientToEdit({ id: group.patientId, name: group.patientName });
                                  setNewPatientName(group.patientName);
                                  setNewPatientId(group.patientId);
                                }}
                                className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                title="Editar información del paciente"
                              >
                                <Edit2 size={18} />
                              </button>
                            </div>

                            <div className="space-y-8">
                              {Object.entries(group.hemoderivativeGroups).map(([hemoType, typeRecords]) => (
                                <div key={hemoType} className="space-y-4">
                                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                    <Droplets size={14} className="text-red-500" />
                                    {hemoType} ({typeRecords.length})
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {typeRecords.map((record) => {
                                      const isTransfused = transfusionRecords.some(t => t.unitId === record.unitId || t.qualitySeal === record.qualitySeal) ||
                                                    dispositionRecords.some(d => d.unitId === record.unitId || d.qualitySeal === record.qualitySeal);
                                      
                                      // Global check: Is this unit reserved by ANY other active cross-match?
                                      const isReserved = records.some(r => 
                                        r.id !== record.id && 
                                        (
                                          (r.unitId && (r.unitId === record.unitId || r.unitId === record.qualitySeal)) ||
                                          (r.qualitySeal && (r.qualitySeal === record.unitId || r.qualitySeal === record.qualitySeal))
                                        ) && 
                                        r.acceptedBy && 
                                        !r.returned &&
                                        !isTransfused
                                      );

                                      return (
                                        <RecordCard 
                                          key={record.id || record.createdAt} 
                                          record={record} 
                                          onView={setSelectedRecord}
                                          onDelete={deleteRecord}
                                          onEdit={handleEdit}
                                          onAccept={setRecordToAccept}
                                          onReturn={setRecordToReturn}
                                          currentUserUid={user?.uid}
                                          isAdmin={isAdmin}
                                          isUsed={isTransfused}
                                          isReserved={isReserved}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-dashed border-zinc-200 rounded-3xl">
                        <div className="bg-zinc-50 p-6 rounded-full mb-4">
                          <History size={48} className="text-zinc-300" />
                        </div>
                        <h3 className="text-xl font-semibold text-zinc-900">No hay registros</h3>
                        <p className="text-zinc-500 max-w-xs mx-auto mt-2">
                          {searchTerm || selectedHemoType !== 'all' || selectedPatientId
                            ? 'No se encontraron resultados para los filtros aplicados.' 
                            : 'Comienza creando un nuevo registro de prueba cruzada.'}
                        </p>
                        {!searchTerm && selectedHemoType === 'all' && !selectedPatientId && (
                          <button
                            onClick={() => setShowForm(true)}
                            className="mt-6 text-red-600 font-semibold hover:text-red-700 transition-colors"
                          >
                            Crear primer registro →
                          </button>
                        )}
                        {(selectedHemoType !== 'all' || selectedPatientId) && (
                          <button
                            onClick={() => {
                              setSelectedHemoType('all');
                              setSelectedPatientId(null);
                            }}
                            className="mt-6 text-zinc-600 font-semibold hover:text-zinc-900 transition-colors"
                          >
                            Limpiar filtros
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-[1600px] mx-auto px-6 py-12 border-t border-zinc-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Droplets size={16} className="text-red-600" />
            <span>© 2026 Pruebas Cruzadas UCI Honda - Creado por UCI Honda Tecnología</span>
          </div>
          <div className="flex gap-8">
            <button onClick={() => setShowPrivacy(true)} className="hover:text-zinc-900 transition-colors">Privacidad</button>
            <button onClick={() => setShowTerms(true)} className="hover:text-zinc-900 transition-colors">Términos</button>
            <a href="mailto:auditoriadecalidad@ucihonda.com.co?subject=Soporte%20App%20Pruebas%20Cruzadas%20UCI%20Honda&body=Hola%20equipo%20de%20soporte,%0A%0ANecesito%20ayuda%20con%20la%20aplicación%20de%20Pruebas%20Cruzadas:%0A%0A" className="hover:text-zinc-900 transition-colors">Soporte</a>
          </div>
        </div>
      </footer>

      {/* View Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-100">
                <h3 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                  <FileText className="text-red-600" />
                  Detalles de Prueba Cruzada
                </h3>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 p-4 rounded-2xl">
                    <p className="text-sm text-zinc-500 mb-1">Paciente</p>
                    <p className="font-bold text-zinc-900">{selectedRecord.patientName}</p>
                    <p className="text-sm text-zinc-600">ID: {selectedRecord.patientId}</p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-2xl">
                    <p className="text-sm text-zinc-500 mb-1">Grupo Sanguíneo</p>
                    <p className="font-bold text-red-600 text-xl">{selectedRecord.bloodGroup} {selectedRecord.rh}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1 flex items-center gap-1"><Calendar size={14}/> Fecha de Prueba</p>
                    <p className="font-medium text-zinc-900">{new Date(selectedRecord.testDate).toLocaleString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 mb-1 flex items-center gap-1"><Activity size={14}/> Unidad de Hemoderivado</p>
                    <p className="font-medium text-zinc-900">{selectedRecord.unitId || selectedRecord.hemoderivativeUnit || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1 flex items-center gap-1"><ShieldCheck size={14}/> Proveedor</p>
                    <p className="font-medium text-zinc-900">{selectedRecord.provider || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 mb-1 flex items-center gap-1"><Activity size={14}/> Hemoderivado Solicitado</p>
                    <p className="font-medium text-zinc-900">{selectedRecord.requestedHemoderivative || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 mb-1 flex items-center gap-1"><FileText size={14}/> Tipo de Solicitud</p>
                    <p className="font-medium text-zinc-900">{selectedRecord.requestType || 'N/A'}</p>
                  </div>
                </div>

                <div className="bg-zinc-50 p-4 rounded-2xl">
                  <p className="text-sm text-zinc-500 mb-2">Resultado</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                    selectedRecord.result === 'Compatible' ? 'bg-green-100 text-green-700' : 
                    selectedRecord.result === 'Unidad disponible' ? 'bg-blue-100 text-blue-700' : 
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedRecord.result.toUpperCase()}
                  </span>
                  <div className="mt-3 p-3 bg-white rounded-xl border border-zinc-100 text-sm italic text-zinc-600">
                    {generateInterpretation(selectedRecord)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1 flex items-center gap-1"><ShieldCheck size={14}/> Sello de Calidad</p>
                    <p className="font-medium text-zinc-900">{selectedRecord.qualitySeal || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 mb-1 flex items-center gap-1"><UserCheck size={14}/> Responsable</p>
                    <p className="font-medium text-zinc-900">{selectedRecord.bacteriologist || selectedRecord.responsiblePerson}</p>
                  </div>
                </div>

                {/* Paciente Validación Grid Details */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Droplets size={14} className="text-red-500" />
                    Validación Sangre Paciente (Inmunohematología)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-zinc-200 text-center">
                      <span className="text-[10px] text-zinc-400 font-bold block uppercase">A</span>
                      <span className="text-sm font-black text-zinc-800">{selectedRecord.patientBloodA || '0'}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-zinc-200 text-center">
                      <span className="text-[10px] text-zinc-400 font-bold block uppercase">B</span>
                      <span className="text-sm font-black text-zinc-800">{selectedRecord.patientBloodB || '0'}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-zinc-200 text-center">
                      <span className="text-[10px] text-zinc-400 font-bold block uppercase">AB</span>
                      <span className="text-sm font-black text-zinc-800">{selectedRecord.patientBloodAB || '0'}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-zinc-200 text-center">
                      <span className="text-[10px] text-zinc-400 font-bold block uppercase">D</span>
                      <span className="text-sm font-black text-zinc-800">{selectedRecord.patientBloodD || '+'}</span>
                    </div>
                  </div>
                </div>

                {/* Phase-specific results */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-3">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity size={14} className="text-red-500" />
                    Rastreo de Anticuerpos Irregulares (Por Fases)
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-zinc-200 space-y-1">
                      <span className="font-extrabold text-blue-600 uppercase block tracking-wider">Fase Salina</span>
                      <div className="text-zinc-600 space-y-0.5">
                        <p>Prueba: <strong className="text-zinc-900 font-black">{selectedRecord.salinaPruebaCruzada || '0'}</strong></p>
                        <p>Autocontrol: <strong className="text-zinc-900 font-black">{selectedRecord.salinaAutocontrol || '0'}</strong></p>
                        <p>Temp: <strong className="text-zinc-900 font-black">{selectedRecord.salinaTemperatura || 'TA'}</strong></p>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-zinc-200 space-y-1">
                      <span className="font-extrabold text-amber-600 uppercase block tracking-wider">Fase Incubación</span>
                      <div className="text-zinc-600 space-y-0.5">
                        <p>Prueba: <strong className="text-zinc-900 font-black">{selectedRecord.incubacionPruebaCruzada || '0'}</strong></p>
                        <p>Autocontrol: <strong className="text-zinc-900 font-black">{selectedRecord.incubacionAutocontrol || '0'}</strong></p>
                        <p>Temp: <strong className="text-zinc-900 font-black">{selectedRecord.incubacionTemperatura || '37°C'}</strong></p>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-zinc-200 space-y-1">
                      <span className="font-extrabold text-red-600 uppercase block tracking-wider">Fase Proteica</span>
                      <div className="text-zinc-600 space-y-0.5">
                        <p>Prueba: <strong className="text-zinc-900 font-black">{selectedRecord.proteicaPruebaCruzada || '0'}</strong></p>
                        <p>Autocontrol: <strong className="text-zinc-900 font-black">{selectedRecord.proteicaAutocontrol || '0'}</strong></p>
                        <p>Temp: <strong className="text-zinc-900 font-black">{selectedRecord.proteicaTemperatura || '37°C'}</strong></p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SIHEVI Section */}
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ShieldCheck size={14} />
                    Información SIHEVI
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Reporte SIHEVI</p>
                      <p className={`font-bold ${selectedRecord.siheviReport === 'Sí' ? 'text-green-600' : 'text-zinc-500'}`}>
                        {selectedRecord.siheviReport || 'No reportado'}
                      </p>
                    </div>
                    {selectedRecord.siheviDescription && (
                      <div>
                        <p className="text-sm text-zinc-500 mb-1">Descripción</p>
                        <p className="text-sm text-zinc-900 font-medium">{selectedRecord.siheviDescription}</p>
                      </div>
                    )}
                  </div>
                  {selectedRecord.siheviPredefinedText && (
                    <div className="mt-3 pt-3 border-t border-blue-100">
                      <p className="text-sm text-zinc-500 mb-1">Comentario Preestablecido</p>
                      <p className="text-sm text-blue-900 italic font-medium">"{selectedRecord.siheviPredefinedText}"</p>
                    </div>
                  )}
                </div>
                
                {/* Acceptance and Return Info */}
                {(selectedRecord.acceptedBy || selectedRecord.returned) && (
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Estado de la Unidad</h4>
                    <div className="space-y-3">
                      {selectedRecord.acceptedBy && (
                        <div className="flex justify-between py-2 border-b border-zinc-200/50">
                          <span className="text-zinc-500">Aceptada por:</span>
                          <div className="text-right">
                            <span className="font-bold text-emerald-600 block">{selectedRecord.acceptedBy}</span>
                            {selectedRecord.acceptedAt && (
                              <span className="text-xs text-zinc-400">{new Date(selectedRecord.acceptedAt).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedRecord.returned && (
                        <div className="flex justify-between py-2 border-b border-zinc-200/50">
                          <span className="text-zinc-500">Devuelta:</span>
                          <div className="text-right">
                            <span className="font-bold text-orange-600 block">Sí</span>
                            {selectedRecord.returnedAt && (
                              <span className="text-xs text-zinc-400">{new Date(selectedRecord.returnedAt).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedRecord.returnComment && (
                        <div className="pt-2">
                          <span className="text-zinc-500 block mb-1">Comentario de devolución:</span>
                          <span className="text-sm text-zinc-700 italic">"{selectedRecord.returnComment}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accept Modal */}
      <AnimatePresence>
        {recordToAccept && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4 text-emerald-600">
                <div className="bg-emerald-50 p-3 rounded-full">
                  <CheckCircle size={24} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">Aceptar Hemocomponente</h3>
              </div>
              <p className="text-zinc-600 mb-6">
                Seleccione la persona que acepta la unidad <strong>{recordToAccept.unitId || recordToAccept.hemoderivativeUnit}</strong>.
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Persona que recibe</label>
                <select
                  value={acceptPerson}
                  onChange={(e) => setAcceptPerson(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Seleccione...</option>
                  <option value="Andrés Fernando Villegas Quintero">Andrés Fernando Villegas Quintero</option>
                  <option value="Carmenza Suarez Martinez">Carmenza Suarez Martinez</option>
                  <option value="Leidy Katherine Rubiano Rico">Leidy Katherine Rubiano Rico</option>
                  <option value="Margie Lizeth Moreno Reyes">Margie Lizeth Moreno Reyes</option>
                  <option value="María Alejandra Figueroa Delgado">María Alejandra Figueroa Delgado</option>
                  <option value="Olivia Lozano Vásquez">Olivia Lozano Vásquez</option>
                  <option value="Silvia María López Ávila">Silvia María López Ávila</option>
                  <option value="Luis Israel Valeriano Rodríguez">Luis Israel Valeriano Rodríguez</option>
                  <option value="Omadis Emelda Meza González">Omadis Emelda Meza González</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setRecordToAccept(null); setAcceptPerson(''); }}
                  className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-semibold hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAccept}
                  disabled={!acceptPerson}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Aceptar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <AnimatePresence>
        {recordToReturn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4 text-orange-600">
                <div className="bg-orange-50 p-3 rounded-full">
                  <RotateCcw size={24} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">Devolver Hemocomponente</h3>
              </div>
              <p className="text-zinc-600 mb-6">
                ¿Está seguro que desea devolver la unidad <strong>{recordToReturn.unitId || recordToReturn.hemoderivativeUnit}</strong>? Esto la liberará para nuevas pruebas.
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Comentario de devolución</label>
                <textarea
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none"
                  rows={3}
                  placeholder="Especifique el motivo de la devolución..."
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setRecordToReturn(null); setReturnComment(''); }}
                  className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-semibold hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReturn}
                  disabled={!returnComment}
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {recordToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2 text-center">Confirmar Eliminación</h3>
              <p className="text-zinc-600 mb-6 text-center">¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setRecordToDelete(null)} 
                  className="flex-1 px-4 py-3 text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete} 
                  className="flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Patient Info Edit Modal */}
      <AnimatePresence>
        {patientToEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-3 text-blue-600">
                <div className="bg-blue-50 p-3 rounded-2xl">
                  <UserIcon size={24} />
                </div>
                <h3 className="text-xl font-bold">Editar Información del Paciente</h3>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-4">
                <p className="text-xs text-blue-700 font-medium">
                  <strong>IMPORTANTE:</strong> Al modificar estos datos, se actualizarán <strong>todos los registros</strong> asociados a este paciente en el sistema.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all uppercase"
                    placeholder="Escriba el nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1">Cédula / Documento</label>
                  <input
                    type="text"
                    value={newPatientId}
                    onChange={(e) => setNewPatientId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Numero de identificación"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setPatientToEdit(null)}
                  disabled={isSyncing}
                  className="flex-1 px-4 py-3 text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdatePatient}
                  disabled={isSyncing || !newPatientName || !newPatientId}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold shadow-lg shadow-blue-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSyncing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : <CheckCircle size={18} />}
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Modal */}
      <AnimatePresence>
        {showPrivacy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPrivacy(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-100">
                <h3 className="text-2xl font-bold text-zinc-900">Políticas de Privacidad</h3>
                <button onClick={() => setShowPrivacy(false)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4 text-zinc-600 leading-relaxed">
                <p>
                  <strong>UCI Honda</strong> garantiza la confidencialidad, seguridad y uso adecuado de la información médica y personal registrada en esta aplicación, en estricto cumplimiento de la normativa vigente de protección de datos personales (Ley 1581 de 2012 - Habeas Data).
                </p>
                <p>
                  <strong>1. Uso de la Información:</strong> Los datos ingresados (nombres de pacientes, identificaciones, grupos sanguíneos, resultados de pruebas cruzadas y demás información clínica) son de uso estrictamente interno y están destinados exclusivamente para la gestión pre-transfusional y la seguridad del paciente.
                </p>
                <p>
                  <strong>2. Acceso Restringido:</strong> El acceso a esta plataforma está limitado únicamente a personal médico, de laboratorio y administrativo autorizado por UCI Honda. Todo acceso y modificación de datos queda registrado en el sistema (trazabilidad).
                </p>
                <p>
                  <strong>3. Seguridad:</strong> Se implementan medidas de seguridad técnicas y administrativas para evitar el acceso no autorizado, pérdida, alteración o uso indebido de los datos clínicos.
                </p>
                <p>
                  <strong>4. Contacto:</strong> Para cualquier consulta relacionada con el tratamiento de datos personales, puede contactar al equipo de soporte a través de <em>auditoriadecalidad@ucihonda.com.co</em>.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-end">
                <button onClick={() => setShowPrivacy(false)} className="px-6 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl transition-colors">
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terms Modal */}
      <AnimatePresence>
        {showTerms && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTerms(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-100">
                <h3 className="text-2xl font-bold text-zinc-900">Términos y Condiciones</h3>
                <button onClick={() => setShowTerms(false)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4 text-zinc-600 leading-relaxed">
                <p>
                  Esta aplicación es una herramienta tecnológica de uso interno y exclusivo del personal autorizado de <strong>UCI Honda</strong>. Al acceder y utilizar este sistema, el usuario acepta los siguientes términos:
                </p>
                <p>
                  <strong>1. Responsabilidad de la Información:</strong> El usuario se compromete a ingresar información veraz, precisa y previamente verificada correspondiente a las pruebas de compatibilidad sanguínea (pruebas cruzadas). La exactitud de estos datos es vital para la seguridad del paciente.
                </p>
                <p>
                  <strong>2. Confidencialidad de Credenciales:</strong> Las credenciales de acceso (cuenta de Google institucional) son personales e intransferibles. El usuario es responsable de todas las acciones realizadas bajo su cuenta.
                </p>
                <p>
                  <strong>3. Uso Adecuado:</strong> Los rótulos, reportes en PDF y registros generados por esta plataforma deben utilizarse únicamente para los fines médicos y administrativos establecidos por los protocolos de UCI Honda.
                </p>
                <p>
                  <strong>4. Auditoría:</strong> <em>UCI Honda Tecnología</em> y el departamento de Auditoría de Calidad se reservan el derecho de monitorear y auditar el uso de la plataforma para garantizar el cumplimiento de los protocolos institucionales y la seguridad del paciente.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-end">
                <button onClick={() => setShowTerms(false)} className="px-6 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl transition-colors">
                  Aceptar y Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
