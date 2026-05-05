import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CASE_FILES_DIR = path.resolve(__dirname, "../src/data/caseFiles");

const CASE_FILE_NAMES = [
  "summary_document.json",
  "00_Firm_AML_Policy.json",
  "01_Client_ID_Verification.json",
  "02_Proof_of_Address.json",
  "03_Client_Risk_Assessment.json",
  "04_Source_of_Funds_Declaration.json",
  "05_Bank_Statements_Client.json",
  "06_Gift_Letter.json",
  "07_Giftor_ID_Verification.json",
  "08_Giftor_Source_of_Funds.json",
  "09_Sanctions_Screening.json",
  "10_PEP_Screening.json"
];

const severityMap = {
  critical: "critical",
  warning: "warning",
  pass: "pass",
  best_practice: "best_practice",
  note: "note"
};

function normaliseSeverity(value, fallback = "pass") {
  const key = String(value || "").toLowerCase();
  return severityMap[key] ?? fallback;
}

function normalisePages(value) {
  if (Array.isArray(value)) {
    const pages = value
      .map((entry) => {
        if (!Number.isFinite(entry)) return null;
        return Math.max(Math.round(entry), 1);
      })
      .filter((entry) => entry !== null);
    return pages.length > 0 ? pages : [1];
  }
  if (Number.isFinite(value)) {
    return [Math.max(Math.round(value), 1)];
  }
  return [1];
}

function extractBoundingBoxes(source) {
  if (!source || typeof source !== "object") {
    return [];
  }
  const entries = Object.entries(source)
    .map(([key, value]) => {
      if (!/^bbox\d*$/i.test(key)) {
        return null;
      }
      if (!Array.isArray(value) || value.length !== 4) {
        return null;
      }
      const orderMatch = key.match(/^bbox(\d*)$/i);
      const orderValue = orderMatch && orderMatch[1] ? Number.parseInt(orderMatch[1], 10) : 1;
      const order = Number.isFinite(orderValue) ? orderValue : 1;
      return { order, box: value };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
  return entries.map((entry) => entry.box);
}

function buildOverlayBoxes(doc) {
  if (!Array.isArray(doc.findings)) return [];
  return doc.findings.flatMap((finding, index) => {
    const source = finding?.source ?? {};
    const bboxes = extractBoundingBoxes(source);
    if (bboxes.length === 0) {
      return [];
    }
    const pages = normalisePages(source.page);
    const combos = [];
    const count = Math.max(pages.length, bboxes.length);
    for (let i = 0; i < count; i += 1) {
      const pageNumber = pages[i] ?? pages[pages.length - 1] ?? pages[0] ?? 1;
      const bbox = bboxes[i] ?? bboxes[0];
      if (!Array.isArray(bbox) || bbox.length !== 4) {
        continue;
      }
      const id = finding.id ?? `${doc.file_id || doc.filename}-box-${index + 1}`;
      combos.push({
        id,
        bbox,
        page: pageNumber,
        pageno: Math.max(Math.round(pageNumber - 1), 0),
        category: finding?.source?.section ?? doc.document_type,
        severity: normaliseSeverity(finding?.type, doc.severity),
        title: finding.title ?? doc.document_type,
        details: finding.deviation ?? finding?.source?.text ?? ""
      });
    }
    return combos;
  });
}

function inferCodeArea(doc, finding) {
  const haystack = [
    doc?.file_id,
    doc?.filename,
    doc?.document_type,
    finding?.title,
    finding?.deviation,
    finding?.source?.section,
    finding?.reference?.section
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("complaint")) return "complaints";
  if (haystack.includes("undertaking")) return "undertakings";
  if (haystack.includes("account") || haystack.includes("reconciliation")) return "accounts";
  if (haystack.includes("management") || haystack.includes("supervision")) return "management";
  if (
    haystack.includes("aml") ||
    haystack.includes("money laundering") ||
    haystack.includes("ctf") ||
    haystack.includes("source of funds") ||
    haystack.includes("risk assessment") ||
    haystack.includes("sanction") ||
    haystack.includes("pep") ||
    haystack.includes("identity")
  ) {
    return "aml";
  }
  return "aml";
}

async function loadRawCaseFiles() {
  const docs = [];
  for (const filename of CASE_FILE_NAMES) {
    const content = await readFile(path.join(CASE_FILES_DIR, filename), "utf8");
    docs.push(JSON.parse(content));
  }
  return docs;
}

const rawFiles = await loadRawCaseFiles();
const [summaryDocument, ...rawDocuments] = rawFiles;

export const auditDocuments = rawDocuments.map((doc) => ({
  ...doc,
  id: doc.file_id ?? doc.filename,
  label: doc.document_type ?? doc.file_id ?? doc.filename,
  severity: normaliseSeverity(doc.severity, "pass"),
  pdf: `assets/case-files/${doc.filename}`,
  overlay: {
    boxes: buildOverlayBoxes(doc)
  }
}));

export const auditFindings = rawDocuments.flatMap((doc) => {
  if (!Array.isArray(doc.findings) || doc.findings.length === 0) {
    return [];
  }
  return doc.findings.map((finding, index) => {
    const derivedId = finding.id ?? `${doc.file_id || doc.filename}-finding-${index + 1}`;
    const severity = normaliseSeverity(finding.type, doc.severity);
    const isGoodPractice = severity === "best_practice";
    const polarity = severity === "pass" || isGoodPractice ? "compliant" : "non_compliant";
    const certainty = severity === "warning" ? "lead" : "finding";
    return {
      id: derivedId,
      severity,
      codeArea: inferCodeArea(doc, finding),
      title: finding.title ?? doc.document_type,
      detail: finding.deviation ?? finding?.source?.text ?? "",
      documentId: doc.file_id ?? doc.filename,
      boxId: finding.id ?? derivedId,
      certainty,
      polarity,
      isGoodPractice,
      reviewStatus: "unreviewed",
      source: finding.source,
      reference: finding.reference
    };
  });
});

export const auditSummary = summaryDocument;
