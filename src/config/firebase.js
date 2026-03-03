import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  setPersistence
} from 'firebase/auth';

// These public keys ship with the production build so it's safe to keep them in source.
const DEFAULT_FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyCW4d7duq3TtVVmp8E5m_2cmKdQELz7qDU',
  authDomain: 'clc-dev-485413.firebaseapp.com',
  projectId: 'clc-dev-485413',
  appId: '1:649398686474:web:d8833d6b9c9124a3f560f3',
  storageBucket: 'clc-dev-485413.firebasestorage.app',
  messagingSenderId: '649398686474'
});

let appInstance;
let authInstance;

function getConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_CONFIG.projectId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? DEFAULT_FIREBASE_CONFIG.appId,
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ??
      DEFAULT_FIREBASE_CONFIG.messagingSenderId
  };
}

export function getFirebaseApp() {
  if (!appInstance) {
    appInstance = initializeApp(getConfig());
  }
  return appInstance;
}

export function getFirebaseAuth() {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export async function applyAuthPersistence(rememberSession) {
  const auth = getFirebaseAuth();
  const persistence = rememberSession ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
}
