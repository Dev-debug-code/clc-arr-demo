import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase.js';
import { FIRESTORE_DATABASE_ID, ORGANIZATION_ID } from '../config/runtime.js';

const database = getFirestore(getFirebaseApp(), FIRESTORE_DATABASE_ID);

export async function upsertUserProfile(user) {
  if (!user) return;

  const userRef = doc(database, 'organizations', ORGANIZATION_ID, 'users', user.uid);
  const existingUserSnap = await getDoc(userRef);
  if (!existingUserSnap.exists()) {
    return null;
  }

  const existingUser = existingUserSnap.data() ?? {};

  const nextRole = typeof existingUser?.role === 'string' && existingUser.role.trim() ? existingUser.role : 'inspector';
  const nextStatus =
    typeof existingUser?.status === 'string' && existingUser.status.trim() ? existingUser.status : 'active';

  await setDoc(
    userRef,
    {
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      role: nextRole,
      status: nextStatus,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: existingUser?.createdAt ?? serverTimestamp()
    },
    { merge: true }
  );

  return {
    id: user.uid,
    ...existingUser,
    email: user.email ?? '',
    displayName: user.displayName ?? existingUser.displayName ?? '',
    role: nextRole,
    status: nextStatus
  };
}

export async function getUserProfile(userId) {
  const cleanUserId = String(userId || '').trim();
  if (!cleanUserId) return null;

  const userRef = doc(database, 'organizations', ORGANIZATION_ID, 'users', cleanUserId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return null;
  }

  return {
    id: userSnap.id,
    ...(userSnap.data() ?? {})
  };
}
