import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export interface UserPermissions {
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

const SUPER_ADMIN_EMAIL = "ingbiomedico@ucihonda.com.co";

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clear previous doc listener if any
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        const userEmail = user.email?.toLowerCase();
        
        if (user.uid === 'admin' || userEmail === SUPER_ADMIN_EMAIL) {
          setIsAdmin(true);
          setPermissions({
            recepcion: { crear: true, consultar: true, editar: true, eliminar: true, aceptar: true, devolver: true },
            preTransfusional: { crear: true, consultar: true, editar: true, eliminar: true, aceptar: true, devolver: true },
            uso: { crear: true, consultar: true, editar: true, eliminar: true },
            disposicion: { crear: true, consultar: true, editar: true, eliminar: true },
            laboratorio: { crear: true, consultar: true },
            insumos: { crear: true, consultar: true, consumir: true, eliminar: true }
          });
          setLoading(false);
          return;
        }

        unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.active) {
              setIsAdmin(data.role === 'admin');
              setPermissions(data.permissions);
            } else {
              setPermissions(null);
              setIsAdmin(false);
            }
          } else {
            console.log(`No user document found for UID: ${user.uid}`);
            setPermissions(null);
            setIsAdmin(false);
          }
          setLoading(false);
        }, (error) => {
          console.error(`Error fetching user permissions for ${user.email} (${user.uid}):`, error);
          setPermissions(null);
          setIsAdmin(false);
          setLoading(false);
        });
      } else {
        setPermissions(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const hasPermission = (section: keyof UserPermissions, action: string) => {
    if (isAdmin) return true;
    if (!permissions) return false;
    return (permissions[section] as any)?.[action] === true;
  };

  return { permissions, isAdmin, hasPermission, loading };
};
