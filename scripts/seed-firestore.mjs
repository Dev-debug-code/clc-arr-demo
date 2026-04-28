import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "clc-dev-485413";
const DATABASE_ID = process.env.FIREBASE_DATABASE_ID || "clc-dev-db";
const ORGANIZATION_ID = process.env.FIREBASE_ORGANIZATION_ID || "clc-dev";
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

const database = getFirestore(DATABASE_ID);
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

const DASHBOARD_CASES = [
  {
    id: MAIN_CASE_ID,
    data: {
      caseId: MAIN_CASE_ID,
      practiceName: "Hartley & Partners Solicitors",
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
      preInspectionConcerns:
        "Prior inspection flagged AML evidence gaps and complaints website wording drift.",
      knownParties: MAIN_CASE_PARTIES,
      processing_status: "complete",
      has_unprocessed_changes: true,
      unprocessed_summary: "2 new documents, 1 note added",
      hasUnprocessedChanges: true,
      unprocessedSummary: "2 new documents, 1 note added",
      progress: 66,
      progressLabel: "6/9 requirements met",
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
    data: {
      caseId: "CLC-09821",
      practiceName: "Webb Conveyancing Ltd",
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
      preInspectionConcerns: "Routine follow-up inspection with lower inherent AML risk.",
      knownParties: SECONDARY_CASE_PARTIES,
      processing_status: "complete",
      has_unprocessed_changes: false,
      unprocessed_summary: "",
      progress: 100,
      progressLabel: "10/10 requirements met",
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
    data: {
      caseId: "CLC-15502",
      practiceName: "Singh & Co Licensed Conveyancers",
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
      preInspectionConcerns:
        "Enhanced due diligence expected because of higher-risk client profile and lender involvement.",
      knownParties: HIGH_RISK_CASE_PARTIES,
      processing_status: "classified",
      has_unprocessed_changes: true,
      unprocessed_summary: "1 document awaiting extraction",
      progress: 43,
      progressLabel: "3/7 requirements met",
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

const BASELINE_DOCUMENTS = [
  {
    id: "00_Firm_AML_Policy",
    name: "00_Firm_AML_Policy.pdf",
    filename: "00_Firm_AML_Policy.pdf",
    classification: "AML Policy",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification_confidence: 0.98,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["policy_controls", "sar_procedure", "risk_assessment"],
    models_agree: true,
    parties: "Firm",
    confidence: "high",
    summary: "Practice-wide AML policy with controls, escalation and monitoring references.",
    severity: "warning",
    overlayBoxes: [
      {
        id: "CRIT-003",
        bbox: [0.15, 0.24, 0.83, 0.31],
        page: 1,
        pageno: 0,
        category: "Practice-wide risk assessment",
        severity: "critical",
        title: "Practice-wide risk assessment",
        details: "PWRA does not fully reflect current risk factors."
      },
      {
        id: "WARN-AML-001",
        bbox: [0.14, 0.47, 0.82, 0.53],
        page: 2,
        pageno: 1,
        category: "SAR reporting",
        severity: "warning",
        title: "SAR reporting process",
        details: "Internal SAR escalation outcomes are inconsistently captured."
      },
      {
        id: "CRIT-ACC-001",
        bbox: [0.2, 0.58, 0.86, 0.65],
        page: 2,
        pageno: 1,
        category: "Accounts reconciliation",
        severity: "critical",
        title: "Client account reconciliation trail",
        details: "Month-end reconciliation evidence is not consistently linked to matter ledgers."
      },
      {
        id: "GP-UND-001",
        bbox: [0.22, 0.7, 0.88, 0.77],
        page: 2,
        pageno: 1,
        category: "Undertakings process",
        severity: "best_practice",
        title: "Undertakings tracking",
        details: "Owners and due dates are explicitly tracked with escalation reminders."
      }
    ]
  },
  {
    id: "04_Source_of_Funds_Declaration",
    name: "04_Source_of_Funds_Declaration.pdf",
    filename: "04_Source_of_Funds_Declaration.pdf",
    classification: "Source of Funds Declaration",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification_confidence: 0.9,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["sof_narrative", "client_declaration"],
    models_agree: true,
    parties: "Client",
    confidence: "medium",
    summary: "Source of funds declaration and supporting narrative.",
    severity: "warning",
    overlayBoxes: [
      {
        id: "WARN-SOF-001",
        bbox: [0.18, 0.39, 0.86, 0.45],
        page: 1,
        pageno: 0,
        category: "Source of funds",
        severity: "warning",
        title: "Source of funds documentation",
        details: "Narrative detail and corroboration are incomplete."
      }
    ]
  },
  {
    id: "summary_document",
    name: "Website_Screenshot_Complaints.pdf",
    filename: "Website_Screenshot_Complaints.pdf",
    classification: "Website Evidence",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification_confidence: 0.95,
    processing_path: "classify_only",
    features_found: ["website_disclosure", "complaints_wording"],
    models_agree: true,
    parties: "Firm",
    confidence: "high",
    summary: "Current website complaints disclosure screenshot.",
    severity: "warning",
    overlayBoxes: [
      {
        id: "WARN-COMP-001",
        bbox: [0.1, 0.28, 0.88, 0.36],
        page: 1,
        pageno: 0,
        category: "Complaints Code",
        severity: "warning",
        title: "Complaints website disclosure",
        details: "Website wording uses outdated code references."
      },
      {
        id: "CRIT-CC-001",
        bbox: [0.12, 0.52, 0.87, 0.61],
        page: 1,
        pageno: 0,
        category: "Client care disclosures",
        severity: "critical",
        title: "Client care disclosure gap",
        details: "Client-facing disclosure wording omits required escalation contact details."
      }
    ]
  }
];

const BASELINE_FINDINGS = [
  {
    id: "CRIT-003",
    severity: "critical",
    certainty: "finding",
    polarity: "non_compliant",
    is_good_practice: false,
    codeArea: "aml",
    title: "Practice-wide risk assessment is out of date",
    detail: "The PWRA does not fully reflect current risk factors.",
    documentId: "00_Firm_AML_Policy",
    boxId: "CRIT-003",
    source: {
      file: "00_Firm_AML_Policy.pdf",
      page: 1,
      section: "Practice-wide risk assessment",
      text: "The firm-wide risk assessment has not been updated to include emerging channels."
    },
    evidencePassages: [
      {
        id: "CRIT-003-p1",
        document_id: "00_Firm_AML_Policy",
        file: "00_Firm_AML_Policy.pdf",
        page: 1,
        section: "Practice-wide risk assessment",
        text: "The firm-wide risk assessment has not been updated to include emerging channels.",
        box_id: "CRIT-003"
      }
    ],
    reference: "AML Code S3.2.1",
    requirementId: "aml-1",
    evidence_strength: "strong",
    origin: "backend",
    reviewStatus: "unreviewed"
  },
  {
    id: "WARN-AML-001",
    severity: "warning",
    certainty: "lead",
    polarity: "non_compliant",
    is_good_practice: false,
    codeArea: "aml",
    title: "SAR reporting process lacks outcome tracking",
    detail: "Internal SAR escalation outcomes are inconsistently captured in the SAR log.",
    documentId: "00_Firm_AML_Policy",
    boxId: "WARN-AML-001",
    source: {
      file: "00_Firm_AML_Policy.pdf",
      page: 2,
      section: "SAR reporting",
      text: "Suspicious activity reports are escalated, but outcomes are not consistently recorded."
    },
    evidencePassages: [
      {
        id: "WARN-AML-001-p1",
        document_id: "00_Firm_AML_Policy",
        file: "00_Firm_AML_Policy.pdf",
        page: 2,
        section: "SAR reporting",
        text: "Suspicious activity reports are escalated, but outcomes are not consistently recorded.",
        box_id: "WARN-AML-001"
      }
    ],
    reference: "AML Code S3.8.2",
    requirementId: "aml-2",
    evidence_strength: "supported",
    origin: "backend",
    reviewStatus: "unreviewed"
  },
  {
    id: "WARN-SOF-001",
    severity: "warning",
    certainty: "lead",
    polarity: "non_compliant",
    is_good_practice: false,
    codeArea: "aml",
    title: "Source of funds documentation incomplete",
    detail: "In multiple files, source-of-funds narrative and corroboration are incomplete.",
    documentId: "04_Source_of_Funds_Declaration",
    boxId: "WARN-SOF-001",
    source: {
      file: "04_Source_of_Funds_Declaration.pdf",
      page: 1,
      section: "Source of funds",
      text: "Funds declared from savings, but corroboration references are partial."
    },
    evidencePassages: [
      {
        id: "WARN-SOF-001-p1",
        document_id: "04_Source_of_Funds_Declaration",
        file: "04_Source_of_Funds_Declaration.pdf",
        page: 1,
        section: "Source of funds",
        text: "Funds declared from savings, but corroboration references are partial.",
        box_id: "WARN-SOF-001"
      },
      {
        id: "WARN-SOF-001-p2",
        document_id: "00_Firm_AML_Policy",
        file: "00_Firm_AML_Policy.pdf",
        page: 2,
        section: "Enhanced due diligence trigger",
        text: "Enhanced due diligence checks are required where source corroboration remains incomplete.",
        box_id: "WARN-AML-001"
      }
    ],
    reference: "AML Code S4.1.2",
    requirementId: "aml-2",
    evidence_strength: "supported",
    origin: "backend",
    reviewStatus: "unreviewed"
  },
  {
    id: "WARN-COMP-001",
    severity: "warning",
    certainty: "lead",
    polarity: "non_compliant",
    is_good_practice: false,
    codeArea: "complaints",
    title: "Complaints website disclosure needs update",
    detail: "Website content requires updates to align with latest code references.",
    documentId: "summary_document",
    boxId: "WARN-COMP-001",
    source: {
      file: "Website_Screenshot_Complaints.pdf",
      page: 1,
      section: "Complaints section",
      text: "Complaints references do not match the latest code wording."
    },
    evidencePassages: [
      {
        id: "WARN-COMP-001-p1",
        document_id: "summary_document",
        file: "Website_Screenshot_Complaints.pdf",
        page: 1,
        section: "Complaints section",
        text: "Complaints references do not match the latest code wording.",
        box_id: "WARN-COMP-001"
      }
    ],
    reference: "Complaints Code S2.1",
    requirementId: "co-1",
    evidence_strength: "indicative",
    origin: "backend",
    reviewStatus: "unreviewed"
  },
  {
    id: "CRIT-ACC-001",
    severity: "critical",
    certainty: "finding",
    polarity: "non_compliant",
    is_good_practice: false,
    codeArea: "accounts",
    title: "Client account reconciliation trail is incomplete",
    detail: "Month-end reconciliation evidence is not consistently linked to matter ledgers.",
    documentId: "00_Firm_AML_Policy",
    boxId: "CRIT-ACC-001",
    source: {
      file: "00_Firm_AML_Policy.pdf",
      page: 2,
      section: "Accounts reconciliation",
      text: "Reconciliation summary exists but ledger-level cross-reference is missing for sampled matters."
    },
    evidencePassages: [
      {
        id: "CRIT-ACC-001-p1",
        document_id: "00_Firm_AML_Policy",
        file: "00_Firm_AML_Policy.pdf",
        page: 2,
        section: "Accounts reconciliation",
        text: "Reconciliation summary exists but ledger-level cross-reference is missing for sampled matters.",
        box_id: "CRIT-ACC-001"
      }
    ],
    reference: "Accounts Code S5.3",
    requirementId: "ac-2",
    evidence_strength: "strong",
    origin: "backend",
    reviewStatus: "unreviewed"
  },
  {
    id: "CRIT-CC-001",
    severity: "critical",
    certainty: "finding",
    polarity: "non_compliant",
    is_good_practice: false,
    codeArea: "client-care",
    title: "Client care escalation contact is missing",
    detail: "Client-facing disclosure wording omits required escalation contact details.",
    documentId: "summary_document",
    boxId: "CRIT-CC-001",
    source: {
      file: "Website_Screenshot_Complaints.pdf",
      page: 1,
      section: "Client care disclosure",
      text: "Escalation contact details are not visible in the published client-care text."
    },
    evidencePassages: [
      {
        id: "CRIT-CC-001-p1",
        document_id: "summary_document",
        file: "Website_Screenshot_Complaints.pdf",
        page: 1,
        section: "Client care disclosure",
        text: "Escalation contact details are not visible in the published client-care text.",
        box_id: "CRIT-CC-001"
      }
    ],
    reference: "Client Care Code S2.3",
    requirementId: "cc-2",
    evidence_strength: "strong",
    origin: "backend",
    reviewStatus: "unreviewed"
  },
  {
    id: "GP-UND-001",
    severity: "best_practice",
    certainty: "finding",
    polarity: "compliant",
    is_good_practice: true,
    codeArea: "undertakings",
    title: "Undertakings tracking is strong",
    detail: "Undertakings register and deadline tracking are consistently maintained.",
    documentId: "00_Firm_AML_Policy",
    boxId: "GP-UND-001",
    source: {
      file: "00_Firm_AML_Policy.pdf",
      page: 2,
      section: "Undertakings process",
      text: "Owners and due dates are explicitly tracked with escalation reminders."
    },
    evidencePassages: [
      {
        id: "GP-UND-001-p1",
        document_id: "00_Firm_AML_Policy",
        file: "00_Firm_AML_Policy.pdf",
        page: 2,
        section: "Undertakings process",
        text: "Owners and due dates are explicitly tracked with escalation reminders.",
        box_id: "GP-UND-001"
      }
    ],
    reference: "Undertakings Code S1.1",
    requirementId: "un-1",
    evidence_strength: "strong",
    origin: "backend",
    reviewStatus: "unreviewed"
  }
];

const BASELINE_REQUIREMENTS = [
  { id: "aml-1", codeArea: "aml", label: "Practice-wide risk assessment current", status: "non_compliant" },
  { id: "aml-2", codeArea: "aml", label: "Source of funds evidence complete", status: "lead" },
  { id: "aml-3", codeArea: "aml", label: "Ongoing monitoring documented", status: "compliant" },
  { id: "cc-1", codeArea: "client-care", label: "Terms of engagement issued", status: "compliant" },
  { id: "cc-2", codeArea: "client-care", label: "Scope communicated clearly", status: "compliant" },
  { id: "cc-3", codeArea: "client-care", label: "Fees transparency evidence", status: "compliant" },
  { id: "ac-1", codeArea: "accounts", label: "Client account reconciliations", status: "compliant" },
  { id: "ac-2", codeArea: "accounts", label: "Residual balances controls", status: "compliant" },
  { id: "mg-1", codeArea: "management", label: "Supervision process documented", status: "compliant" },
  { id: "mg-2", codeArea: "management", label: "Escalation route clear", status: "compliant" },
  { id: "un-1", codeArea: "undertakings", label: "Undertakings register maintained", status: "good_practice" },
  { id: "co-1", codeArea: "complaints", label: "Complaints process visible to clients", status: "lead_linked" }
];

const BASELINE_UPLOADS = [
  {
    id: "up1",
    name: "00_Firm_AML_Policy.pdf",
    filename: "00_Firm_AML_Policy.pdf",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification: "AML Policy",
    classification_confidence: 0.99,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["policy_controls", "aml_references", "sar_procedure"],
    models_agree: true,
    parties: "Firm",
    confidence: "high",
    summary: "Seeded baseline upload linked to sample case-file evidence."
  },
  {
    id: "up2",
    name: "01_Client_ID_Verification.pdf",
    filename: "01_Client_ID_Verification.pdf",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification: "CDD Records",
    classification_confidence: 0.96,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["passport", "id_check"],
    models_agree: true,
    parties: "Client",
    confidence: "high",
    summary: "Client identification pack and verification evidence."
  },
  {
    id: "up3",
    name: "02_Proof_of_Address.pdf",
    filename: "02_Proof_of_Address.pdf",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification: "CDD Records",
    classification_confidence: 0.95,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["proof_of_address"],
    models_agree: true,
    parties: "Client",
    confidence: "high",
    summary: "Proof of address evidence for the sampled client matter."
  },
  {
    id: "up4",
    name: "03_Client_Risk_Assessment.pdf",
    filename: "03_Client_Risk_Assessment.pdf",
    status: "classified",
    confirmed: false,
    processing_status: "classified",
    classification: "CDD Records",
    classification_confidence: 0.84,
    processing_path: "ocr_then_classify",
    features_found: ["risk_assessment_form"],
    models_agree: true,
    parties: "Client",
    confidence: "medium",
    summary: "Client risk assessment form awaiting final verification."
  },
  {
    id: "up5",
    name: "04_Source_of_Funds_Declaration.pdf",
    filename: "04_Source_of_Funds_Declaration.pdf",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification: "Source of Funds Declaration",
    classification_confidence: 0.91,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["sof_declaration", "funding_narrative"],
    models_agree: true,
    parties: "Client",
    confidence: "medium",
    summary: "Seeded baseline upload linked to sample source-of-funds evidence."
  },
  {
    id: "up6",
    name: "05_Bank_Statements_Client.pdf",
    filename: "05_Bank_Statements_Client.pdf",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification: "Bank Statement",
    classification_confidence: 0.97,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["statement_header", "transactions"],
    models_agree: true,
    parties: "Client",
    confidence: "high",
    summary: "Bank statement pack used to corroborate source-of-funds activity."
  },
  {
    id: "up7",
    name: "06_Gift_Letter.pdf",
    filename: "06_Gift_Letter.pdf",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification: "Other",
    classification_confidence: 0.76,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["gift_letter"],
    models_agree: false,
    parties: "Giftor, Client",
    confidence: "medium",
    summary: "Gift letter supporting third-party contribution to transaction funding."
  },
  {
    id: "up8",
    name: "07_Giftor_ID_Verification.pdf",
    filename: "07_Giftor_ID_Verification.pdf",
    status: "verified",
    confirmed: true,
    processing_status: "complete",
    classification: "CDD Records",
    classification_confidence: 0.92,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["giftor_id"],
    models_agree: true,
    parties: "Giftor",
    confidence: "medium",
    summary: "Giftor identity verification evidence linked to the gift letter."
  },
  {
    id: "up9",
    name: "08_Giftor_Source_of_Funds.pdf",
    filename: "08_Giftor_Source_of_Funds.pdf",
    status: "attention",
    confirmed: false,
    processing_status: "failed_partial",
    classification: "Source of Funds Declaration",
    classification_confidence: 0.61,
    processing_path: "ocr_then_classify_then_extract",
    features_found: ["giftor_sof"],
    models_agree: false,
    parties: "Giftor",
    confidence: "low",
    summary: "Giftor source-of-funds evidence needs classification correction or replacement."
  },
  {
    id: "up10",
    name: "09_Sanctions_Screening.pdf",
    filename: "09_Sanctions_Screening.pdf",
    status: "classified",
    confirmed: false,
    processing_status: "classified",
    classification: "Other",
    classification_confidence: 0.74,
    processing_path: "ocr_then_classify",
    features_found: ["screening_result"],
    models_agree: false,
    parties: "Client",
    confidence: "high",
    summary: "Seeded baseline upload linked to sample sanctions screening evidence."
  }
];

const BASELINE_REPORT = {
  executiveSummary:
    "Initial baseline review indicates attention in AML risk assessment, source-of-funds corroboration, and client-facing complaints wording. Follow-up actions have been captured for inspector review.",
  executive_summary:
    "Initial baseline review indicates attention in AML risk assessment, source-of-funds corroboration, and client-facing complaints wording. Follow-up actions have been captured for inspector review.",
  overallRating: "requires_attention",
  overall_rating: "requires_attention",
  generated_at: "2026-03-24T09:20:00Z"
};

const BASELINE_REPORT_SECTIONS = [
  {
    id: "section_aml",
    codeAreaId: "aml",
    lines: [
      "Practice-wide risk assessment requires update for current risk channels.",
      "Source-of-funds corroboration is inconsistent across sampled files."
    ]
  },
  {
    id: "section_complaints",
    codeAreaId: "complaints",
    lines: ["Complaints website wording references outdated code phrasing."]
  },
  {
    id: "section_accounts",
    codeAreaId: "accounts",
    lines: ["Month-end reconciliation evidence is not consistently linked to matter ledgers."]
  },
  {
    id: "section_client-care",
    codeAreaId: "client-care",
    lines: ["Client-facing escalation contact details are missing in published disclosure text."]
  },
  {
    id: "section_undertakings",
    codeAreaId: "undertakings",
    lines: ["Undertakings tracking controls appear mature and consistently evidenced."]
  }
];

async function deleteDocumentTree(documentRef) {
  const subcollections = await documentRef.listCollections();
  for (const subcollection of subcollections) {
    await deleteCollectionTree(subcollection);
  }
  await documentRef.delete();
}

async function deleteCollectionTree(collectionRef) {
  const snapshot = await collectionRef.get();
  for (const docSnap of snapshot.docs) {
    await deleteDocumentTree(docSnap.ref);
  }
}

async function resetOrganizationTree() {
  const orgRef = database.doc(`organizations/${ORGANIZATION_ID}`);
  const orgSnapshot = await orgRef.get();
  if (!orgSnapshot.exists) {
    return false;
  }
  await deleteDocumentTree(orgRef);
  return true;
}

async function seedOrganization() {
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

async function seedDashboardCases() {
  const basePath = `organizations/${ORGANIZATION_ID}/cases`;
  for (const row of DASHBOARD_CASES) {
    await database.doc(`${basePath}/${row.id}`).set(row.data, { merge: true });
  }
}

async function seedCaseWorkspace(caseId) {
  const caseBase = `organizations/${ORGANIZATION_ID}/cases/${caseId}`;

  for (const item of BASELINE_DOCUMENTS) {
    await database.doc(`${caseBase}/documents/${item.id}`).set(
      {
        ...item,
        documentType: item.classification,
        extracted_fields:
          item.id === "04_Source_of_Funds_Declaration"
            ? {
                funding_source: "Savings and bonus",
                declared_amount: "875000"
              }
            : item.id === "00_Firm_AML_Policy"
              ? { policy_owner: "COLP/MLRO", review_cycle_months: 12 }
              : {},
        parties_found:
          item.id === "04_Source_of_Funds_Declaration"
            ? ["Amira Khan", "Saeed Khan"]
            : item.id === "summary_document"
              ? ["Hartley & Partners Solicitors"]
              : [],
        storagePath: null,
        createdAt: now,
        updatedAt: now
      },
      { merge: true }
    );
  }

  for (const item of BASELINE_UPLOADS) {
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

  for (const item of BASELINE_FINDINGS) {
    await database.doc(`${caseBase}/findings/${item.id}`).set(
      {
        ...item,
        createdAt: now,
        updatedAt: now
      },
      { merge: true }
    );
  }

  for (const item of BASELINE_REQUIREMENTS) {
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
      detail: "Case created and baseline data loaded",
      actor: "System",
      createdAt: now
    },
    { merge: true }
  );

  await database.doc(`${caseBase}/history/h2`).set(
    {
      timestampLabel: "09:18",
      detail: "Initial processing run completed",
      actor: "System",
      createdAt: now
    },
    { merge: true }
  );

  await database.doc(`${caseBase}/contextNotes/cn1`).set(
    {
      text: "Focus on AML evidence chain and complaints disclosure wording.",
      actor: PRIMARY_USER.displayName,
      actorUserId: PRIMARY_USER.id,
      timestampLabel: "09:20",
      createdAt: now
    },
    { merge: true }
  );

  await database.doc(`${caseBase}/reportActions/ra1`).set(
    {
      action: "Update PWRA for current regulatory framework",
      codeRef: "AML Code S3.2.1",
      codeArea: "AML",
      deadline: "2026-02-28",
      person: "",
      status: "open",
      createdAt: now,
      updatedAt: now
    },
    { merge: true }
  );

  await database.doc(`${caseBase}/reportActions/ra2`).set(
    {
      action: "Update complaints website wording and escalation details",
      codeRef: "Complaints Code S2.1",
      codeArea: "Complaints",
      deadline: "2026-03-05",
      person: "",
      status: "open",
      createdAt: now,
      updatedAt: now
    },
    { merge: true }
  );

  await database.doc(`${caseBase}/report/current`).set(
    {
      executiveSummary: BASELINE_REPORT.executiveSummary,
      executive_summary: BASELINE_REPORT.executive_summary,
      overallRating: BASELINE_REPORT.overallRating,
      overall_rating: BASELINE_REPORT.overall_rating,
      generated_at: BASELINE_REPORT.generated_at,
      updatedAt: now
    },
    { merge: true }
  );

  for (const section of BASELINE_REPORT_SECTIONS) {
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
}

async function run() {
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

  console.log("Seed complete: baseline wireframe data loaded.");
}

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
