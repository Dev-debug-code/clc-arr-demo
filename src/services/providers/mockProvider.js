// Temporary mock provider. For now this reuses Firestore-backed behavior so current
// flows keep working while we progressively replace calls with API-contract fixtures.
export {
  createCaseRecord,
  listCases,
  lookupPracticeByLicenceNumber,
  searchCase,
  exportCaseReport,
  loadCaseWorkspaceData,
  persistInspectorFinding,
  persistInspectorFindingDelete,
  persistObservation,
  persistObservationUpdate,
  persistObservationDelete,
  persistReportPatch,
  persistReportSectionPatch,
  persistReportSectionRevert,
  persistFeedback,
  persistReportAction,
  persistReportActionDelete,
  persistCasePatch,
  persistContextNote,
  persistDocumentNote,
  persistFindingDecision,
  persistFindingNote,
  persistGenerateFindingsEvent,
  persistGenerateReport,
  persistConfirmAllUploads,
  persistUploadItem
} from './firestoreProvider.js';

export { prepareUploadDraft, prepareWorkspaceSnapshot } from './firestoreProvider.js';
