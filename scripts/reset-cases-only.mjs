import {
  DASHBOARD_CASES,
  ORGANIZATION_ID,
  database,
  deleteDocumentTree,
  seedCaseWorkspace,
  seedDashboardCases
} from "./seed-firestore.mjs";

async function resetCasesTree() {
  const casesCollectionRef = database.collection(`organizations/${ORGANIZATION_ID}/cases`);
  const snapshot = await casesCollectionRef.get();

  for (const docSnap of snapshot.docs) {
    await deleteDocumentTree(docSnap.ref);
  }

  return snapshot.size;
}

async function run() {
  const removedCaseCount = await resetCasesTree();
  console.log(
    removedCaseCount > 0
      ? `Reset complete: deleted ${removedCaseCount} case(s) from organizations/${ORGANIZATION_ID}/cases`
      : `Reset skipped: no cases found under organizations/${ORGANIZATION_ID}/cases`
  );

  await seedDashboardCases();
  for (const row of DASHBOARD_CASES) {
    await seedCaseWorkspace(row.id);
  }

  console.log("Case reset complete: generated demo cases restored.");
}

run().catch((error) => {
  console.error("Case reset failed:", error);
  const message = String(error?.message || "");
  if (message.includes("invalid_rapt") || message.includes("invalid_grant")) {
    console.error("");
    console.error("Authentication refresh required (ADC token expired).");
    console.error("Run:");
    console.error("  gcloud auth application-default login");
    console.error("");
    console.error("Then run reset again:");
    console.error("  npm run seed:db:cases");
  }
  process.exitCode = 1;
});
