import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "clc-dev-485413";
const DATABASE_ID = process.env.FIREBASE_DATABASE_ID || "clc-dev-db";
const ORGANIZATION_ID = process.env.FIREBASE_ORGANIZATION_ID || "clc-dev";

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID
  });
}

const database = getFirestore(DATABASE_ID);

async function run() {
  const casesRef = database.collection(`organizations/${ORGANIZATION_ID}/cases`);
  const snapshot = await casesRef.get();

  if (snapshot.empty) {
    console.log(`No cases found under organizations/${ORGANIZATION_ID}/cases in database ${DATABASE_ID}.`);
    return;
  }

  console.log(`Cases in organizations/${ORGANIZATION_ID}/cases (${DATABASE_ID}):`);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() ?? {};
    console.log("");
    console.log(`- docId: ${docSnap.id}`);
    console.log(`  caseId: ${data.caseId ?? ""}`);
    console.log(`  practiceName: ${data.practiceName ?? ""}`);
    console.log(`  status: ${data.status ?? ""}`);
    console.log(`  outcome: ${data.outcome ?? ""}`);
    console.log(`  progressLabel: ${data.progressLabel ?? ""}`);

    const [documentsSnap, findingsSnap, requirementsSnap, uploadsSnap] = await Promise.all([
      docSnap.ref.collection("documents").get(),
      docSnap.ref.collection("findings").get(),
      docSnap.ref.collection("requirements").get(),
      docSnap.ref.collection("uploads").get()
    ]);

    console.log(`  documents: ${documentsSnap.size}`);
    console.log(`  findings: ${findingsSnap.size}`);
    console.log(`  requirements: ${requirementsSnap.size}`);
    console.log(`  uploads: ${uploadsSnap.size}`);

    const filenames = documentsSnap.docs
      .map((entry) => entry.data()?.filename ?? entry.id)
      .filter(Boolean)
      .sort();

    if (filenames.length > 0) {
      console.log("  document filenames:");
      filenames.forEach((name) => console.log(`    - ${name}`));
    }

    const findingRows = findingsSnap.docs
      .map((entry) => {
        const finding = entry.data() ?? {};
        return {
          id: entry.id,
          title: finding.title ?? "",
          severity: finding.severity ?? "",
          reviewStatus: finding.reviewStatus ?? finding.review_status ?? ""
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id));

    if (findingRows.length > 0) {
      console.log("  findings detail:");
      findingRows.forEach((finding) => {
        console.log(
          `    - ${finding.id}: severity=${finding.severity || "?"}, reviewStatus=${finding.reviewStatus || "?"}, title=${finding.title || ""}`
        );
      });
    }
  }
}

run().catch((error) => {
  console.error("Case inspection failed:", error);
  const message = String(error?.message || "");
  if (message.includes("invalid_rapt") || message.includes("invalid_grant")) {
    console.error("");
    console.error("Authentication refresh required (ADC token expired).");
    console.error("Run:");
    console.error("  gcloud auth application-default login");
  }
  process.exitCode = 1;
});
