import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Droplets, FlaskConical, Package, ArrowRight, Settings, LogOut, LogIn, Lock, ShieldAlert } from 'lucide-react';
import { auth, logout, loginWithUsernameAndPassword, db } from '../firebase';
import { getNowISO } from '../utils/dateUtils';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const MainHome: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [dbUser, setDbUser] = useState<any | null>(null);

  useEffect(() => {
    document.title = 'Apoyo Diagnóstico';
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Record user profile for admin management
        try {
          await setDoc(doc(db, 'user_profiles', u.uid), {
            email: u.email || 'no-email',
            displayName: u.displayName || u.uid,
            photoURL: u.photoURL || '',
            lastLogin: getNowISO(),
            uid: u.uid
          }, { merge: true });
        } catch (e) {
          console.error("Error recording profile:", e);
        }

        const isSuper = u.uid === 'admin' || u.email?.toLowerCase() === "ingbiomedico@ucihonda.com.co";
        if (isSuper) {
          setIsAuthorized(true);
          try {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists()) {
              setDbUser(userDoc.data());
            }
          } catch(err) {
            console.error("Error reading admin data:", err);
          }
          setLoading(false);
        } else {
          // Check if user exists in 'users' collection and is active
          try {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              setDbUser(uData);
              if (uData.active) {
                setIsAuthorized(true);
              } else {
                setIsAuthorized(false);
              }
            } else {
              setIsAuthorized(false);
            }
          } catch (error) {
            console.error("Error checking authorization:", error);
            setIsAuthorized(false);
          }
          setLoading(false);
        }
      } else {
        setDbUser(null);
        setIsAuthorized(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const isSuperAdmin = user?.uid === "admin" || dbUser?.role === "admin" || user?.email?.toLowerCase() === "ingbiomedico@ucihonda.com.co";

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      await loginWithUsernameAndPassword(usernameInput, passwordInput);
    } catch (err: any) {
      console.error("Login submission error:", err);
      setLoginError(err.message || 'Error de inicio de sesión');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 md:p-12 rounded-[3rem] shadow-xl border border-zinc-200 text-center"
        >
          <div className="bg-zinc-50 p-6 rounded-[2.5rem] shadow-sm inline-block mb-8">
            <img 
              src="/logo.png" 
              alt="Logo UCI Honda" 
              className="h-20 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2 tracking-tight">
            Apoyo Diagnóstico
          </h1>
          <p className="text-zinc-500 mb-8 font-medium leading-relaxed">
            UCI Honda - Acceso de Personal Autorizado
          </p>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Usuario</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none transition-all placeholder-zinc-300"
                placeholder="Ingrese su usuario..."
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
                  <LogIn size={20} />
                  Ingresar al Sistema
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-xs text-zinc-400 font-medium uppercase tracking-widest">
            UCI Honda Tecnología
          </p>
        </motion.div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-xl border border-zinc-200 text-center"
        >
          <div className="bg-rose-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 text-rose-600">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-4">Acceso No Autorizado</h1>
          <p className="text-zinc-500 mb-8 font-medium leading-relaxed">
            Su usuario (<span className="text-zinc-900 font-bold">{user.uid}</span>) no tiene permisos activos para acceder al sistema.
          </p>
          <div className="bg-zinc-50 p-4 rounded-2xl mb-8 text-left">
            <p className="text-xs text-zinc-400 font-bold uppercase mb-2">Instrucciones:</p>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Contacte al administrador para habilitar su acceso.
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 text-rose-600 font-bold hover:bg-rose-50 py-3 rounded-xl transition-all"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </motion.div>
      </div>
    );
  }

  const mainModules = [
    {
      id: 'hemoderivados',
      title: 'Hemocomponentes',
      description: 'Sistema de Gestión de Hemoderivados y Trazabilidad.',
      icon: <Droplets size={32} />,
      color: 'bg-red-50 text-red-600',
      hoverColor: 'hover:bg-red-600 hover:text-white',
      path: '/hemoderivados'
    },
    {
      id: 'laboratorio',
      title: 'Laboratorio Clínico',
      description: 'Gestión de registros y resultados de laboratorio clínico.',
      icon: <FlaskConical size={32} />,
      color: 'bg-indigo-50 text-indigo-600',
      hoverColor: 'hover:bg-indigo-600 hover:text-white',
      path: '/laboratorio'
    },
    {
      id: 'insumos',
      title: 'Insumos',
      description: 'Control de inventarios y gestión de insumos de apoyo diagnóstico.',
      icon: <Package size={32} />,
      color: 'bg-amber-50 text-amber-600',
      hoverColor: 'hover:bg-amber-600 hover:text-white',
      path: '/insumos'
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        <div className="flex justify-end gap-4 mb-8">
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/admin/users')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl font-bold hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Settings size={18} />
              Gestión de Usuarios
            </button>
          )}
          {user && (
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-rose-600 rounded-xl font-bold hover:bg-rose-50 transition-all shadow-sm"
            >
              <LogOut size={18} />
              Cerrar Sesión
            </button>
          )}
        </div>

        <div className="text-center mb-16">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm inline-block mb-8">
            <img 
              src="/logo.png" 
              alt="Logo UCI Honda" 
              className="h-24 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-zinc-900 mb-4 tracking-tight">
            Apoyo Diagnóstico
          </h1>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto font-medium">
            UCI Honda - Excelencia en el cuidado crítico
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {mainModules.map((mod, idx) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => navigate(mod.path)}
              className="bg-white rounded-[2rem] p-10 border border-zinc-200 shadow-sm hover:shadow-2xl transition-all cursor-pointer group flex flex-col items-center text-center"
            >
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-colors ${mod.color} ${mod.hoverColor}`}>
                {mod.icon}
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-4 group-hover:text-zinc-800 transition-colors">
                {mod.title}
              </h2>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                {mod.description}
              </p>
              <div className="mt-auto flex items-center text-sm font-bold text-zinc-400 group-hover:text-zinc-900 transition-colors">
                Ingresar <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-24 text-center text-sm text-zinc-400 font-medium">
          © {new Date().getFullYear()} UCI Honda Tecnología. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
};
