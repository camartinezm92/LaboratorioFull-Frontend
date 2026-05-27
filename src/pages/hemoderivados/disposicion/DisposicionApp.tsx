import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, History, LogIn, ShieldCheck, CheckCircle, Truck, Lock } from 'lucide-react';
import { DisposicionForm } from '../components/DisposicionForm';
import { FinalDispositionRecord } from '../types';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from '../../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { DeleteConfirmationModal } from '../../laboratorio/components/DeleteConfirmationModal';
import { saveRecord as apiSaveRecord, deleteRecord as apiDeleteRecord } from '../../../lib/api';
import { getNowISO, formatColombia } from '../../../utils/dateUtils';

export const DisposicionApp: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<FinalDispositionRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
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
  const [editingRecord, setEditingRecord] = useState<FinalDispositionRecord | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Disposición Final - Hemocomponentes';
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
              const dispPerms = p.disposicion || p.disposicionFinal || {};

              setUserPermissions({
                crear: hemoPerms.crear !== undefined ? hemoPerms.crear : (dispPerms.crear !== undefined ? dispPerms.crear : true),
                consultar: hemoPerms.consultar !== undefined ? hemoPerms.consultar : (dispPerms.consultar !== undefined ? dispPerms.consultar : true),
                editar: hemoPerms.editar !== undefined ? hemoPerms.editar : (dispPerms.editar !== undefined ? dispPerms.editar : true),
                eliminar: hemoPerms.eliminar !== undefined ? hemoPerms.eliminar : (dispPerms.eliminar !== undefined ? dispPerms.eliminar : true)
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

    const path = 'finalDisposition';

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
      const recordsData: FinalDispositionRecord[] = [];
      snapshot.forEach((doc) => {
        recordsData.push({ id: doc.id, ...doc.data() } as FinalDispositionRecord);
      });
      setRecords(recordsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [isAuthReady, user, isSystemUnlocked]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const normalizedUsername = username.trim().toLowerCase();
    const isSuperAdminEmail = user?.email?.toLowerCase() === 'ingbiomedico@ucihonda.com.co';

    if (
      (normalizedUsername === 'disposicionhemo' && password === 'Disposicionhemo2026*') ||
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
          const dispPerms = p.disposicion || p.disposicionFinal || {};

          setUserPermissions({
            crear: hemoPerms.crear !== undefined ? hemoPerms.crear : (dispPerms.crear !== undefined ? dispPerms.crear : true),
            consultar: hemoPerms.consultar !== undefined ? hemoPerms.consultar : (dispPerms.consultar !== undefined ? dispPerms.consultar : true),
            editar: hemoPerms.editar !== undefined ? hemoPerms.editar : (dispPerms.editar !== undefined ? dispPerms.editar : true),
            eliminar: hemoPerms.eliminar !== undefined ? hemoPerms.eliminar : (dispPerms.eliminar !== undefined ? dispPerms.eliminar : true)
          });
          return;
        }
      }
    } catch (err) {
      console.error("Error on dynamic login in DisposicionApp:", err);
    }

    setLoginError('Usuario o contraseña incorrectos.');
  };

  const handleSubmit = async (formData: Omit<FinalDispositionRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      if (editingRecord) {
        const updateData = {
          ...editingRecord,
          ...formData,
          updatedAt: getNowISO(),
          updatedBy: user.email || 'Desconocido'
        };
        await apiSaveRecord('finalDisposition', updateData, user.email || 'Desconocido');
        setEditingRecord(null);
      } else {
        const fullRecord = {
          ...formData,
          createdAt: getNowISO(),
          uid: user.uid,
          userEmail: user.email || 'Desconocido'
        };

        await apiSaveRecord('finalDisposition', fullRecord, user.email || 'Desconocido');
      }
      
      setShowForm(false);
    } catch (error) {
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'finalDisposition');
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
        await apiDeleteRecord('finalDisposition', recordToDelete);
        setRecordToDelete(null);
        setShowDeleteConfirm(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `finalDisposition/${recordToDelete}`);
      }
    }
  };

  const handleEdit = (record: FinalDispositionRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleNewRecord = () => {
    setEditingRecord(null);
    setShowForm(true);
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'Transfundido': return <CheckCircle className="text-emerald-500" size={20} />;
      case 'Descarte': return <Trash2 className="text-rose-500" size={20} />;
      case 'Traslado': return <Truck className="text-blue-500" size={20} />;
      default: return null;
    }
  };

  if (!isAuthReady) return <div className="min-h-screen bg-zinc-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/hemoderivados')} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 transition-colors rounded-xl hover:bg-zinc-100"><ArrowLeft size={24} /></button>
            <div className="flex items-center gap-3">
              <div className="bg-rose-600 p-2.5 rounded-xl shadow-sm"><Trash2 className="text-white" size={24} /></div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 leading-tight">HemoMatch</h1>
                <p className="text-xs font-medium text-zinc-500">Módulo de Disposición</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && isSystemUnlocked && (isAdmin || userPermissions.crear || showForm) && (
              <button onClick={showForm ? () => setShowForm(false) : handleNewRecord} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-all shadow-md shadow-rose-100">
                {showForm ? <History size={18} /> : <Trash2 size={18} />}
                {showForm ? 'Ver Historial' : 'Nuevo Registro'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
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
              Su usuario no tiene los permisos requeridos para gestionar el módulo de Disposición Final. Por favor, contacte a un administrador para activarlos.
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
          <>
            {showForm ? (
              <div className="max-w-4xl mx-auto"><DisposicionForm onSubmit={handleSubmit} isSubmitting={isSyncing} initialData={editingRecord || undefined} /></div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-zinc-900">Historial de Disposición</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {records.map((record) => (
                    <div key={record.id} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-4 relative group">
                      {(isAdmin || userPermissions.editar || userPermissions.eliminar) && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          {(isAdmin || userPermissions.editar) && (
                            <button
                              onClick={() => handleEdit(record)}
                              className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                              title="Editar registro"
                            >
                              <History size={18} />
                            </button>
                          )}
                          {(isAdmin || userPermissions.eliminar) && (
                            <button
                              onClick={() => record.id && handleDeleteClick(record.id)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                              title="Eliminar registro"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-start pr-10">
                        <div className="bg-zinc-50 text-zinc-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Unidad: {record.unitId}</div>
                        <span className="text-xs text-zinc-400">{formatColombia(record.createdAt)}</span>
                      </div>
                      {record.qualitySeal && (
                        <div className="bg-zinc-50 px-3 py-1 rounded-full text-xs font-medium text-zinc-600 inline-block">
                          Sello: {record.qualitySeal}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        {getStatusIcon(record.dispositionType)}
                        <h3 className="font-bold text-zinc-900">
                          <span className="text-zinc-400 font-medium text-[10px] uppercase tracking-wider block">Motivo de Disposición</span>
                          {record.dispositionType}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-500"><span className="font-bold">Fecha:</span> {record.dispositionDate}</p>
                        <p className="text-xs text-zinc-500"><span className="font-bold">Responsable:</span> {record.responsiblePerson}</p>
                        {record.reason && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Observaciones:</span>
                            <p className="text-xs text-zinc-500 bg-zinc-50 p-2 rounded-lg italic">"{record.reason}"</p>
                          </div>
                        )}
                        {record.observations && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Notas Adicionales:</span>
                            <p className="text-xs text-zinc-500 bg-zinc-50 p-2 rounded-lg italic">"{record.observations}"</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <p className="text-[11px] text-zinc-500 font-medium leading-relaxed text-justify">
                          Segregado como residuo anatomopatologico se deja en refrigeracion (2 a 8 °) hasta recepcion por parte de proveedor para manejo final.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setRecordToDelete(null);
        }}
        onConfirm={confirmDelete}
        expectedUsername="disposicionhemo"
        expectedPassword="Disposicionhemo2026*"
      />
    </div>
  );
};
