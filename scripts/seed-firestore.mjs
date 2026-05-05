import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildDemoGeneratedWorkspace } from "./demo-generated-workspace.mjs";
import { suggestClassificationFromFilename } from "../src/features/inspection/helpers.js";
import {
  toPersistedDocumentShape,
  toPersistedFindingShape
} from "../src/services/generatedWorkspacePersistence.js";

export const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "clc-dev-485413";
export const DATABASE_ID = process.env.FIREBASE_DATABASE_ID || "clc-dev-db";
export const ORGANIZATION_ID = process.env.FIREBASE_ORGANIZATION_ID || "clc-dev";
const USER_ID = process.env.FIREBASE_USER_ID || "QUBxigoLNMaGYsi8pbNZrvtSF3A2";
const USER_EMAIL = process.env.FIREBASE_USER_EMAIL || "ace1996@live.co.uk";
const USER_DISPLAY_NAME = process.env.FIREBASE_USER_DISPLAY_NAME || "Alex Carter";
const USER_ROLE = process.env.FIREBASE_USER_ROLE || "inspector";
const SECONDARY_INSPECTOR_ID =
  process.env.FIREBASE_SECONDARY_INSPECTOR_ID || "demo-inspector-sarah";
const SECONDARY_INSPECTOR_EMAIL =
  process.env.FIREBASE_SECONDARY_INSPECTOR_EMAIL || "sarah.chen@example.com";
const SECONDARY_INSPECTOR_NAME =
  process.env.FIREBASE_SECONDARY_INSPECTOR_NAME || "Sarah Chen";
const ADMIN_USER_ID = process.env.FIREBASE_ADMIN_USER_ID || "demo-full-access";
const ADMIN_USER_EMAIL =
  process.env.FIREBASE_ADMIN_USER_EMAIL || "full-access@example.com";
const ADMIN_USER_DISPLAY_NAME =
  process.env.FIREBASE_ADMIN_USER_DISPLAY_NAME || "Full Access";

const argSet = new Set(process.argv.slice(2));
const SHOULD_RESET = argSet.has("--reset") || argSet.has("--fresh");
const RESET_ONLY = argSet.has("--reset-only");

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID
});

export const database = getFirestore(DATABASE_ID);
const now = FieldValue.serverTimestamp();

const MAIN_CASE_ID = "CLC-12458";

const PRIMARY_USER = {
  id: USER_ID,
  email: USER_EMAIL,
  displayName: USER_DISPLAY_NAME,
  role: USER_ROLE
};

const SECONDARY_INSPECTOR = {
  id: SECONDARY_INSPECTOR_ID,
  email: SECONDARY_INSPECTOR_EMAIL,
  displayName: SECONDARY_INSPECTOR_NAME,
  role: "inspector"
};

const FULL_ACCESS_USER = {
  id: ADMIN_USER_ID,
  email: ADMIN_USER_EMAIL,
  displayName: ADMIN_USER_DISPLAY_NAME,
  role: "admin"
};

const SEEDED_USERS = [PRIMARY_USER, SECONDARY_INSPECTOR, FULL_ACCESS_USER];

const DEFAULT_FOCUS_AREAS = ["aml", "complaints", "accounts", "client-care", "undertakings"];

const MAIN_CASE_PARTIES = [
  { name: "Amira Khan", role: "Buyer" },
  { name: "Northbank plc", role: "Lender" },
  { name: "Saeed Khan", role: "Giftor" }
];

const SECONDARY_CASE_PARTIES = [
  { name: "Leo Webb", role: "Buyer" },
  { name: "Harper Estates Ltd", role: "Seller" }
];

const HIGH_RISK_CASE_PARTIES = [
  { name: "Priya Singh", role: "Buyer" },
  { name: "Apex Funding Ltd", role: "Lender" }
];

function buildAssignedInspectorFields(user) {
  return {
    owner: user.displayName,
    ownerEmail: user.email,
    inspector: user.displayName,
    inspectorUserId: user.id,
    inspectorEmail: user.email,
    assignedInspectorName: user.displayName,
    assignedInspectorUserId: user.id,
    assignedInspectorEmail: user.email
  };
}

export const DASHBOARD_CASES = [
  {
    id: MAIN_CASE_ID,
    seedUploads: [
      "01_Client_ID_Verification.pdf",
      "03_Client_Risk_Assessment.pdf",
      "05_Bank_Statements_Client.pdf"
    ],
    data: {
      caseId: MAIN_CASE_ID,
      practiceName: "Example Conveyancing Co Ltd",
      licenceNumber: MAIN_CASE_ID,
      ...buildAssignedInspectorFields(PRIMARY_USER),
      status: "active",
      outcome: "in_progress",
      riskLevel: "Medium",
      transactionType: "purchase",
      actingForLender: true,
      amlTier: "enhanced",
      started: "12 Feb 2026",
      previousInspection: "March 2023",
      focusAreas: DEFAULT_FOCUS_AREAS,
      preInspectionConcerns: "Seeded demo case aligned to the canned evidence set.",
      knownParties: MAIN_CASE_PARTIES,
      processing_status: "complete",
      has_unprocessed_changes: true,
      unprocessed_summary: "2 new documents, 1 note added",
      hasUnprocessedChanges: true,
      unprocessedSummary: "2 new documents, 1 note added",
      progress: 66,
      progressLabel: "0/3 requirements reviewed",
      unreviewed: 7,
      leads: 3,
      goodPractice: 1,
      lastActivity: "2 hours ago",
      createdByUserId: PRIMARY_USER.id,
      createdByName: PRIMARY_USER.displayName,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      holp: "Sarah Chen",
      hofa: "James Wright"
    }
  },
  {
    id: "CLC-09821",
    seedUploads: [
      "02_Proof_of_Address.pdf",
      "04_Source_of_Funds_Declaration.pdf",
      "06_Gift_Letter.pdf",
      "07_Giftor_ID_Verification.pdf",
      "09_Sanctions_Screening.pdf",
      "10_PEP_Screening.pdf"
    ],
    data: {
      caseId: "CLC-09821",
      practiceName: "Example Conveyancing Co Ltd - Completed",
      licenceNumber: "CLC-09821",
      ...buildAssignedInspectorFields(PRIMARY_USER),
      status: "completed",
      outcome: "compliant",
      riskLevel: "Low",
      transactionType: "sale",
      actingForLender: false,
      amlTier: "standard",
      started: "3 Feb 2026",
      previousInspection: "Jan 2024",
      focusAreas: ["complaints", "client-care", "accounts"],
      preInspectionConcerns: "Completed seeded case with low-risk supporting documents.",
      knownParties: SECONDARY_CASE_PARTIES,
      processing_status: "complete",
      has_unprocessed_changes: false,
      unprocessed_summary: "",
      progress: 100,
      progressLabel: "0/0 requirements reviewed",
      unreviewed: 0,
      leads: 0,
      goodPractice: 2,
      lastActivity: "3 days ago",
      createdByUserId: PRIMARY_USER.id,
      createdByName: PRIMARY_USER.displayName,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now
    }
  },
  {
    id: "CLC-15502",
    seedUploads: [
      "05_Bank_Statements_Client.pdf",
      "10_PEP_Screening.pdf"
    ],
    data: {
      caseId: "CLC-15502",
      practiceName: "Example Conveyancing Co Ltd - Review",
      licenceNumber: "CLC-15502",
      ...buildAssignedInspectorFields(SECONDARY_INSPECTOR),
      status: "active",
      outcome: "generally_compliant",
      riskLevel: "High",
      transactionType: "remortgage",
      actingForLender: true,
      amlTier: "enhanced",
      started: "10 Feb 2026",
      previousInspection: "N/A",
      focusAreas: ["aml", "management", "accounts"],
      preInspectionConcerns: "Seeded review case with one unresolved warning and one good practice item.",
      knownParties: HIGH_RISK_CASE_PARTIES,
      processing_status: "classified",
      has_unprocessed_changes: true,
      unprocessed_summary: "1 document awaiting extraction",
      progress: 43,
      progressLabel: "0/1 requirements reviewed",
      unreviewed: 8,
      leads: 1,
      goodPractice: 0,
      lastActivity: "15 minutes ago",
      createdByUserId: SECONDARY_INSPECTOR.id,
      createdByName: SECONDARY_INSPECTOR.displayName,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now
    }
  }
];

function buildSeedUpload(filename, index = 0) {
  const classification = suggestClassificationFromFilename(filename);
  return {
    id: `up${index + 1}`,
    name: filename,
    filename,
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification,
    classification_confidence: classification === "Other" ? null : 0.98,
    processing_path: "frontend_demo_seed",
    features_found: [],
    models_agree: classification !== "Other",
    parties: "Firm",
    confidence: classification === "Other" ? "low" : "high",
    summary: "Seeded from the shared canned PDF dataset."
  };
}

function buildWorkspaceForCase(row) {
  const uploads = (Array.isArray(row?.seedUploads) ? row.seedUploads : []).map((filename, index) =>
    buildSeedUpload(filename, index)
  );
  const workspace = buildDemoGeneratedWorkspace(uploads);
  return { uploads, workspace };
}

function countFindingsBySeverity(findings = []) {
  return findings.reduce(
    (counts, finding) => {
      const severity = String(finding?.severity || "").trim().toLowerCase();
      if (severity === "critical") counts.critical += 1;
      else if (severity === "warning") counts.warning += 1;
      else if (severity === "best_practice") counts.bestPractice += 1;
      else if (severity === "pass") counts.pass += 1;
      return counts;
    },
    { critical: 0, warning: 0, bestPractice: 0, pass: 0 }
  );
}

function hasReviewedDecision(finding) {
  const reviewStatus = String(finding?.reviewStatus || finding?.review_status || "").trim().toLowerCase();
  return ["accepted", "confirmed", "rejected", "dismissed"].includes(reviewStatus);
}

function buildSeededWorkspace(row) {
  const baseWorkspace = buildWorkspaceForCase(row).workspace;
  const findings = Array.isArray(baseWorkspace?.findings)
    ? baseWorkspace.findings.map((finding) => {
        const existingReviewStatus = String(finding?.reviewStatus || finding?.review_status || "").trim().toLowerCase();
        const normalizedSeverity = String(finding?.severity || "").trim().toLowerCase();
        const isUnreviewedSeedState = !existingReviewStatus || existingReviewStatus === "unreviewed";

        let reviewStatus = existingReviewStatus || "unreviewed";
        if (row?.data?.status === "completed") {
          reviewStatus = isUnreviewedSeedState ? "accepted" : existingReviewStatus;
        } else if (normalizedSeverity === "best_practice" || normalizedSeverity === "pass") {
          reviewStatus = isUnreviewedSeedState ? "accepted" : existingReviewStatus;
        }

        return {
          ...finding,
          reviewStatus
        };
      })
    : [];

  return {
    ...baseWorkspace,
    findings
  };
}

function buildDashboardCaseData(row, workspace) {
  const requirements = Array.isArray(workspace?.requirements) ? workspace.requirements : [];
  const findings = Array.isArray(workspace?.findings) ? workspace.findings : [];
  const counts = countFindingsBySeverity(findings);
  const findingsByRequirement = new Map();
  findings.forEach((finding) => {
    const requirementId = String(finding?.requirementId || "").trim();
    if (!requirementId) return;
    const rows = findingsByRequirement.get(requirementId) ?? [];
    rows.push(finding);
    findingsByRequirement.set(requirementId, rows);
  });

  const reviewedCount = requirements.reduce((count, requirement) => {
    const relatedFindings = findingsByRequirement.get(String(requirement?.id || "").trim()) ?? [];
    if (relatedFindings.length === 0) return count;
    return relatedFindings.every(hasReviewedDecision) ? count + 1 : count;
  }, 0);
  const totalCount = requirements.length;

  return {
    ...row.data,
    outcome:
      row?.data?.status === "completed"
        ? counts.critical > 0
          ? "non_compliant"
          : counts.warning > 0
            ? "generally_compliant"
            : "compliant"
        : row.data.outcome,
    progress: totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 100,
    progressLabel: totalCount > 0 ? `${reviewedCount}/${totalCount} requirements reviewed` : "No requirements generated",
    unreviewed: findings.filter((finding) => !hasReviewedDecision(finding)).length,
    leads: counts.warning,
    goodPractice: counts.bestPractice,
    processing_status: findings.length > 0 ? "complete" : "classified",
    has_unprocessed_changes: false,
    unprocessed_summary: "",
    hasUnprocessedChanges: false,
    unprocessedSummary: ""
  };
}

function buildReportArtifacts(workspace) {
  const findings = Array.isArray(workspace?.findings) ? workspace.findings : [];
  const byArea = new Map();
  findings.forEach((finding) => {
    const area = String(finding?.codeArea || "aml").trim() || "aml";
    const lines = byArea.get(area) ?? [];
    const detail = String(finding?.detail || finding?.title || "Finding").trim();
    if (detail) {
      lines.push(detail);
    }
    byArea.set(area, lines);
  });

  const severityCounts = countFindingsBySeverity(findings);
  const summaryText =
    findings.length > 0
      ? `${severityCounts.critical} non-compliant, ${severityCounts.warning} requires review, ${severityCounts.bestPractice} good practice across ${byArea.size || 1} code area(s).`
      : "No seeded findings are linked to this case.";

  const reportCurrent = {
    executiveSummary: summaryText,
    executive_summary: summaryText,
    overallRating:
      severityCounts.critical > 0
        ? "requires_attention"
        : severityCounts.warning > 0
          ? "review_required"
          : "compliant",
    overall_rating:
      severityCounts.critical > 0
        ? "requires_attention"
        : severityCounts.warning > 0
          ? "review_required"
          : "compliant",
    generated_at: "2026-05-03T12:00:00Z"
  };

  const reportSections = Array.from(byArea.entries()).map(([codeAreaId, lines]) => ({
    id: `section_${codeAreaId}`,
    codeAreaId,
    lines
  }));

  const reportActions = findings
    .filter((finding) => ["critical", "warning"].includes(String(finding?.severity || "").trim().toLowerCase()))
    .slice(0, 4)
    .map((finding, index) => ({
      id: `ra${index + 1}`,
      action: String(finding?.title || "Review finding").trim(),
      codeRef: typeof finding?.reference === "object" ? finding.reference?.section || "" : String(finding?.reference || ""),
      codeArea: String(finding?.codeArea || "AML").trim().toUpperCase() || "AML",
      deadline: "2026-05-31",
      person: "",
      status: "open"
    }));

  return { reportCurrent, reportSections, reportActions };
}

const CASE_WORKSPACE_COLLECTIONS = [
  "documents",
  "requirements",
  "findings",
  "history",
  "events",
  "contextNotes",
  "findingNotes",
  "documentNotes",
  "uploads",
  "observations",
  "reportActions",
  "reportSections",
  "report"
];

async function clearCaseWorkspaceCollections(caseBase) {
  for (const collectionName of CASE_WORKSPACE_COLLECTIONS) {
    await deleteCollectionTree(database.collection(`${caseBase}/${collectionName}`));
  }
}

export async function deleteDocumentTree(documentRef) {
  const subcollections = await documentRef.listCollections();
  for (const subcollection of subcollections) {
    await deleteCollectionTree(subcollection);
  }
  await documentRef.delete();
}

export async function deleteCollectionTree(collectionRef) {
  const snapshot = await collectionRef.get();
  for (const docSnap of snapshot.docs) {
    await deleteDocumentTree(docSnap.ref);
  }
}

export async function resetOrganizationTree() {
  const orgRef = database.doc(`organizations/${ORGANIZATION_ID}`);
  const orgSnapshot = await orgRef.get();
  if (!orgSnapshot.exists) {
    return false;
  }
  await deleteDocumentTree(orgRef);
  return true;
}

export async function seedOrganization() {
  await database.doc(`organizations/${ORGANIZATION_ID}`).set(
    {
      name: "CLC Dev",
      region: "europe-west2",
      createdAt: now,
      updatedAt: now
    },
    { merge: true }
  );

  for (const user of SEEDED_USERS) {
    await database.doc(`organizations/${ORGANIZATION_ID}/users/${user.id}`).set(
      {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now
      },
      { merge: true }
    );
  }
}

export async function seedDashboardCases(workspacesByCaseId = new Map()) {
  const basePath = `organizations/${ORGANIZATION_ID}/cases`;
  for (const row of DASHBOARD_CASES) {
    const workspace = workspacesByCaseId.get(row.id) ?? buildSeededWorkspace(row);
    await database.doc(`${basePath}/${row.id}`).set(buildDashboardCaseData(row, workspace), { merge: true });
  }
}

export async function seedCaseWorkspace(caseRowOrId) {
  const row =
    typeof caseRowOrId === "string"
      ? DASHBOARD_CASES.find((entry) => entry.id === caseRowOrId)
      : caseRowOrId;
  if (!row) {
    throw new Error(`Unknown seed case: ${String(caseRowOrId)}`);
  }

  const caseBase = `organizations/${ORGANIZATION_ID}/cases/${row.id}`;
  const { uploads } = buildWorkspaceForCase(row);
  const workspace = buildSeededWorkspace(row);
  const documents = Array.isArray(workspace?.documents) ? workspace.documents : [];
  const findings = Array.isArray(workspace?.findings) ? workspace.findings : [];
  const requirements = Array.isArray(workspace?.requirements) ? workspace.requirements : [];
  const { reportCurrent, reportSections, reportActions } = buildReportArtifacts(workspace);

  await clearCaseWorkspaceCollections(caseBase);
  await database.doc(caseBase).set(buildDashboardCaseData(row, workspace), { merge: true });

  for (const item of documents) {
    await database.doc(`${caseBase}/documents/${item.id}`).set(
      {
        ...toPersistedDocumentShape(item),
        createdAt: now,
        updatedAt: now
      },
      { merge: true }
    );
  }

  for (const item of uploads) {
    await database.doc(`${caseBase}/uploads/${item.id}`).set(
      {
        ...item,
        interviewees: [],
        createdAt: now,
        updatedAt: now
      },
      { merge: true }
    );
  }

  for (const item of findings) {
    await database.doc(`${caseBase}/findings/${item.id}`).set(
      {
        ...toPersistedFindingShape(item),
        createdAt: now,
        updatedAt: now
      },
      { merge: true }
    );
  }

  for (const item of requirements) {
    await database.doc(`${caseBase}/requirements/${item.codeArea}__${item.id}`).set(
      {
        requirementId: item.id,
        codeArea: item.codeArea,
        label: item.label,
        status: item.status,
        createdAt: now,
        updatedAt: now
      },
      { merge: true }
    );
  }

  await database.doc(`${caseBase}/history/h1`).set(
    {
      timestampLabel: "09:05",
      detail: "Case created from seeded canned PDF workspace",
      actor: "System",
      createdAt: now
    },
    { merge: true }
  );

  await database.doc(`${caseBase}/history/h2`).set(
    {
      timestampLabel: "09:18",
      detail: `Seeded ${findings.length} findings across ${documents.length} document(s)`,
      actor: "System",
      createdAt: now
    },
    { merge: true }
  );

  await database.doc(`${caseBase}/contextNotes/cn1`).set(
    {
      text: row.data.preInspectionConcerns || "Seeded from canned PDF workspace.",
      actor: PRIMARY_USER.displayName,
      actorUserId: PRIMARY_USER.id,
      timestampLabel: "09:20",
      createdAt: now
    },
    { merge: true }
  );

  for (const action of reportActions) {
    await database.doc(`${caseBase}/reportActions/${action.id}`).set(
      {
        ...action,
        createdAt: now,
        updatedAt: now
      },
      { merge: true }
    );
  }

  await database.doc(`${caseBase}/report/current`).set(
    {
      ...reportCurrent,
      updatedAt: now
    },
    { merge: true }
  );

  for (const section of reportSections) {
    await database.doc(`${caseBase}/reportSections/${section.id}`).set(
      {
        sectionId: section.id,
        codeAreaId: section.codeAreaId,
        narrative: section.lines.join("\n"),
        original_narrative: section.lines.join("\n"),
        is_edited: false,
        lines: section.lines,
        updatedAt: now
      },
      { merge: true }
    );
  }

  return { uploads, workspace };
}

export async function run() {
  if (SHOULD_RESET || RESET_ONLY) {
    const removed = await resetOrganizationTree();
    console.log(
      removed
        ? `Reset complete: deleted organizations/${ORGANIZATION_ID}`
        : `Reset skipped: organizations/${ORGANIZATION_ID} did not exist`
    );
  }

  if (RESET_ONLY) {
    return;
  }

  await seedOrganization();
  await seedDashboardCases();
  for (const row of DASHBOARD_CASES) {
    await seedCaseWorkspace(row.id);
  }

  console.log("Seed complete: generated demo cases loaded from the shared canned PDF dataset.");
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  run().catch((error) => {
    console.error("Seed failed:", error);
    const message = String(error?.message || "");
    if (message.includes("invalid_rapt") || message.includes("invalid_grant")) {
      console.error("");
      console.error("Authentication refresh required (ADC token expired).");
      console.error("Run:");
      console.error("  gcloud auth application-default login");
      console.error("");
      console.error("Then run seed again:");
      console.error("  npm run seed:db:fresh");
    }
    process.exitCode = 1;
  });
}
