import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  setPersistence
} from 'firebase/auth';

let appInstance;
let authInstance;

function getConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
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
