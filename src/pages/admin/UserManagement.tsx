import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Shield, 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Droplets,
  FlaskConical,
  Package,
  Lock,
  Unlock
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType, loginWithUsernameAndPassword } from '../../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  query,
  orderBy,
  getDoc
} from 'firebase/firestore';

interface UserPermissions {
  recepcion: {
    crear: boolean;
    consultar: boolean;
    editar: boolean;
    eliminar: boolean;
    aceptar: boolean;
    devolver: boolean;
  };
  preTransfusional: {
    crear: boolean;
    consultar: boolean;
    editar: boolean;
    eliminar: boolean;
    aceptar: boolean;
    devolver: boolean;
  };
  uso: {
    crear: boolean;
    consultar: boolean;
    editar: boolean;
    eliminar: boolean;
  };
  disposicion: {
    crear: boolean;
    consultar: boolean;
    editar: boolean;
    eliminar: boolean;
  };
  laboratorio: {
    crear: boolean;
    consultar: boolean;
  };
  insumos: {
    crear: boolean;
    consultar: boolean;
    consumir: boolean;
    eliminar: boolean;
  };
}

interface AppUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  active: boolean;
  permissions: UserPermissions;
  username?: string;
  password?: string;
}

interface DetectedProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastLogin: string;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  recepcion: {
    crear: false,
    consultar: false,
    editar: false,
    eliminar: false,
    aceptar: false,
    devolver: false,
  },
  preTransfusional: {
    crear: false,
    consultar: false,
    editar: false,
    eliminar: false,
    aceptar: false,
    devolver: false,
  },
  uso: {
    crear: false,
    consultar: false,
    editar: false,
    eliminar: false,
  },
  disposicion: {
    crear: false,
    consultar: false,
    editar: false,
    eliminar: false,
  },
  laboratorio: {
    crear: false,
    consultar: false,
  },
  insumos: {
    crear: false,
    consultar: false,
    consumir: false,
    eliminar: false,
  },
};

const SUPER_ADMIN_EMAIL = "ingbiomedico@ucihonda.com.co";

const sanitizePermissions = (perms: any): UserPermissions => {
  // If user has old unified hemoderivados permissions, we can map/migrate them dynamically
  const oldHemo = perms?.hemoderivados || {};
  
  return {
    recepcion: {
      crear: perms?.recepcion?.crear ?? oldHemo?.crear ?? false,
      consultar: perms?.recepcion?.consultar ?? oldHemo?.consultar ?? false,
      editar: perms?.recepcion?.editar ?? oldHemo?.editar ?? false,
      eliminar: perms?.recepcion?.eliminar ?? oldHemo?.eliminar ?? false,
      aceptar: perms?.recepcion?.aceptar ?? oldHemo?.aceptar ?? false,
      devolver: perms?.recepcion?.devolver ?? oldHemo?.devolver ?? false,
    },
    preTransfusional: {
      crear: perms?.preTransfusional?.crear ?? oldHemo?.crear ?? false,
      consultar: perms?.preTransfusional?.consultar ?? oldHemo?.consultar ?? false,
      editar: perms?.preTransfusional?.editar ?? oldHemo?.editar ?? false,
      eliminar: perms?.preTransfusional?.eliminar ?? oldHemo?.eliminar ?? false,
      aceptar: perms?.preTransfusional?.aceptar ?? oldHemo?.aceptar ?? false,
      devolver: perms?.preTransfusional?.devolver ?? oldHemo?.devolver ?? false,
    },
    uso: {
      crear: perms?.uso?.crear ?? oldHemo?.crear ?? false,
      consultar: perms?.uso?.consultar ?? oldHemo?.consultar ?? false,
      editar: perms?.uso?.editar ?? oldHemo?.editar ?? false,
      eliminar: perms?.uso?.eliminar ?? oldHemo?.eliminar ?? false,
    },
    disposicion: {
      crear: perms?.disposicion?.crear ?? oldHemo?.crear ?? false,
      consultar: perms?.disposicion?.consultar ?? oldHemo?.consultar ?? false,
      editar: perms?.disposicion?.editar ?? oldHemo?.editar ?? false,
      eliminar: perms?.disposicion?.eliminar ?? oldHemo?.eliminar ?? false,
    },
    laboratorio: {
      crear: perms?.laboratorio?.crear ?? false,
      consultar: perms?.laboratorio?.consultar ?? false,
    },
    insumos: {
      crear: perms?.insumos?.crear ?? false,
      consultar: perms?.insumos?.consultar ?? false,
      consumir: perms?.insumos?.consumir ?? false,
      eliminar: perms?.insumos?.eliminar ?? false,
    }
  };
};

export const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [detectedProfiles, setDetectedProfiles] = useState<DetectedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formUid, setFormUid] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'user'>('user');
  const [formActive, setFormActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [deleteConfirmationUser, setDeleteConfirmationUser] = useState<AppUser | null>(null);

  // Re-authentication credentials login form states
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const isSuperEmail = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
        const isSuperUid = user.uid === 'admin';
        if (isSuperEmail || isSuperUid) {
          setIsSuperAdmin(true);
          setLoading(false);
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              if (uData.active && uData.role === 'admin') {
                setIsSuperAdmin(true);
              } else {
                setIsSuperAdmin(false);
              }
            } else {
              setIsSuperAdmin(false);
            }
          } catch (error) {
            console.error("Error reading user role:", error);
            setIsSuperAdmin(false);
          } finally {
            setLoading(false);
          }
        }
      } else {
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleReauthLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await loginWithUsernameAndPassword(usernameInput, passwordInput);
    } catch (err: any) {
      console.error("Re-auth error:", err);
      setLoginError(err.message || 'Fallo de autenticación');
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'users'), orderBy('email'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !isSuperAdmin) return;

    const q = query(collection(db, 'user_profiles'), orderBy('lastLogin', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profiles = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as DetectedProfile[];
      setDetectedProfiles(profiles);
    }, (error) => {
      console.error("Error fetching profiles:", error);
    });

    return () => unsubscribe();
  }, [currentUser, isSuperAdmin]);

  const handleOpenModal = (user?: AppUser) => {
    if (user) {
      setEditingUser(user);
      setFormEmail(user.email);
      setFormUid(user.id);
      setFormRole(user.role);
      setFormActive(user.active);
      setFormPermissions(sanitizePermissions(user.permissions));
      setFormUsername(user.username || '');
      setFormPassword(user.password || '');
    } else {
      setEditingUser(null);
      setFormEmail('');
      setFormUid('');
      setFormRole('user');
      setFormActive(true);
      setFormPermissions(DEFAULT_PERMISSIONS);
      setFormUsername('');
      setFormPassword('');
    }
    setIsModalOpen(true);
  };

  const handleSelectProfile = (profile: DetectedProfile) => {
    setFormEmail(profile.email);
    setFormUid(profile.uid);
    // Suggest default username based on email prefix
    const emailPrefix = profile.email.split('@')[0];
    setFormUsername(emailPrefix);
    setFormPassword('');
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

    try {
      const userData: any = {
        email: formEmail.toLowerCase().trim(),
        role: formRole,
        active: formActive,
        permissions: formPermissions,
        username: formUsername.trim().toLowerCase(),
        password: formPassword.trim(),
      };

      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), userData);
      } else {
        if (!formUid) {
          alert("Debe proporcionar el UID del usuario (disponible en Firebase Auth)");
          return;
        }
        await setDoc(doc(db, 'users', formUid.trim()), userData);
        // Optionally delete profile after adding user
        try {
          await deleteDoc(doc(db, 'user_profiles', formUid.trim()));
        } catch (e) {
          console.error("Error deleting profile:", e);
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingUser ? OperationType.UPDATE : OperationType.CREATE, 'users');
    }
  };

  const handleDeleteUserClick = (user: AppUser) => {
    setDeleteConfirmationUser(user);
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirmationUser || !isSuperAdmin) return;
    try {
      await deleteDoc(doc(db, 'users', deleteConfirmationUser.id));
      setDeleteConfirmationUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  const togglePermission = (section: keyof UserPermissions, action: string) => {
    setFormPermissions(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [action]: !((prev[section] as any)[action])
      }
    }));
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isSuperAdmin && !loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-xl border border-zinc-200 text-center max-w-md w-full space-y-6">
          <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-red-600 shadow-sm">
            <Lock size={40} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">Acceso Restringido</h1>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Inicie sesión con una cuenta de administrador para gestionar los usuarios del sistema.
            </p>
          </div>

          <form onSubmit={handleReauthLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Usuario Administrador</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none transition-all placeholder-zinc-300"
                placeholder="Ingrese el usuario..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Contraseña</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none transition-all placeholder-zinc-300"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="text-sm bg-rose-50 text-rose-600 p-3 rounded-xl border border-rose-100 font-medium text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-4 rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-[0.98] disabled:bg-zinc-400 cursor-pointer text-center"
            >
              {isLoggingIn ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Unlock size={18} />
                  Desbloquear
                </>
              )}
            </button>
          </form>

          <button 
            onClick={() => navigate('/')}
            className="w-full text-zinc-500 hover:text-zinc-950 font-bold py-2 transition-colors text-sm"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-4 transition-colors"
            >
              <ArrowLeft size={20} />
              Volver al Menú
            </button>
            <h1 className="text-4xl font-bold text-zinc-900 tracking-tight flex items-center gap-3">
              <Users className="text-zinc-400" size={36} />
              Gestión de Usuarios
            </h1>
            <p className="text-zinc-500 mt-2 font-medium">
              Administre los accesos y permisos por sección del sistema.
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
          >
            <UserPlus size={20} />
            Nuevo Usuario
          </button>
        </div>

        {/* Detected Users Section */}
        {detectedProfiles.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <Shield className="text-amber-500" size={24} />
              Usuarios Detectados (Pendientes de Autorización)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {detectedProfiles
                .filter(p => !users.some(u => u.id === p.uid))
                .map((profile) => (
                  <motion.button
                    key={profile.uid}
                    whileHover={{ y: -4 }}
                    onClick={() => handleSelectProfile(profile)}
                    className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 overflow-hidden flex-shrink-0 border border-zinc-100">
                      {profile.photoURL ? (
                        <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold">
                          {profile.email.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 truncate">{profile.displayName || 'Usuario Nuevo'}</p>
                      <p className="text-xs text-zinc-500 truncate">{profile.email}</p>
                      <p className="text-[10px] text-zinc-400 mt-1 font-mono truncate">{profile.uid}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-zinc-50 text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white flex items-center justify-center transition-all">
                      <UserPlus size={16} />
                    </div>
                  </motion.button>
                ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-6 border-bottom border-zinc-100 bg-zinc-50/50 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por correo electrónico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Permisos</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900">{user.email}</div>
                      <div className="text-xs text-zinc-400 font-mono mt-1">{user.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.active ? (
                          <CheckCircle className="text-emerald-500" size={18} />
                        ) : (
                          <XCircle className="text-rose-500" size={18} />
                        )}
                        <span className={`text-sm font-medium ${user.active ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {(user.permissions?.recepcion?.consultar || user.permissions?.preTransfusional?.consultar || user.permissions?.uso?.consultar || user.permissions?.disposicion?.consultar) && (
                          <div className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center" title="Hemoderivados">
                            <Droplets size={14} />
                          </div>
                        )}
                        {user.permissions?.laboratorio?.consultar && (
                          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center" title="Laboratorio">
                            <FlaskConical size={14} />
                          </div>
                        )}
                        {user.permissions?.insumos?.consultar && (
                          <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center" title="Insumos">
                            <Package size={14} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUserClick(user)}
                          className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-medium">
                      No se encontraron usuarios que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">
                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                  </h2>
                  <p className="text-zinc-500 text-sm font-medium">Configure el acceso y permisos detallados.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-white rounded-xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-zinc-700">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                      placeholder="ejemplo@ucihonda.com.co"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-zinc-700">UID de Firebase</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingUser}
                      value={formUid}
                      onChange={(e) => setFormUid(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all disabled:bg-zinc-50 disabled:text-zinc-400"
                      placeholder="Pegue el UID desde la consola"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-zinc-700">Rol del Sistema</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as 'admin' | 'user')}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    >
                      <option value="user">Usuario Estándar</option>
                      <option value="admin">Administrador de Sección</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-zinc-700">Estado de Cuenta</label>
                    <div className="flex items-center gap-4 h-[52px]">
                      <button
                        type="button"
                        onClick={() => setFormActive(!formActive)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                          formActive 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}
                      >
                        {formActive ? <Unlock size={18} /> : <Lock size={18} />}
                        {formActive ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 col-span-1">
                    <label className="block text-sm font-bold text-zinc-700">
                      Usuario de Acceso Manual <span className="text-xs font-bold text-red-500">(Requerido)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all placeholder-zinc-300 text-sm"
                      placeholder="Ej. lvaleriano, recepcionhemo..."
                    />
                    <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                      Nombre único para ingresar digitando este usuario y su contraseña de forma manual.
                    </p>
                  </div>

                  <div className="space-y-2 col-span-1">
                    <label className="block text-sm font-bold text-zinc-700">
                      Contraseña de Acceso Manual <span className="text-xs font-bold text-red-500">(Requerido)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all placeholder-zinc-300 text-sm font-mono"
                      placeholder="Ingrese la contraseña"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                      Defina la credencial para el inicio de sesión y el desbloqueo del panel.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                    <Shield className="text-zinc-400" size={20} />
                    Configuración de Permisos
                  </h3>

                  {/* Hemocomponentes */}
                  <div className="bg-red-50/20 rounded-3xl p-6 border border-red-100 space-y-6">
                    <div className="flex items-center gap-3 border-b border-red-100/60 pb-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                        <Droplets size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-red-950">Gestión de Hemocomponentes</h4>
                        <p className="text-xs text-red-700">Especifique los permisos individuales por cada tarjeta/módulo</p>
                      </div>
                    </div>

                    {/* Sub-módulo: Recepción */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-bold text-red-950">1. Recepción de Hemoderivados</h5>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {Object.keys(formPermissions.recepcion).map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => togglePermission('recepcion', action)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              (formPermissions.recepcion as any)[action]
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-zinc-500 border-zinc-200 hover:border-red-300'
                            }`}
                          >
                            {action.charAt(0).toUpperCase() + action.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sub-módulo: Pre-Transfusional */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-bold text-red-950">2. Pruebas Pre-Transfusionales</h5>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {Object.keys(formPermissions.preTransfusional).map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => togglePermission('preTransfusional', action)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              (formPermissions.preTransfusional as any)[action]
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-zinc-500 border-zinc-200 hover:border-red-300'
                            }`}
                          >
                            {action.charAt(0).toUpperCase() + action.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sub-módulo: Uso */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-bold text-red-950">3. Registro de Uso (Transfusión)</h5>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {Object.keys(formPermissions.uso).map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => togglePermission('uso', action)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              (formPermissions.uso as any)[action]
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-zinc-500 border-zinc-200 hover:border-red-300'
                            }`}
                          >
                            {action.charAt(0).toUpperCase() + action.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sub-módulo: Disposición Final */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-bold text-red-950">4. Disposición Final</h5>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {Object.keys(formPermissions.disposicion).map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => togglePermission('disposicion', action)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              (formPermissions.disposicion as any)[action]
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-zinc-500 border-zinc-200 hover:border-red-300'
                            }`}
                          >
                            {action.charAt(0).toUpperCase() + action.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Laboratorio */}
                  <div className="bg-indigo-50/30 rounded-2xl p-6 border border-indigo-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <FlaskConical size={20} />
                      </div>
                      <h4 className="font-bold text-indigo-900">Laboratorio Clínico</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.keys(formPermissions.laboratorio).map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => togglePermission('laboratorio', action)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                            (formPermissions.laboratorio as any)[action]
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-zinc-500 border-zinc-200 hover:border-indigo-300'
                          }`}
                        >
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Insumos */}
                  <div className="bg-amber-50/30 rounded-2xl p-6 border border-amber-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Package size={20} />
                      </div>
                      <h4 className="font-bold text-amber-900">Insumos</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.keys(formPermissions.insumos).map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => togglePermission('insumos', action)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                            (formPermissions.insumos as any)[action]
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-zinc-500 border-zinc-200 hover:border-amber-300'
                          }`}
                        >
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-2 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-white bg-zinc-900 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    <Save size={20} />
                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmationUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmationUser(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-6 text-center"
            >
              <div className="bg-rose-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-rose-600 shadow-sm">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-zinc-900">¿Eliminar Usuario?</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  ¿Está seguro de que desea eliminar al usuario <span className="font-semibold text-zinc-800">{deleteConfirmationUser.email}</span>? 
                  Esta acción desactivará su acceso de forma inmediata.
                </p>
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setDeleteConfirmationUser(null)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 py-4 rounded-xl font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-rose-100"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
