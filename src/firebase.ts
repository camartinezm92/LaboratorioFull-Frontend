import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocFromServer } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Auth functions
const googleProvider = new GoogleAuthProvider();
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginAnonymously = () => signInAnonymously(auth);
export const logout = () => signOut(auth);

export const loginWithUsernameAndPassword = async (username: string, password: string) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Fallo de autenticación');
  }

  const data = await response.json();
  if (data.firebaseEmail) {
    try {
      // Authenticate the user client-side with standard email and password credentials.
      // This represents the synchronized credential set up securely by the server.
      const userCredential = await signInWithEmailAndPassword(auth, data.firebaseEmail, password);
      return userCredential.user;
    } catch (authErr: any) {
      console.error('Firebase Client Auth Error during login:', authErr);
      const errMsg = authErr?.message || String(authErr);
      
      // Check if the error indicates Identity Toolkit is disabled in GCP
      if (
        errMsg.includes('identitytoolkit') || 
        errMsg.includes('Identity Toolkit API') ||
        errMsg.includes('403') ||
        errMsg.includes('auth/internal-error') ||
        errMsg.includes('PERMISSION_DENIED')
      ) {
        throw new Error(
          'El servicio de Autenticación de Firebase (Identity Toolkit API) no está habilitado en su proyecto de Google Cloud. ' +
          'Para habilitarlo, por favor visite el siguiente enlace e inténtelo de nuevo:\n\n' +
          'Consola Google Cloud (Proyecto: 93016382103):\n' +
          'https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=93016382103\n\n' +
          'O active "Email/Password" en la consola de Firebase Authentication de su proyecto.'
        );
      }
      throw authErr;
    }
  } else {
    throw new Error('No se recibió la información de autenticación desde el servidor');
  }
};

// Error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
