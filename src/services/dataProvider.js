import * as firestoreProvider from './providers/firestoreProvider.js';
import * as mockProvider from './providers/mockProvider.js';
import * as apiProvider from './providers/apiProvider.js';

const REQUESTED_MODE = String(import.meta.env.VITE_DATA_PROVIDER || 'firestore').trim().toLowerCase();

const PROVIDERS = {
  firestore: firestoreProvider,
  mock: mockProvider,
  api: apiProvider
};

const ACTIVE_MODE = Object.prototype.hasOwnProperty.call(PROVIDERS, REQUESTED_MODE)
  ? REQUESTED_MODE
  : 'firestore';

const provider = PROVIDERS[ACTIVE_MODE];

if (REQUESTED_MODE !== ACTIVE_MODE) {
  // eslint-disable-next-line no-console
  console.warn(`[dataProvider] Unknown mode "${REQUESTED_MODE}", falling back to "${ACTIVE_MODE}".`);
}

export const DATA_PROVIDER_MODE = ACTIVE_MODE;

export const listCases = (...args) => provider.listCases(...args);
export const lookupPracticeByLicenceNumber = (...args) => provider.lookupPracticeByLicenceNumber(...args);
export const searchCase = (...args) => provider.searchCase(...args);
export const exportCaseReport = (...args) => provider.exportCaseReport(...args);
export const loadCaseWorkspaceData = (...args) => provider.loadCaseWorkspaceData(...args);
export const createCaseRecord = (...args) => provider.createCaseRecord(...args);
export const persistInspectorFinding = (...args) => provider.persistInspectorFinding(...args);
export const persistInspectorFindingDelete = (...args) => provider.persistInspectorFindingDelete(...args);
export const persistObservation = (...args) => provider.persistObservation(...args);
export const persistObservationUpdate = (...args) => provider.persistObservationUpdate(...args);
export const persistObservationDelete = (...args) => provider.persistObservationDelete(...args);
export const persistReportPatch = (...args) => provider.persistReportPatch(...args);
export const persistReportSectionPatch = (...args) => provider.persistReportSectionPatch(...args);
export const persistReportSectionRevert = (...args) => provider.persistReportSectionRevert(...args);
export const persistFeedback = (...args) => provider.persistFeedback(...args);
export const persistReportAction = (...args) => provider.persistReportAction(...args);
export const persistReportActionDelete = (...args) => provider.persistReportActionDelete(...args);
export const persistCasePatch = (...args) => provider.persistCasePatch(...args);
export const persistFindingDecision = (...args) => provider.persistFindingDecision(...args);
export const persistFindingNote = (...args) => provider.persistFindingNote(...args);
export const persistDocumentNote = (...args) => provider.persistDocumentNote(...args);
export const persistContextNote = (...args) => provider.persistContextNote(...args);
export const persistUploadItem = (...args) => provider.persistUploadItem(...args);
export const persistConfirmAllUploads = (...args) => provider.persistConfirmAllUploads(...args);
export const persistGenerateFindingsEvent = (...args) => provider.persistGenerateFindingsEvent(...args);
export const persistGenerateReport = (...args) => provider.persistGenerateReport(...args);
export const prepareUploadDraft = (...args) => provider.prepareUploadDraft(...args);
export const prepareWorkspaceSnapshot = (...args) => provider.prepareWorkspaceSnapshot(...args);
