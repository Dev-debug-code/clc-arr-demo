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
  deleteCaseRecord,
  persistContextNote,
  persistDocumentNote,
  persistFindingDecision,
  persistFindingNote,
  persistGeneratedWorkspace,
  persistGenerateFindingsEvent,
  persistGenerateReport,
  runSimulatedClassification,
  runSimulatedFindingsGeneration,
  persistConfirmAllUploads,
  persistUploadItem,
  persistUploadItemDelete
} from './firestoreProvider.js';

export { prepareUploadDraft, prepareWorkspaceSnapshot } from './firestoreProvider.js';
