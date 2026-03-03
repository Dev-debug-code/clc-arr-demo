import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseApp } from "../config/firebase.js";

const database = getFirestore(getFirebaseApp(), "clc-dev-db");

export async function upsertUserProfile(user) {
  if (!user) return;

  const organizationId = "clc-dev";

  await setDoc(
    doc(database, "organizations", organizationId, "users", user.uid),
    {
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      role: "inspector",
      status: "active",
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
}
