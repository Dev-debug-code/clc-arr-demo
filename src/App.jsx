import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from './config/firebase.js';
import WorkspaceApp from './features/inspection/WorkspaceApp.jsx';
import GuidanceContextPage from './pages/GuidanceContextPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { upsertUserProfile } from './services/userProfile.js';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const appView = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || '';
  }, []);

  const gateConfig = useMemo(() => {
    const heading = import.meta.env.VITE_ACCESS_GATE_HEADING ?? 'CLC Inspection Intelligence';
    const supporting = import.meta.env.VITE_ACCESS_GATE_SUPPORTING ?? '';
    return { heading, supporting };
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        upsertUserProfile(user).catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to upsert user profile', error);
        });
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(getFirebaseAuth());
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to sign out', error);
    }
  }, []);

  if (appView === 'guidance') {
    return <GuidanceContextPage />;
  }

  if (!isAuthReady) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <span className="auth-loading__spinner" />
        <p className="auth-loading__text">Loading workspace...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage gateConfig={gateConfig} />;
  }

  return <WorkspaceApp currentUser={currentUser} onSignOut={handleSignOut} />;
}
