import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUserProfile } from '../../services/userProfile.js';
import {
  DATA_PROVIDER_MODE,
  createCaseRecord,
  listCases,
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
  persistConfirmAllUploads,
  persistContextNote,
  persistDocumentNote,
  persistFindingDecision,
  persistFindingNote,
  persistGenerateFindingsEvent,
  persistGenerateReport,
  persistUploadItem,
  persistUploadItemDelete,
  runSimulatedClassification,
  runSimulatedFindingsGeneration,
  prepareUploadDraft,
  prepareWorkspaceSnapshot
} from '../../services/dataProvider.js';
import {
  DOCUMENT_CLASSIFICATION_GROUPS,
  DOCUMENT_CLASSIFICATION_OTHER_OPTION,
  createIntervieweeDraft,
  formatUploadClassificationLabel,
  hasIncompleteUploadInterviewees,
  isInterviewTranscriptUpload,
  isUploadClassificationResolved,
  isUploadLimitedAnalysis,
  normalizeUploadDraft,
  normalizeUploadInterviewees
} from '../../utils/documentUploads.js';
import {
  canAccessTeamCases,
  formatUserRoleLabel,
  normalizeUserRole
} from '../../utils/accessControl.js';
import { createInspectionReportPdf, exportStyledInspectionReportPdf } from '../../utils/reportPdf.js';
import {
  ANALYSIS_TICK_INTERVAL_MS,
  AI_PROCESSING_STEPS,
  AI_PROCESSING_MESSAGES,
  CASE_TABS,
  CASE_META,
  CODE_AREA_ALIASES,
  CODE_AREA_KEYWORDS,
  CODE_AREA_REQUIREMENT_SAMPLES,
  DOCUMENT_PHASE_OPTIONS,
  FINDING_EVIDENCE_STRENGTH_MAP,
  FINDING_FILTER_LABEL_MAP,
  FINDING_SEVERITY_BADGE_MAP,
  FINDING_REQUIREMENT_OPTIONS,
  FOCUS_AREA_OPTIONS,
  INITIAL_HISTORY_ITEMS,
  INITIAL_UPLOAD_ITEMS,
  INSPECTION_LINEAR_FINAL_STEP,
  MANUAL_CASE_LEVEL_SOURCE_OPTIONS,
  NOT_ASSESSED_AREAS,
  OBSERVATION_SOURCE_OPTIONS,
  RECURRING_FINDING_IDS,
  REGGIE_SUGGESTIONS,
  REPORT_SEVERITY_LABEL_MAP,
  REPORT_ACTION_DEFAULTS,
  RISK_REGISTER_PRESET,
  REVIEW_REASON_OPTIONS,
  SEVERITY_LABEL_MAP,
  STEP_CASE_SETUP,
  STEP_DOCUMENTS,
  STEP_HISTORY,
  STEP_OVERVIEW,
  STEP_PROCESSING,
  STEP_REPORT,
  STEP_VIEWER,
  WORKFLOW_STEP_CONFIG
} from './config.js';
import {
  buildFilenameKeySet,
  buildDocumentLookupKeys,
  buildEvidencePassages,
  buildUploadLookupKeys,
  coerceText,
  collectFindingBoxIdsForDocument,
  deriveLegacyFindingSeverity,
  extractIdleDays,
  findingReferencesDocument,
  formatReferenceText,
  formatRiskLevelLabel,
  formatShortDisplayDate,
  formatSourceDocumentRef,
  formatTimeLabel,
  getFindingDisplayBucketId,
  getFindingDisplayDecisionState,
  getFindingEffectiveCertainty,
  getFindingPreferredBoxIdForDocument,
  getRequirementSeverity,
  inferRequirementCodeArea,
  isFindingOverturned,
  isInspectorAddedFinding,
  isLeadFindingByTaxonomy,
  isRequirementExcluded,
  isRequirementMet,
  safeSourceField,
  safeText,
  textOf,
  toDateInputValue,
  toIsoDate,
  viewerSelectionsMatch
} from './helpers.js';
import { DEMO_PRACTICE_PROFILES } from '../../data/demoPracticeProfiles.js';
import { renderConfidenceDots, renderRiskDots } from './displayHelpers.jsx';
import AccessPendingPage from './components/AccessPendingPage.jsx';
import CaseHeader from './components/CaseHeader.jsx';
import CaseSetupPage from './components/CaseSetupPage.jsx';
import ComplianceByCodeAreaPanel from './components/ComplianceByCodeAreaPanel.jsx';
import ComposerModal from './components/ComposerModal.jsx';
import ConfirmAllUploadsModal from './components/ConfirmAllUploadsModal.jsx';
import ContextNoteModal from './components/ContextNoteModal.jsx';
import DashboardPage from './components/DashboardPage.jsx';
import DocumentsStage from './components/DocumentsStage.jsx';
import FeedbackControls from './components/FeedbackControls.jsx';
import LeadConfirmModal from './components/LeadConfirmModal.jsx';
import ManualEvidenceModal from './components/ManualEvidenceModal.jsx';
import OverviewStage from './components/OverviewStage.jsx';
import ProcessingStage from './components/ProcessingStage.jsx';
import ReggiePanel from './components/ReggiePanel.jsx';
import ReportStage from './components/ReportStage.jsx';
import ReportPendingModal from './components/ReportPendingModal.jsx';
import ReportRegenerateModal from './components/ReportRegenerateModal.jsx';
import UndoToast from './components/UndoToast.jsx';
import ViewerStage from './components/ViewerStage.jsx';
import WorkspaceShell from './components/WorkspaceShell.jsx';
import { GuidanceContextLayout } from '../../pages/GuidanceContextPage.jsx';
import { findMediumReggieResponse } from '../../data/reggieDemoResponses.js';
import {
  createReggieRuntimeSession,
  getStoredReggieRuntimeApiKey,
  isReggieAckText,
  normalizeReggieCitations,
  parseReggieTextAndCitations,
  streamReggieRuntimeQuery
} from '../../utils/reggieRuntime.js';

function toDashboardCaseDateMs(value) {
  if (!value) return null;

  if (typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') return null;

  const cleanValue = value.trim();
  if (!cleanValue) return null;

  const localDateMatch = cleanValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (localDateMatch) {
    const [, day, month, year] = localDateMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  const parsed = new Date(cleanValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function matchesDashboardDateFilter(item, activeFilter) {
  if (activeFilter === 'All' || activeFilter === 'Custom date range') return true;

  const caseDateMs =
    toDashboardCaseDateMs(item?.startedAt) ??
    toDashboardCaseDateMs(item?.createdAt) ??
    toDashboardCaseDateMs(item?.lastActivityAt) ??
    toDashboardCaseDateMs(item?.updatedAt) ??
    toDashboardCaseDateMs(item?.started);

  if (!Number.isFinite(caseDateMs)) return false;

  const caseDate = new Date(caseDateMs);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (activeFilter === 'This week') {
    const startOfWeek = new Date(startOfToday);
    const dayOffset = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - dayOffset);
    return caseDate >= startOfWeek;
  }

  if (activeFilter === 'This month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return caseDate >= startOfMonth;
  }

  if (activeFilter === 'Last 3 months') {
    const startOfWindow = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return caseDate >= startOfWindow;
  }

  return true;
}

const PROCESSING_MODE_CLASSIFICATION = 'classification';
const PROCESSING_MODE_FINDINGS = 'findings';
const DEFAULT_FINDING_VIEW_FILTERS = [];
const DEFAULT_OVERVIEW_FINDING_SCOPE = 'open';

const GUIDANCE_SOURCE_PATHS = {
  amlPolicy: 'assets/case-files/00_Firm_AML_Policy.pdf',
  amlGuidance: 'assets/case-files/CLC_Anti_Money_Laundering_Guidance_Jan2025.pdf',
  codeOfConduct: 'assets/case-files/Code-of-Conduct.pdf',
  actingForLenders:
    'assets/case-files/20240110-Acting-for-Lenders-and-Prevention-and-Detection-of-Mortgage-Fraud-Guidance.pdf'
};

let reggieChatSequence = 0;
let reggieMessageSequence = 0;

function nextReggieMessageId(prefix = 'reggie') {
  reggieMessageSequence += 1;
  return `${prefix}-${Date.now()}-${reggieMessageSequence}`;
}

function createReggieChat(scope = 'all') {
  reggieChatSequence += 1;
  return {
    id: `reggie-chat-${Date.now()}-${reggieChatSequence}`,
    title: 'New chat',
    scope,
    updatedAt: Date.now(),
    messages: [],
    sessionId: '',
    isStreaming: false
  };
}

const INITIAL_REGGIE_CHAT = createReggieChat('all');

function resolveCodeOfConductPage(referenceLower, titleLower) {
  if (
    referenceLower.includes('specific requirement 6.j')
    || referenceLower.includes('specific requirement 6.k')
    || titleLower.includes('complaints procedure')
    || titleLower.includes('legal ombudsman')
  ) {
    return 8;
  }
  if (referenceLower.includes('specific requirement 3.r')) return 5;
  if (referenceLower.includes('specific requirement 3.u')) return 5;
  if (referenceLower.includes('overriding principle 3.j')) return 4;
  if (referenceLower.includes('overriding principle 3.m')) return 5;
  if (referenceLower.includes('outcome 3.5')) return 4;
  if (referenceLower.includes('overriding principle 1.m')) return 2;
  if (referenceLower.includes('overriding principle 2.f')) return 3;
  return 1;
}

function resolveActingForLendersPage(referenceLower, titleLower) {
  if (
    referenceLower.includes('checking identity by original documents')
    || referenceLower.includes('1-2')
    || titleLower.includes('identity document does not match client')
  ) {
    return 1;
  }
  if (referenceLower.includes('section 9')) return 5;
  if (referenceLower.includes('section 8(ii)') || referenceLower.includes('section 8')) return 5;
  if (referenceLower.includes('due diligence') || referenceLower.includes('item e')) return 11;
  return 1;
}

const CLASSIFICATION_PROCESSING_STEPS = [
  'Reading uploaded documents',
  'Classifying document types',
  'Preparing classification review'
];

const CLASSIFICATION_PROCESSING_MESSAGES = [
  'Reading the selected case files...',
  'Classifying documents and checking confidence...',
  'Preparing the classification review table...'
];

const CLASSIFICATION_PROCESSING_DURATION_MS = 20_000;
const FINDINGS_PROCESSING_DURATION_MS = 40_000;

const buildClassificationReason = (filename, classification) => {
  const cleanFilename = coerceText(filename).trim() || 'document';
  const cleanClassification = coerceText(classification).trim() || 'Unknown';

  if (cleanClassification === 'Other' || cleanClassification === 'Unknown') {
    return `The AI could not map ${cleanFilename} confidently to a known document type.`;
  }

  return `The AI matched ${cleanFilename} to ${cleanClassification} using document-name and content cues.`;
};

export default function WorkspaceApp({ currentUser, onSignOut }) {
  const currentUserEmail = currentUser?.email ?? '';
  const assetBase = import.meta.env.BASE_URL ?? '/';
  const forcedUserRole =
    DATA_PROVIDER_MODE === 'firestore' ? '' : coerceText(import.meta.env.VITE_FORCE_USER_ROLE).trim();
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [caseOpenTransitionCaseId, setCaseOpenTransitionCaseId] = useState('');
  const [firestoreDocuments, setFirestoreDocuments] = useState([]);
  const [firestoreFindings, setFirestoreFindings] = useState([]);
  const [firestoreRequirementsByCodeArea, setFirestoreRequirementsByCodeArea] = useState({});
  const [appMode, setAppMode] = useState('dashboard');
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [isCurrentUserProfileLoading, setIsCurrentUserProfileLoading] = useState(false);
  const [teamView, setTeamView] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardDateFilter, setDashboardDateFilter] = useState('All');
  const [dashboardOutcomeFilter, setDashboardOutcomeFilter] = useState('All');
  const [dashboardInspectorFilter, setDashboardInspectorFilter] = useState('All inspectors');
  const [dashboardCases, setDashboardCases] = useState([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const previousStepRef = useRef(STEP_DOCUMENTS);
  const processingStartedAtRef = useRef(0);
  const [showCompletedCases, setShowCompletedCases] = useState(false);
  const [showRecentlyCompleted, setShowRecentlyCompleted] = useState(false);
  const [contextNoteOpen, setContextNoteOpen] = useState(false);
  const [contextNoteDraft, setContextNoteDraft] = useState('');
  const [highRejectionPromptDismissed, setHighRejectionPromptDismissed] = useState(false);
  const [caseContextNotes, setCaseContextNotes] = useState([]);
  const [isViewerFocusMode, setIsViewerFocusMode] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepUnlocked, setMaxStepUnlocked] = useState(1);
  const [currentCaseMeta, setCurrentCaseMeta] = useState(CASE_META);
  const [isActiveCasePersisted, setIsActiveCasePersisted] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisMode, setAnalysisMode] = useState(PROCESSING_MODE_FINDINGS);

  const [docPulse, setDocPulse] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState([]);
  const [severityFilterOpen, setSeverityFilterOpen] = useState(false);
  const [overviewFilterOpen, setOverviewFilterOpen] = useState(false);
  const [overviewFindingScope, setOverviewFindingScope] = useState(DEFAULT_OVERVIEW_FINDING_SCOPE);
  const [viewerTypeFilterOpen, setViewerTypeFilterOpen] = useState(false);
  const [viewerCodeAreaFilterOpen, setViewerCodeAreaFilterOpen] = useState(false);
  const [findingViewFilters, setFindingViewFilters] = useState(DEFAULT_FINDING_VIEW_FILTERS);
  const [viewerCodeAreaFilter, setViewerCodeAreaFilter] = useState('all');
  const [activeDocId, setActiveDocId] = useState('');
  const [activeDocBoxId, setActiveDocBoxId] = useState(null);
  const [showDocBoxes, setShowDocBoxes] = useState(true);
  const [activeFindingId, setActiveFindingId] = useState(null);
  const [viewerOriginStep, setViewerOriginStep] = useState(STEP_OVERVIEW);
  const [activeGuidanceContext, setActiveGuidanceContext] = useState(null);
  const [guidanceReturnContext, setGuidanceReturnContext] = useState(null);
  const [reggieViewerReturnContext, setReggieViewerReturnContext] = useState(null);
  const [viewerSelectionHistory, setViewerSelectionHistory] = useState([]);
  const [docFocusSignal, setDocFocusSignal] = useState(0);
  const [findingDecisions, setFindingDecisions] = useState({});
  const [findingNotes, setFindingNotes] = useState({});
  const [documentNotes, setDocumentNotes] = useState({});
  const [undoDecision, setUndoDecision] = useState(null);
  const [historyItems, setHistoryItems] = useState(INITIAL_HISTORY_ITEMS);
  const [activeMenuFindingId, setActiveMenuFindingId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteTargetFindingId, setNoteTargetFindingId] = useState(null);
  const [inlineRejectFindingId, setInlineRejectFindingId] = useState(null);
  const [inlineRejectReason, setInlineRejectReason] = useState('');
  const [inlineRejectNote, setInlineRejectNote] = useState('');
  const [inlineDismissFindingId, setInlineDismissFindingId] = useState(null);
  const [inlineDismissReason, setInlineDismissReason] = useState('');
  const [inlineDismissNote, setInlineDismissNote] = useState('');
  const [deletedFindingIds, setDeletedFindingIds] = useState({});
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [documentsPhase, setDocumentsPhase] = useState('intake');
  const [documentWorkspaceTab, setDocumentWorkspaceTab] = useState('findings');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docSearchScope, setDocSearchScope] = useState('document');
  const [docCrossSearchOpen, setDocCrossSearchOpen] = useState(false);
  const [providerSearchResults, setProviderSearchResults] = useState([]);
  const [providerSearchSupported, setProviderSearchSupported] = useState(false);
  const [isProviderSearchLoading, setIsProviderSearchLoading] = useState(false);
  const [docLevelNoteOpen, setDocLevelNoteOpen] = useState(false);
  const [docLevelNoteDraft, setDocLevelNoteDraft] = useState('');
  const [uploadItems, setUploadItems] = useState(INITIAL_UPLOAD_ITEMS);
  const [reggieOpen, setReggieOpen] = useState(false);
  const [reggieScope, setReggieScope] = useState('all');
  const [reggieThinkingLevel, setReggieThinkingLevel] = useState('medium');
  const [reggieInput, setReggieInput] = useState('');
  const [reggieRuntimeApiKey] = useState(() => getStoredReggieRuntimeApiKey());
  const [reggieChats, setReggieChats] = useState(() => [INITIAL_REGGIE_CHAT]);
  const [activeReggieChatId, setActiveReggieChatId] = useState(INITIAL_REGGIE_CHAT.id);
  const [inspectorFindings, setInspectorFindings] = useState([]);
  const [inspectorObservations, setInspectorObservations] = useState([]);
  const [reportSectionIdsByCodeArea, setReportSectionIdsByCodeArea] = useState({});
  const [reportSectionNarrativesByCodeArea, setReportSectionNarrativesByCodeArea] = useState({});
  const [reportOriginalSectionNarrativesByCodeArea, setReportOriginalSectionNarrativesByCodeArea] = useState({});
  const [reportExecutiveSummaryOverride, setReportExecutiveSummaryOverride] = useState('');
  const [reportOriginalExecutiveSummary, setReportOriginalExecutiveSummary] = useState('');
  const [reportPendingChanges, setReportPendingChanges] = useState(false);
  const [reportNeedsRegeneration, setReportNeedsRegeneration] = useState(true);
  const [reportRegenerateConfirmOpen, setReportRegenerateConfirmOpen] = useState(false);
  const [reportPendingGateOpen, setReportPendingGateOpen] = useState(false);
  const [reportPendingAction, setReportPendingAction] = useState('generate');
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [reportGenerationInProgress, setReportGenerationInProgress] = useState(false);
  const [reportGenerationMode, setReportGenerationMode] = useState('generate');
  const [reportDraftVersion, setReportDraftVersion] = useState(0);
  const [reportAccessNotice, setReportAccessNotice] = useState('');
  const [reprocessBannerDismissed, setReprocessBannerDismissed] = useState(false);
  const [uploadAreaCollapsed, setUploadAreaCollapsed] = useState(true);
  const [activeClassificationMenu, setActiveClassificationMenu] = useState(null);
  const [confirmAllUploadsGateOpen, setConfirmAllUploadsGateOpen] = useState(false);
  const [hasViewedUploadTableEnd, setHasViewedUploadTableEnd] = useState(false);
  const [expandedUploadSummaryId, setExpandedUploadSummaryId] = useState('');
  const [expandedCodeAreaIds, setExpandedCodeAreaIds] = useState({});
  const [expandedOverviewFindingIds, setExpandedOverviewFindingIds] = useState({});
  const [closingOverviewFindingIds, setClosingOverviewFindingIds] = useState({});
  const acceptedOverviewCollapseTimersRef = useRef({});
  const reggieTimersRef = useRef({});
  const [expandedViewerFindingIds, setExpandedViewerFindingIds] = useState({});
  const [overviewRequirementFilter, setOverviewRequirementFilter] = useState({ areaId: '', requirementId: '' });
  const [notAssessedExpanded, setNotAssessedExpanded] = useState(false);
  const [notApplicableExpanded, setNotApplicableExpanded] = useState(false);
  const [notAssessedAreas, setNotAssessedAreas] = useState(NOT_ASSESSED_AREAS);
  const [documentsNotesExpanded, setDocumentsNotesExpanded] = useState(false);
  const [documentsLogExpanded, setDocumentsLogExpanded] = useState(false);
  const [docsMarkedForReprocess, setDocsMarkedForReprocess] = useState({});
  const [pendingScopeChangeCount, setPendingScopeChangeCount] = useState(0);
  const [processingLog, setProcessingLog] = useState([
    { id: 'p1', detail: 'Initial processing - 14 new findings across 6 code areas', time: '09:18' },
    { id: 'p2', detail: 'Generate findings run - 3 findings generated, 0 updated', time: '09:19' }
  ]);
  const [composerModal, setComposerModal] = useState({
    open: false,
    type: 'observation',
    step: 1,
    text: '',
    sourceType: OBSERVATION_SOURCE_OPTIONS[0],
    requirement: FINDING_REQUIREMENT_OPTIONS[0],
    selectedRequirements: [FINDING_REQUIREMENT_OPTIONS[0]],
    polarity: 'non_compliant',
    goodPractice: false,
    evidenceType: 'document',
    evidenceNote: '',
    selectedDocumentIds: [],
    documentAnchors: {}
  });
  const [manualEvidenceModalOpen, setManualEvidenceModalOpen] = useState(false);
  const [leadConfirmModal, setLeadConfirmModal] = useState({
    open: false,
    findingId: '',
    polarity: 'non_compliant',
    goodPractice: false,
    originStep: STEP_OVERVIEW,
    selectedDocumentIds: [],
    documentAnchors: {}
  });
  const [editedReportSections, setEditedReportSections] = useState({
    interviews: false,
    summary: false,
    attention: false,
    goodPractice: false
  });
  const [reportActionItems, setReportActionItems] = useState([]);
  const [reportActionOriginalItems, setReportActionOriginalItems] = useState([]);
  const [caseSetupPracticeName, setCaseSetupPracticeName] = useState('');
  const [caseSetupHolp, setCaseSetupHolp] = useState('');
  const [caseSetupHofa, setCaseSetupHofa] = useState('');
  const [caseSetupRiskLevel, setCaseSetupRiskLevel] = useState('not-assessed');
  const [caseSetupTransactionType, setCaseSetupTransactionType] = useState('');
  const [caseSetupActingForLender, setCaseSetupActingForLender] = useState('');
  const [caseSetupAmlTier, setCaseSetupAmlTier] = useState('');
  const [caseSetupPreviousInspection, setCaseSetupPreviousInspection] = useState('');
  const [caseSetupConcerns, setCaseSetupConcerns] = useState('');
  const [caseSetupQuestionnaireFile, setCaseSetupQuestionnaireFile] = useState('');
  const [caseSetupQuestionnaireFileBlob, setCaseSetupQuestionnaireFileBlob] = useState(null);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [caseCreateError, setCaseCreateError] = useState('');
  const [selectedFocusAreaIds, setSelectedFocusAreaIds] = useState(
    () => new Set(FOCUS_AREA_OPTIONS.map((area) => area.id))
  );
  const currentUserRole = useMemo(
    () => normalizeUserRole(forcedUserRole || currentUserProfile?.role),
    [currentUserProfile?.role, forcedUserRole]
  );
  const hasTeamCaseAccess = canAccessTeamCases(currentUserRole);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!currentUser?.uid) {
        setCurrentUserProfile(null);
        setIsCurrentUserProfileLoading(false);
        return;
      }

      setIsCurrentUserProfileLoading(true);
      try {
        const profile = await getUserProfile(currentUser.uid);
        if (!cancelled) {
          setCurrentUserProfile(profile);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load user profile', error);
        if (!cancelled) {
          setCurrentUserProfile(null);
        }
      } finally {
        if (!cancelled) {
          setIsCurrentUserProfileLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!hasTeamCaseAccess) {
      setTeamView(false);
      setDashboardInspectorFilter('All inspectors');
    }
  }, [hasTeamCaseAccess]);

  useEffect(
    () => () => {
      Object.values(acceptedOverviewCollapseTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      acceptedOverviewCollapseTimersRef.current = {};
      Object.values(reggieTimersRef.current).forEach((timerIds) => {
        timerIds.forEach((timerId) => window.clearTimeout(timerId));
      });
      reggieTimersRef.current = {};
    },
    []
  );

  const refreshDashboardCases = useCallback(
    async ({ showLoading = false } = {}) => {
      if (isCurrentUserProfileLoading) return;
      if (DATA_PROVIDER_MODE === 'firestore' && currentUser?.uid && !currentUserProfile) {
        setDashboardCases([]);
        setDashboardError('');
        if (showLoading) {
          setIsDashboardLoading(false);
        }
        return;
      }

      if (showLoading) {
        setIsDashboardLoading(true);
      }
      setDashboardError('');

      try {
        const rows = await listCases({
          user: currentUser,
          role: currentUserRole
        });
        setDashboardCases(rows);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load dashboard cases from data provider', error);
        setDashboardError('Cannot read cases from the data provider. Check auth/rules/API connectivity.');
      } finally {
        if (showLoading) {
          setIsDashboardLoading(false);
        }
      }
    },
    [
      currentCaseMeta.caseId,
      currentUser,
      currentUserProfile,
      currentUserRole,
      isActiveCasePersisted,
      isCurrentUserProfileLoading
    ]
  );

  useEffect(() => {
    if (appMode !== 'dashboard') return;
    let cancelled = false;

    const loadCases = async () => {
      await refreshDashboardCases({ showLoading: true });
      if (cancelled) {
        return;
      }
    };

    loadCases();
    return () => {
      cancelled = true;
    };
  }, [appMode, refreshDashboardCases]);

  useEffect(() => {
    if (appMode !== 'inspection') return;
    const caseId = currentCaseMeta.caseId?.trim();
    if (!caseId) return;

    if (skipNextWorkspaceLoadCaseIdRef.current === caseId) {
      skipNextWorkspaceLoadCaseIdRef.current = '';
      setIsWorkspaceLoading(false);
      setCaseOpenTransitionCaseId('');
      setIsActiveCasePersisted(true);
      return;
    }

    let cancelled = false;

    const loadWorkspace = async () => {
      setIsWorkspaceLoading(true);
      setFirestoreDocuments([]);
      setFirestoreFindings([]);
      setFirestoreRequirementsByCodeArea({});
      setFindingDecisions({});
      setFindingNotes({});
      setDocumentNotes({});
      setCaseContextNotes([]);
      setInspectorObservations([]);
      setInspectorFindings([]);
      setUploadItems([]);
      setExpandedCodeAreaIds({});
      setExpandedOverviewFindingIds({});
      setOverviewRequirementFilter({ areaId: '', requirementId: '' });
      try {
        const snapshot = await loadCaseWorkspaceData(caseId);
        if (!snapshot || cancelled) return;

        const syncedPracticeName = snapshot.caseMetaPatch.practiceName ?? prev.practiceName;
        const syncedHolp = snapshot.caseMetaPatch.holp ?? prev.holp;
        const syncedHofa = snapshot.caseMetaPatch.hofa ?? prev.hofa;
        const syncedRiskLevel = snapshot.caseMetaPatch.riskLevel ?? prev.riskLevel;
        const syncedTransactionType = snapshot.caseMetaPatch.transactionType ?? prev.transactionType;
        const syncedActingForLender =
          typeof snapshot.caseMetaPatch.actingForLender === 'boolean'
            ? snapshot.caseMetaPatch.actingForLender
            : prev.actingForLender;
        const syncedAmlTier = snapshot.caseMetaPatch.amlTier ?? prev.amlTier;
        const syncedPreviousInspection = snapshot.caseMetaPatch.previousInspection ?? prev.previousInspection;
        setCaseSetupPracticeName(syncedPracticeName || '');
        setCaseSetupHolp(syncedHolp || '');
        setCaseSetupHofa(syncedHofa || '');
        setCaseSetupRiskLevel(syncedRiskLevel || 'not-assessed');
        setCaseSetupTransactionType(syncedTransactionType || '');
        setCaseSetupActingForLender(typeof syncedActingForLender === 'boolean' ? (syncedActingForLender ? 'yes' : 'no') : '');
        setCaseSetupAmlTier(syncedAmlTier || '');
        setCaseSetupPreviousInspection(syncedPreviousInspection || '');
        setCurrentCaseMeta((prev) => ({
          ...prev,
          practiceName: syncedPracticeName,
          caseId: snapshot.caseMetaPatch.caseId ?? prev.caseId,
          owner: snapshot.caseMetaPatch.owner ?? prev.owner,
          status: snapshot.caseMetaPatch.status ?? prev.status,
          outcome: snapshot.caseMetaPatch.outcome ?? prev.outcome,
          started: snapshot.caseMetaPatch.started ?? prev.started,
          riskLevel: syncedRiskLevel,
          previousInspection: syncedPreviousInspection,
          holp: syncedHolp,
          hofa: syncedHofa,
          transactionType: syncedTransactionType,
          actingForLender:
            typeof syncedActingForLender === 'boolean'
              ? syncedActingForLender
              : prev.actingForLender,
          amlTier: syncedAmlTier,
          focusAreas: Array.isArray(snapshot.caseMetaPatch.focusAreas)
            ? snapshot.caseMetaPatch.focusAreas
            : prev.focusAreas,
          knownParties: Array.isArray(snapshot.caseMetaPatch.knownParties)
            ? snapshot.caseMetaPatch.knownParties
            : prev.knownParties
        }));

        if (Array.isArray(snapshot.caseMetaPatch.focusAreas)) {
          const selectedAreaSet = new Set(snapshot.caseMetaPatch.focusAreas.map((entry) => String(entry || '').trim()));
          setSelectedFocusAreaIds(selectedAreaSet);
          setNotAssessedAreas(snapshot.caseExists ? [] : FOCUS_AREA_OPTIONS.filter((area) => !selectedAreaSet.has(area.id)).map((area) => area.label));
        } else {
          setSelectedFocusAreaIds(new Set());
          setNotAssessedAreas([]);
        }

        setIsActiveCasePersisted(Boolean(snapshot.caseExists));

        setFirestoreDocuments(snapshot.documents);
        setFirestoreFindings(snapshot.findings);
        setFirestoreRequirementsByCodeArea(snapshot.requirementsByCodeArea ?? {});
        {
          const nextFindingDecisions = { ...(snapshot.findingDecisions ?? {}) };
          (snapshot.findings ?? []).forEach((finding) => {
            const findingId = coerceText(finding?.id);
            if (!findingId || nextFindingDecisions[findingId]) return;
            const normalizedReviewStatus = String(finding?.reviewStatus || finding?.review_status || '')
              .trim()
              .toLowerCase();
            if (normalizedReviewStatus === 'accepted' || normalizedReviewStatus === 'confirmed') {
              nextFindingDecisions[findingId] = 'accepted';
            } else if (normalizedReviewStatus === 'rejected') {
              nextFindingDecisions[findingId] = 'rejected';
            } else if (normalizedReviewStatus === 'dismissed') {
              nextFindingDecisions[findingId] = 'dismissed';
            }
          });
          setFindingDecisions(nextFindingDecisions);
        }
        setFindingNotes(snapshot.findingNotes);
        setDocumentNotes(snapshot.documentNotes);
        setCaseContextNotes(snapshot.caseContextNotes);
        const isCompletedSnapshot =
          String(snapshot.caseMetaPatch.status ?? '').trim().toLowerCase() === 'completed' ||
          String(snapshot.caseMetaPatch.outcome ?? '').trim().toLowerCase() === 'compliant';
        if (isCompletedSnapshot) {
          const nextExpandedAreas = {};
          Object.keys(snapshot.requirementsByCodeArea ?? {}).forEach((codeAreaId) => {
            const cleanCodeAreaId = coerceText(codeAreaId);
            if (cleanCodeAreaId) {
              nextExpandedAreas[cleanCodeAreaId] = true;
            }
          });
          (snapshot.findings ?? []).forEach((finding) => {
            const cleanCodeAreaId = coerceText(finding?.codeArea ?? finding?.code_area);
            if (cleanCodeAreaId) {
              nextExpandedAreas[cleanCodeAreaId] = true;
            }
          });
          setExpandedCodeAreaIds(nextExpandedAreas);
        } else {
          setExpandedCodeAreaIds({});
        }
        setExpandedOverviewFindingIds({});
        setOverviewRequirementFilter({ areaId: '', requirementId: '' });
        const preparedUploads = (snapshot.uploadItems ?? []).map((item) => prepareUploadDraft(item));
        setUploadItems(preparedUploads);
        setDocumentsPhase(
          preparedUploads.length === 0
            ? 'intake'
            : preparedUploads.every((item) => item.status === 'queued')
              ? 'intake'
              : 'review'
        );
        setHistoryItems(snapshot.historyItems.length > 0 ? snapshot.historyItems : INITIAL_HISTORY_ITEMS);
        setInspectorObservations(snapshot.inspectorObservations ?? []);
        setReportSectionIdsByCodeArea(snapshot.reportSectionIdsByCodeArea ?? {});
        setReportOriginalSectionNarrativesByCodeArea(snapshot.reportSectionNarrativesByCodeArea ?? {});
        setReportSectionNarrativesByCodeArea(snapshot.reportSectionNarrativesByCodeArea ?? {});
        setReportOriginalExecutiveSummary(snapshot.reportExecutiveSummary ?? '');
        setReportExecutiveSummaryOverride(snapshot.reportExecutiveSummary ?? '');
        setReportActionOriginalItems(snapshot.reportActionItems ?? []);
        setReportActionItems(snapshot.reportActionItems ?? []);
        {
          const hasPersistedReport =
            Boolean((snapshot.reportExecutiveSummary ?? '').trim()) ||
            Object.keys(snapshot.reportSectionNarrativesByCodeArea ?? {}).length > 0 ||
            (snapshot.reportActionItems ?? []).length > 0;
          setHasGeneratedReport(hasPersistedReport);
          setReportNeedsRegeneration(!hasPersistedReport);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load case workspace from data provider', error);
        if (!cancelled) {
          setIsActiveCasePersisted(false);
          setFirestoreRequirementsByCodeArea({});
          setReportSectionIdsByCodeArea({});
          setReportActionOriginalItems([]);
          setReportActionItems([]);
          setReportOriginalSectionNarrativesByCodeArea({});
          setReportSectionNarrativesByCodeArea({});
          setReportOriginalExecutiveSummary('');
          setReportExecutiveSummaryOverride('');
        }
      } finally {
        if (!cancelled) {
          requestAnimationFrame(() => {
            if (cancelled) return;
            setIsWorkspaceLoading(false);
            setCaseOpenTransitionCaseId((prev) => (prev === caseId ? '' : prev));
          });
        }
      }
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [appMode, currentCaseMeta.caseId]);

  useEffect(() => {
    if (appMode !== 'inspection') {
      setProviderSearchResults([]);
      setProviderSearchSupported(false);
      setIsProviderSearchLoading(false);
      return;
    }

    const cleanQuery = docSearchQuery.trim();
    const cleanCaseId = currentCaseMeta.caseId?.trim();
    if (!cleanQuery || !cleanCaseId || !isActiveCasePersisted) {
      setProviderSearchResults([]);
      setProviderSearchSupported(false);
      setIsProviderSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsProviderSearchLoading(true);
      try {
        const response = await searchCase({
          caseId: cleanCaseId,
          query: cleanQuery,
          scope: docSearchScope,
          documentId: docSearchScope === 'document' ? activeDocId : undefined
        });
        if (cancelled) return;
        const supported = Boolean(response?.supported);
        setProviderSearchSupported(supported);
        setProviderSearchResults(supported && Array.isArray(response?.results) ? response.results : []);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to search case via data provider', error);
        if (!cancelled) {
          setProviderSearchSupported(false);
          setProviderSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsProviderSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [appMode, currentCaseMeta.caseId, isActiveCasePersisted, docSearchQuery, docSearchScope, activeDocId]);

  useEffect(() => {
    if (appMode !== 'inspection') return;
    if (currentStep === STEP_OVERVIEW) {
      setFindingViewFilters((prev) =>
        prev.length === 0 ? DEFAULT_FINDING_VIEW_FILTERS : prev
      );
      setViewerCodeAreaFilter('all');
      setFilterSeverity([]);
      setSeverityFilterOpen(false);
      setOverviewFilterOpen(false);
      setViewerTypeFilterOpen(false);
      setViewerCodeAreaFilterOpen(false);
    }
  }, [appMode, currentStep]);

  const docViewerRef = useRef(null);
  const docPdfScrollRef = useRef(null);
  const findingRefs = useRef({});
  const pendingDocBoxRef = useRef(null);
  const caseSetupFileInputRef = useRef(null);
  const documentsUploadInputRef = useRef(null);
  const uploadTableLastRowRef = useRef(null);
  const findingMenuRef = useRef(null);
  const severityFilterRef = useRef(null);
  const overviewFilterRef = useRef(null);
  const viewerTypeFilterRef = useRef(null);
  const viewerCodeAreaFilterRef = useRef(null);
  const reportEditableRefs = useRef({
    interviews: [],
    summary: [],
    goodPractice: [],
    attention: []
  });
  const reportExportRef = useRef(null);
  const reportEditableMetaRefs = useRef({
    interviews: [],
    summary: [],
    goodPractice: [],
    attention: []
  });
  const reportSectionPersistTimersRef = useRef({});
  const lastPersistedCaseSummaryRef = useRef({ caseId: '', key: '' });
  const currentCaseDashboardRowRef = useRef(null);
  const skipNextWorkspaceLoadCaseIdRef = useRef('');

  const completeQueuedUploadClassification = useCallback(async () => {
    const classificationResult = await runSimulatedClassification({
      caseId: isActiveCasePersisted ? currentCaseMeta.caseId : '',
      uploadItems,
      user: currentUser
    });
    const changedUploads = Array.isArray(classificationResult?.changedUploads)
      ? classificationResult.changedUploads
      : [];

    const nextUploads = Array.isArray(classificationResult?.uploadItems) ? classificationResult.uploadItems : uploadItems;
    const nextDocuments = Array.isArray(classificationResult?.documents) ? classificationResult.documents : [];

    if (isActiveCasePersisted && currentCaseMeta.caseId) {
      try {
        const snapshot = await loadCaseWorkspaceData(currentCaseMeta.caseId);
        if (snapshot) {
          const preparedUploads = (snapshot.uploadItems ?? []).map((item) => prepareUploadDraft(item));
          setIsActiveCasePersisted(Boolean(snapshot.caseExists));
          setFirestoreDocuments(snapshot.documents ?? []);
          setFirestoreFindings(snapshot.findings ?? []);
          setFirestoreRequirementsByCodeArea(snapshot.requirementsByCodeArea ?? {});
          setUploadItems(preparedUploads);
          setDocumentsPhase(
            preparedUploads.length === 0
              ? 'intake'
              : preparedUploads.every((item) => item.status === 'queued')
                ? 'intake'
                : 'review'
          );
        } else {
          setUploadItems(nextUploads);
          setFirestoreDocuments(nextDocuments);
          setFirestoreFindings([]);
          setFirestoreRequirementsByCodeArea({});
          setDocumentsPhase(
            nextUploads.length === 0
              ? 'intake'
              : nextUploads.every((item) => prepareUploadDraft(item).status === 'queued')
                ? 'intake'
                : 'review'
          );
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to reload classified workspace snapshot', error);
        setUploadItems(nextUploads);
        setFirestoreDocuments(nextDocuments);
        setFirestoreFindings([]);
        setFirestoreRequirementsByCodeArea({});
        setDocumentsPhase(
          nextUploads.length === 0
            ? 'intake'
            : nextUploads.every((item) => prepareUploadDraft(item).status === 'queued')
              ? 'intake'
              : 'review'
        );
      }
    } else {
      setUploadItems(nextUploads);
      setFirestoreDocuments(nextDocuments);
      setFirestoreFindings([]);
      setFirestoreRequirementsByCodeArea({});
      setDocumentsPhase(
        nextUploads.length === 0
          ? 'intake'
          : nextUploads.every((item) => prepareUploadDraft(item).status === 'queued')
            ? 'intake'
            : 'review'
      );
    }

    setDeletedFindingIds({});
    setFindingDecisions({});
    setFindingNotes({});
    setDocumentNotes({});
    setExpandedCodeAreaIds({});
    setExpandedOverviewFindingIds({});
    setOverviewRequirementFilter({ areaId: '', requirementId: '' });
    setProcessingLog((previous) => [
      {
        id: `p${Date.now()}-classified`,
        detail: `${(changedUploads.length || nextUploads.length)} document${
          (changedUploads.length || nextUploads.length) === 1 ? '' : 's'
        } classified and ready for review`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...previous
    ]);
    setReportNeedsRegeneration(true);
  }, [currentCaseMeta.caseId, currentUser, isActiveCasePersisted, uploadItems]);

  const completeGeneratedFindings = useCallback(async () => {
    const generatedWorkspace = await runSimulatedFindingsGeneration({
      caseId: isActiveCasePersisted ? currentCaseMeta.caseId : '',
      uploadItems,
      user: currentUser
    });
    const generatedFindingIds = new Set(generatedWorkspace.findings.map((finding) => finding.id));
    const generatedDocumentIds = new Set(generatedWorkspace.documents.map((documentRow) => documentRow.id));

    setFirestoreDocuments(generatedWorkspace.documents);
    setFirestoreFindings(generatedWorkspace.findings);
    setFirestoreRequirementsByCodeArea(generatedWorkspace.requirementsByCodeArea);
    setDeletedFindingIds({});
    setFindingDecisions((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([findingId]) => !generatedFindingIds.has(findingId)))
    );
    setFindingNotes((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([findingId]) => !generatedFindingIds.has(findingId)))
    );
    setDocumentNotes((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([documentId]) => !generatedDocumentIds.has(documentId)))
    );
  }, [currentCaseMeta.caseId, currentUser, isActiveCasePersisted, uploadItems]);

  const startProcessingRun = useCallback((mode) => {
    processingStartedAtRef.current = Date.now();
    setAnalysisMode(mode);
    setAnalysisProgress(8);
    setAnalysisRunning(true);
    setCurrentStep(STEP_PROCESSING);
    setMaxStepUnlocked((prev) => Math.max(prev, STEP_PROCESSING));
  }, []);

  useEffect(() => {
    if (!analysisRunning || currentStep !== STEP_PROCESSING) {
      return;
    }

    if (analysisProgress >= 100) {
      let cancelled = false;
      const timeout = setTimeout(() => {
        const finishProcessing = async () => {
          if (cancelled) return;
          try {
            if (analysisMode === PROCESSING_MODE_CLASSIFICATION) {
              await completeQueuedUploadClassification();
              if (cancelled) return;
              setDocumentsPhase('review');
              setCurrentStep(STEP_DOCUMENTS);
              return;
            }

            await completeGeneratedFindings();
            if (cancelled) return;
            setDocumentsPhase('review');
            setMaxStepUnlocked((prev) => Math.max(prev, STEP_OVERVIEW));
            setCurrentStep(STEP_OVERVIEW);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Processing run failed', error);
            if (cancelled) return;
            if (analysisMode === PROCESSING_MODE_CLASSIFICATION) {
              setCurrentStep(STEP_DOCUMENTS);
            } else {
              setCurrentStep(STEP_OVERVIEW);
            }
          } finally {
            if (!cancelled) {
              setAnalysisRunning(false);
              setAnalysisProgress(0);
            }
          }
        };

        void finishProcessing();
      }, 500);
      return () => {
        cancelled = true;
        clearTimeout(timeout);
      };
    }

    const timer = setTimeout(() => {
      const durationMs =
        analysisMode === PROCESSING_MODE_CLASSIFICATION
          ? CLASSIFICATION_PROCESSING_DURATION_MS
          : FINDINGS_PROCESSING_DURATION_MS;
      setAnalysisProgress((prev) => {
        const startedAt = processingStartedAtRef.current || Date.now();
        const elapsedMs = Math.max(0, Date.now() - startedAt);
        const progress = 8 + (elapsedMs / durationMs) * 92;
        return Math.max(prev, Math.min(100, progress));
      });
    }, Math.max(140, Math.floor(ANALYSIS_TICK_INTERVAL_MS / 8)));

    return () => clearTimeout(timer);
  }, [
    analysisMode,
    analysisRunning,
    analysisProgress,
    completeGeneratedFindings,
    completeQueuedUploadClassification,
    currentStep
  ]);

  useEffect(() => {
    const previousStep = previousStepRef.current;
    if (previousStep === STEP_PROCESSING && currentStep !== STEP_PROCESSING && analysisRunning) {
      setAnalysisRunning(false);
      setAnalysisProgress(0);
    }
    previousStepRef.current = currentStep;
  }, [currentStep, analysisRunning]);

  useEffect(() => {
    if (!docPulse) return;
    const timer = setTimeout(() => setDocPulse(null), 1200);
    return () => clearTimeout(timer);
  }, [docPulse]);

  useEffect(() => {
    if (currentStep === STEP_VIEWER || viewerSelectionHistory.length === 0) return;
    setViewerSelectionHistory([]);
  }, [currentStep, viewerSelectionHistory.length]);

  useEffect(() => {
    if (!leadConfirmModal.open) return;
    if (currentStep === STEP_VIEWER) return;
    setLeadConfirmModal((prev) => ({ ...prev, open: false }));
  }, [currentStep, leadConfirmModal.open]);

  useEffect(
    () => () => {
      Object.values(reportSectionPersistTimersRef.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
      reportSectionPersistTimersRef.current = {};
    },
    []
  );

  useEffect(() => {
    const cleanCaseId = String(currentCaseMeta.caseId || '').trim();
    if (lastPersistedCaseSummaryRef.current.caseId !== cleanCaseId) {
      lastPersistedCaseSummaryRef.current = { caseId: cleanCaseId, key: '' };
    }
  }, [currentCaseMeta.caseId]);

  useEffect(() => {
    if (!undoDecision) return;
    const timer = setTimeout(() => setUndoDecision(null), 6000);
    return () => clearTimeout(timer);
  }, [undoDecision]);

  useEffect(() => {
    if (!activeMenuFindingId) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.finding-menu') || target.closest('.finding-more')) return;
      setActiveMenuFindingId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [activeMenuFindingId]);

  useEffect(() => {
    if (!severityFilterOpen) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-dropdown-wrap')) return;
      setSeverityFilterOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [severityFilterOpen]);

  useEffect(() => {
    if (!overviewFilterOpen) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-dropdown-wrap')) return;
      setOverviewFilterOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [overviewFilterOpen]);

  useEffect(() => {
    if (!viewerTypeFilterOpen) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-dropdown-wrap')) return;
      setViewerTypeFilterOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [viewerTypeFilterOpen]);

  useEffect(() => {
    if (!viewerCodeAreaFilterOpen) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-dropdown-wrap')) return;
      setViewerCodeAreaFilterOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [viewerCodeAreaFilterOpen]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setActiveMenuFindingId(null);
      setNoteTargetFindingId(null);
      setInlineRejectFindingId(null);
      setInlineDismissFindingId(null);
      setFeedbackOpen(false);
      setContextNoteOpen(false);
      setDocLevelNoteOpen(false);
      setDocCrossSearchOpen(false);
      setSeverityFilterOpen(false);
      setOverviewFilterOpen(false);
      setViewerTypeFilterOpen(false);
      setViewerCodeAreaFilterOpen(false);
      setReportPendingChanges(false);
      setReportPendingGateOpen(false);
      setReportRegenerateConfirmOpen(false);
      setComposerModal((prev) => ({ ...prev, open: false }));
      setReggieOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    setMaxStepUnlocked((prev) => (currentStep > prev ? currentStep : prev));
  }, [currentStep]);

  const preparedWorkspace = useMemo(
    () =>
      prepareWorkspaceSnapshot({
        documents: firestoreDocuments,
        findings: firestoreFindings,
        uploadItems
      }),
    [firestoreDocuments, firestoreFindings, uploadItems]
  );

  const caseDocuments = preparedWorkspace.documents;
  const baseFindings = preparedWorkspace.findings;
  const requirementsByCodeArea = useMemo(() => {
    const hasFirestoreRequirements = Object.keys(firestoreRequirementsByCodeArea).length > 0;
    return hasFirestoreRequirements ? firestoreRequirementsByCodeArea : CODE_AREA_REQUIREMENT_SAMPLES;
  }, [firestoreRequirementsByCodeArea]);

  useEffect(() => {
    if (caseDocuments.length === 0) {
      setActiveDocId('');
      setActiveDocBoxId(null);
      return;
    }
    if (!activeDocId || !caseDocuments.some((entry) => entry.id === activeDocId)) {
      const firstDocWithBoxes = caseDocuments.find((entry) => (entry?.overlay?.boxes?.length ?? 0) > 0);
      const firstDoc = firstDocWithBoxes ?? caseDocuments[0];
      setActiveDocId(firstDoc.id);
      setActiveDocBoxId(firstDoc?.overlay?.boxes?.[0]?.id ?? null);
    }
  }, [activeDocId, caseDocuments]);

  const documentsById = useMemo(() => {
    const entries = caseDocuments.map((doc) => [doc.id, doc]);
    return new Map(entries);
  }, [caseDocuments]);

  const allFindings = useMemo(() => {
    const seenIds = new Set();
    const seenSemanticKeys = new Set();

    return [...baseFindings, ...inspectorFindings].filter((finding) => {
      const idKey = coerceText(finding?.id).trim().toLowerCase();
      if (idKey) {
        if (seenIds.has(idKey)) return false;
        seenIds.add(idKey);
      }

      if (isInspectorAddedFinding(finding)) return true;

      const titleKey = coerceText(finding?.title)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ');
      const documentKey = [...buildFilenameKeySet([
        finding?.documentId,
        finding?.document_id,
        finding?.source?.file
      ])][0] ?? '';
      const scopeKey =
        coerceText(finding?.requirementId || finding?.requirement_id).trim().toLowerCase() ||
        coerceText(finding?.codeArea || finding?.code_area).trim().toLowerCase();
      const semanticKey = titleKey && documentKey ? `${titleKey}|${documentKey}|${scopeKey}` : '';

      if (semanticKey) {
        if (seenSemanticKeys.has(semanticKey)) return false;
        seenSemanticKeys.add(semanticKey);
      }
      return true;
    });
  }, [baseFindings, inspectorFindings]);
  const resolvedFindingDecisions = useMemo(() => {
    const next = { ...findingDecisions };
    allFindings.forEach((finding) => {
      const findingId = coerceText(finding?.id);
      if (!findingId || next[findingId]) return;
      const normalizedReviewStatus = String(finding?.reviewStatus || finding?.review_status || '')
        .trim()
        .toLowerCase();
      if (normalizedReviewStatus === 'accepted' || normalizedReviewStatus === 'confirmed') {
        next[findingId] = 'accepted';
      } else if (normalizedReviewStatus === 'rejected') {
        next[findingId] = 'rejected';
      } else if (normalizedReviewStatus === 'dismissed') {
        next[findingId] = 'dismissed';
      }
    });
    return next;
  }, [allFindings, findingDecisions]);

  const getFindingBucketId = useCallback(
    (finding) => getFindingDisplayBucketId(finding, resolvedFindingDecisions[finding?.id]),
    [resolvedFindingDecisions]
  );
  const isOverturnedFinding = useCallback(
    (finding) => isFindingOverturned(finding, resolvedFindingDecisions[finding?.id]),
    [resolvedFindingDecisions]
  );
  const getFindingReviewDisplayState = useCallback(
    (finding) => getFindingDisplayDecisionState(finding, resolvedFindingDecisions[finding?.id]),
    [resolvedFindingDecisions]
  );

  const replaceFindingState = useCallback((findingId, nextFindingState) => {
    if (!findingId || !nextFindingState) return;

    const applyReplacement = (prev) => {
      let changed = false;
      const next = prev.map((entry) => {
        if (entry.id !== findingId) return entry;
        changed = true;
        return nextFindingState;
      });
      return changed ? next : prev;
    };

    setFirestoreFindings(applyReplacement);
    setInspectorFindings(applyReplacement);
  }, []);

  const buildNextFindingStateForDecision = useCallback((
    finding,
    nextDecision,
    reason = '',
    reasonNote = '',
    findingOverrides = {}
  ) => {
    if (!finding || typeof finding !== 'object') return null;
    const baseFinding = { ...finding, ...findingOverrides };
    const certainty = String(baseFinding?.certainty || '').trim().toLowerCase();
    const existingReviewStatus = String(
      baseFinding?.reviewStatus || baseFinding?.review_status || ''
    )
      .trim()
      .toLowerCase();
    const originalCertainty = String(
      baseFinding?.originalCertainty || baseFinding?.original_certainty || ''
    )
      .trim()
      .toLowerCase();

    let reviewStatus = 'unreviewed';
    if (nextDecision === 'accepted') {
      reviewStatus =
        certainty === 'lead' &&
        !['confirmed', 'accepted', 'rejected'].includes(existingReviewStatus)
          ? 'confirmed'
          : 'accepted';
    } else if (nextDecision === 'rejected') {
      reviewStatus = 'rejected';
    } else if (nextDecision === 'dismissed') {
      reviewStatus = 'dismissed';
    }

    const shouldPromoteLeadToFinding = nextDecision === 'accepted' && certainty === 'lead';
    const shouldRestoreOriginalLead =
      (nextDecision === null || nextDecision === 'unreviewed') &&
      (originalCertainty === 'lead' || (existingReviewStatus === 'confirmed' && certainty === 'finding'));
    const nextCertainty = shouldRestoreOriginalLead
      ? 'lead'
      : shouldPromoteLeadToFinding
        ? 'finding'
        : baseFinding?.certainty;

    const nextFindingState = {
      ...baseFinding,
      certainty: nextCertainty,
      originalCertainty:
        shouldPromoteLeadToFinding
          ? originalCertainty || 'lead'
          : baseFinding?.originalCertainty || baseFinding?.original_certainty || null,
      reviewStatus,
      reviewReason: nextDecision === 'rejected' || nextDecision === 'dismissed' ? reason || null : null,
      reviewReasonNote: nextDecision === 'rejected' || nextDecision === 'dismissed' ? reasonNote || null : null
    };

    return {
      ...nextFindingState,
      severity: deriveLegacyFindingSeverity(nextFindingState)
    };
  }, []);

  const findingByDocAndBox = useMemo(() => {
    const map = new Map();
    const registerFindingBox = (documentId, boxId, finding) => {
      const cleanDocumentId = coerceText(documentId);
      const cleanBoxId = coerceText(boxId);
      if (!cleanDocumentId || !cleanBoxId) return;
      const key = `${cleanDocumentId}:${cleanBoxId}`;
      if (!map.has(key)) {
        map.set(key, finding);
      }
    };

    allFindings.forEach((finding) => {
      registerFindingBox(finding?.documentId, finding?.boxId, finding);

      const rawPassages = Array.isArray(finding?.evidence_passages)
        ? finding.evidence_passages
        : Array.isArray(finding?.evidencePassages)
          ? finding.evidencePassages
          : [];
      rawPassages.forEach((passage) => {
        registerFindingBox(
          passage?.document_id || passage?.documentId || finding?.documentId,
          passage?.box_id || passage?.boxId,
          finding
        );
      });
    });
    return map;
  }, [allFindings]);

  const activeDocument = documentsById.get(activeDocId) ?? caseDocuments[0] ?? null;
  useEffect(() => {
    if (currentStep !== STEP_VIEWER && activeGuidanceContext) {
      setActiveGuidanceContext(null);
      setGuidanceReturnContext(null);
    }
  }, [activeGuidanceContext, currentStep]);
  const activeViewerFinding = useMemo(
    () => allFindings.find((finding) => finding?.id === activeFindingId) ?? null,
    [activeFindingId, allFindings]
  );
  const activeViewerFindingDocumentIds = useMemo(() => {
    if (!activeViewerFinding) return [];

    const ids = [];
    const pushId = (value) => {
      const cleanId = coerceText(value);
      if (!cleanId || ids.includes(cleanId) || !documentsById.has(cleanId)) return;
      ids.push(cleanId);
    };

    pushId(activeViewerFinding.documentId);

    const rawPassages = Array.isArray(activeViewerFinding?.evidence_passages)
      ? activeViewerFinding.evidence_passages
      : Array.isArray(activeViewerFinding?.evidencePassages)
        ? activeViewerFinding.evidencePassages
        : [];
    rawPassages.forEach((passage) => {
      pushId(passage?.document_id || passage?.documentId);
    });

    return ids;
  }, [activeViewerFinding, documentsById]);
  const viewerDocumentSequence = useMemo(() => {
    if (activeViewerFindingDocumentIds.length === 0) return caseDocuments;
    return activeViewerFindingDocumentIds
      .map((docId) => documentsById.get(docId))
      .filter(Boolean);
  }, [activeViewerFindingDocumentIds, caseDocuments, documentsById]);
  const viewerDocumentIndex = useMemo(
    () => viewerDocumentSequence.findIndex((doc) => doc.id === activeDocId),
    [activeDocId, viewerDocumentSequence]
  );
  const activeFindingForDocument = useMemo(() => {
    const cleanDocId = coerceText(activeDocId);
    if (!cleanDocId) return null;

    if (activeViewerFinding && findingReferencesDocument(activeViewerFinding, cleanDocId)) {
      return activeViewerFinding;
    }

    return (
      allFindings.find((finding) => findingReferencesDocument(finding, cleanDocId)) ??
      null
    );
  }, [activeDocId, activeViewerFinding, allFindings]);

  const activeDocBoxes = useMemo(() => {
    const documentBoxes = Array.isArray(activeDocument?.overlay?.boxes)
      ? activeDocument.overlay.boxes
      : [];

    if (!activeFindingForDocument) {
      return documentBoxes;
    }

    const relevantBoxIds = collectFindingBoxIdsForDocument(activeFindingForDocument, activeDocId);
    if (relevantBoxIds.size === 0) {
      return documentBoxes;
    }

    const relatedPrefixes = new Set(
      [...relevantBoxIds]
        .map((boxId) => coerceText(boxId).replace(/-p\d+$/u, ''))
        .filter(Boolean)
    );
    const preferredBoxPrefix = coerceText(activeFindingForDocument?.boxId).replace(/-p\d+$/u, '');
    const findingIdPrefix = coerceText(activeFindingForDocument?.id).replace(/-p\d+$/u, '');
    if (preferredBoxPrefix) relatedPrefixes.add(preferredBoxPrefix);
    if (findingIdPrefix) relatedPrefixes.add(findingIdPrefix);

    const findingBoxes = documentBoxes.filter((box) => {
      const boxId = coerceText(box?.id);
      if (!boxId) return false;
      if (relevantBoxIds.has(boxId)) return true;
      return [...relatedPrefixes].some((prefix) => boxId === prefix || boxId.startsWith(`${prefix}-p`));
    });
    const selectedBoxes = findingBoxes.length > 0 ? findingBoxes : documentBoxes;

    return selectedBoxes.map((box) => {
      const match =
        findingByDocAndBox.get(`${activeDocId}:${coerceText(box?.id)}`) ??
        activeFindingForDocument;
      const bucket = match ? getFindingBucketId(match) : box?.severity || 'warning';
      return {
        ...box,
        severity: bucket,
        polarity: match?.polarity || (bucket === 'pass' || bucket === 'best_practice' ? 'compliant' : 'non_compliant'),
        certainty: match ? getFindingEffectiveCertainty(match) : bucket === 'warning' ? 'lead' : 'finding'
      };
    });
  }, [activeDocument, activeFindingForDocument, activeDocId, findingByDocAndBox]);
  const activeDocMinimapMarkers = useMemo(() => {
    const safeBoxes = activeDocBoxes.filter(
      (box) => box && typeof box === 'object' && typeof box.id === 'string'
    );
    const total = Math.max(safeBoxes.length, 1);
    return safeBoxes.map((box, index) => {
      const key = `${activeDocId}:${box.id}`;
      const finding = findingByDocAndBox.get(key);
      const severity = finding ? getFindingBucketId(finding) : box?.severity ?? 'warning';
      const topPercent = Number.isFinite(box.page)
        ? Math.min(96, Math.max(4, (box.page / 20) * 100))
        : Math.min(96, Math.max(4, ((index + 1) / (total + 1)) * 100));
      return { id: box.id, topPercent, severity };
    });
  }, [activeDocBoxes, activeDocId, findingByDocAndBox]);
  const leadConfirmFinding = useMemo(
    () => allFindings.find((finding) => finding?.id === leadConfirmModal.findingId) ?? null,
    [allFindings, leadConfirmModal.findingId]
  );

  useEffect(() => {
    const doc = documentsById.get(activeDocId);
    if (!doc) return;
    const fallbackBox = doc.overlay?.boxes?.[0]?.id ?? null;
    if (!doc.overlay?.boxes?.some((box) => box.id === activeDocBoxId)) {
      setActiveDocBoxId(fallbackBox);
    }
  }, [activeDocId, documentsById, activeDocBoxId]);

  const activeProcessingSteps =
    analysisMode === PROCESSING_MODE_CLASSIFICATION
      ? CLASSIFICATION_PROCESSING_STEPS
      : AI_PROCESSING_STEPS;
  const activeProcessingMessages =
    analysisMode === PROCESSING_MODE_CLASSIFICATION
      ? CLASSIFICATION_PROCESSING_MESSAGES
      : AI_PROCESSING_MESSAGES;
  const analysisTitle =
    analysisMode === PROCESSING_MODE_CLASSIFICATION
      ? 'AI classification in progress'
      : 'AI findings generation in progress';
  const analysisCompletionLabel =
    analysisMode === PROCESSING_MODE_CLASSIFICATION ? 'Classification Review' : 'Findings';
  const analysisStageIndex = Math.min(
    activeProcessingSteps.length - 1,
    Math.floor((analysisProgress / 100) * activeProcessingSteps.length)
  );

  const analysisMessage =
    activeProcessingMessages[Math.min(activeProcessingMessages.length - 1, analysisStageIndex)] ??
    activeProcessingMessages[0];

  const availableFindings = useMemo(
    () => allFindings.filter((finding) => !deletedFindingIds[finding.id]),
    [allFindings, deletedFindingIds]
  );

  const severityCounts = useMemo(() => {
    const counts = {
      critical: 0,
      warning: 0,
      pass: 0,
      best_practice: 0
    };

    for (const finding of availableFindings) {
      const bucket = getFindingBucketId(finding);
      if (Object.prototype.hasOwnProperty.call(counts, bucket)) {
        counts[bucket] += 1;
      }
    }

    return [
      { id: 'critical', label: 'Non-compliant', count: counts.critical },
      { id: 'warning', label: 'Inconclusive', count: counts.warning },
      { id: 'pass', label: 'Compliant', count: counts.pass },
      { id: 'best_practice', label: 'Good Practice', count: counts.best_practice }
    ];
  }, [availableFindings]);

  const toggleFindingViewFilter = useCallback((filterKey) => {
    if (filterKey === 'all') {
      setFindingViewFilters([]);
      return;
    }

    setFindingViewFilters((prev) =>
      prev.includes(filterKey) ? prev.filter((entry) => entry !== filterKey) : [...prev, filterKey]
    );
  }, []);

  const clearFindingViewFilters = useCallback(() => {
    setFindingViewFilters([]);
  }, []);

  const resetFindingViewFiltersToDefault = useCallback(() => {
    setFindingViewFilters(DEFAULT_FINDING_VIEW_FILTERS);
  }, []);

  const filteredFindings = availableFindings
    .filter((finding) => (filterSeverity.length === 0 ? true : filterSeverity.includes(getFindingBucketId(finding))))
    .filter((finding) => {
      if (findingViewFilters.length === 0) return true;

      const state = resolvedFindingDecisions[finding.id] ?? 'unreviewed';
      const bucket = getFindingBucketId(finding);
      const evidenceStrengthKey = FINDING_EVIDENCE_STRENGTH_MAP[bucket]?.key ?? 'supported';

      return findingViewFilters.some((filterKey) => {
        if (filterKey === 'unreviewed') return state === 'unreviewed';
        if (filterKey === 'reviewed') return state !== 'unreviewed';
        if (filterKey === 'leads') return isLeadFindingByTaxonomy(finding);
        if (filterKey === 'non_compliant') return bucket === 'critical';
        if (filterKey === 'compliant') return bucket === 'pass';
        if (filterKey === 'good_practice') return bucket === 'best_practice';
        if (filterKey === 'inspector_added') return isInspectorAddedFinding(finding);
        if (filterKey === 'strong') return evidenceStrengthKey === 'strong';
        if (filterKey === 'supported') return evidenceStrengthKey === 'supported';
        if (filterKey === 'indicative') return evidenceStrengthKey === 'indicative';
        return false;
      });
    });

  const overviewFilteredFindings = filteredFindings.filter((finding) => {
    const reviewState = resolvedFindingDecisions[finding.id] ?? 'unreviewed';
    if (overviewFindingScope === 'closed') return reviewState !== 'unreviewed';
    if (overviewFindingScope === 'all') return true;
    return reviewState === 'unreviewed';
  });

  const reviewedCount = availableFindings.filter((finding) => Boolean(resolvedFindingDecisions[finding.id])).length;
  const pendingReviewCount = Math.max(availableFindings.length - reviewedCount, 0);
  const rejectedCount = useMemo(
    () => availableFindings.filter((finding) => resolvedFindingDecisions[finding.id] === 'rejected').length,
    [availableFindings, resolvedFindingDecisions]
  );
  const allFindingsRejectedOrDismissed = useMemo(
    () =>
      availableFindings.length > 0 &&
      availableFindings.every(
        (finding) =>
          getFindingReviewDisplayState(finding) === 'rejected' ||
          getFindingReviewDisplayState(finding) === 'dismissed'
      ),
    [availableFindings, getFindingReviewDisplayState]
  );
  const metRequirementsCount = useMemo(
    () =>
      Object.values(requirementsByCodeArea)
        .flat()
        .filter((entry) => isRequirementMet(entry.status)).length,
    [requirementsByCodeArea]
  );
  const goodPracticeAreaCount = useMemo(
    () => {
      const areas = new Set();
      availableFindings.forEach((entry) => {
        if (getFindingBucketId(entry) !== 'best_practice') return;
        const codeArea = String(entry.codeArea || entry.code_area || '')
          .trim()
          .toLowerCase();
        if (codeArea) areas.add(codeArea);
      });
      return areas.size;
    },
    [availableFindings]
  );
  const criticalCount = severityCounts.find((entry) => entry.id === 'critical')?.count ?? 0;
  const leadCount = severityCounts.find((entry) => entry.id === 'warning')?.count ?? 0;
  const goodPracticeCount = severityCounts.find((entry) => entry.id === 'best_practice')?.count ?? 0;
  const derivedCaseLifecycle = useMemo(() => {
    const criticalCount = severityCounts.find((entry) => entry.id === 'critical')?.count ?? 0;
    const warningCount = severityCounts.find((entry) => entry.id === 'warning')?.count ?? 0;
    const wasCompleted = currentCaseMeta.status === 'completed';
    const canRemainCompleted = hasGeneratedReport && !reportNeedsRegeneration && pendingReviewCount === 0;
    const shouldBeCompleted =
      (currentStep === STEP_REPORT && canRemainCompleted) || (wasCompleted && canRemainCompleted);
    const status = shouldBeCompleted ? 'completed' : 'active';
    const outcome = shouldBeCompleted
      ? criticalCount > 0
        ? 'non_compliant'
        : warningCount > 0
          ? 'generally_compliant'
          : 'compliant'
      : 'in_progress';
    return { status, outcome };
  }, [
    currentCaseMeta.status,
    currentStep,
    hasGeneratedReport,
    pendingReviewCount,
    reportNeedsRegeneration,
    severityCounts
  ]);
  const currentCaseDashboardRow = useMemo(() => {
    const activeCaseId = coerceText(currentCaseMeta.caseId);
    if (!isActiveCasePersisted || !activeCaseId) return null;

    const flattenedRequirements = Object.values(requirementsByCodeArea).flatMap((rows) => (Array.isArray(rows) ? rows : []));
    const findingsByRequirement = new Map();

    availableFindings.forEach((finding) => {
      const requirementId = coerceText(finding?.requirementId || finding?.requirement_id);
      if (!requirementId) return;
      const rows = findingsByRequirement.get(requirementId) ?? [];
      rows.push(finding);
      findingsByRequirement.set(requirementId, rows);
    });

    const reviewedRequirements = flattenedRequirements.reduce((count, requirement) => {
      const relatedFindings = findingsByRequirement.get(coerceText(requirement?.id)) ?? [];
      if (relatedFindings.length === 0) return count;
      return relatedFindings.every((finding) => Boolean(resolvedFindingDecisions[finding.id])) ? count + 1 : count;
    }, 0);

    const totalRequirements = flattenedRequirements.length;
    const progress = totalRequirements > 0 ? Math.round((reviewedRequirements / totalRequirements) * 100) : 100;
    const progressLabel =
      totalRequirements > 0 ? `${reviewedRequirements}/${totalRequirements} requirements reviewed` : 'No requirements generated';

    return {
      id: activeCaseId,
      practice: currentCaseMeta.practiceName || 'Unknown practice',
      started: currentCaseMeta.started || new Date().toLocaleDateString(),
      startedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActivityAt: Date.now(),
      progress,
      progressLabel,
      unreviewed: pendingReviewCount,
      leads: leadCount,
      goodPractice: goodPracticeCount,
      risk: currentCaseMeta.riskLevel || 'Not assessed',
      lastActivity: 'Just now',
      inspector: currentCaseMeta.owner || currentUserEmail || 'Inspector',
      inspectorId: currentUser?.uid ?? '',
      inspectorEmail: currentUserEmail,
      owner: currentCaseMeta.owner || currentUserEmail || 'Inspector',
      ownerEmail: currentUserEmail,
      assignedInspectorUserId: currentUser?.uid ?? '',
      assignedInspectorEmail: currentUserEmail,
      createdByUserId: currentUser?.uid ?? '',
      status: derivedCaseLifecycle.status,
      outcome: derivedCaseLifecycle.outcome
    };
  }, [
    availableFindings,
    currentCaseMeta.caseId,
    currentCaseMeta.owner,
    currentCaseMeta.practiceName,
    currentCaseMeta.riskLevel,
    currentCaseMeta.status,
    currentCaseMeta.started,
    currentUser?.uid,
    currentUserEmail,
    derivedCaseLifecycle.outcome,
    derivedCaseLifecycle.status,
    goodPracticeCount,
    isActiveCasePersisted,
    leadCount,
    pendingReviewCount,
    requirementsByCodeArea,
    resolvedFindingDecisions
  ]);
  useEffect(() => {
    currentCaseDashboardRowRef.current = currentCaseDashboardRow;
  }, [currentCaseDashboardRow]);
  const allRequirementsMet =
    caseDocuments.length > 0 &&
    availableFindings.length > 0 &&
    pendingReviewCount === 0 &&
    criticalCount === 0 &&
    leadCount === 0;
  const isDemoSeedCase = currentCaseMeta.caseId === 'DEMO-12345';
  const allRequirementsMetDetail = `${goodPracticeCount} good practice area${
    goodPracticeCount === 1 ? '' : 's'
  } identified across ${Math.max(goodPracticeAreaCount, 1)} code area${
    Math.max(goodPracticeAreaCount, 1) === 1 ? '' : 's'
  }.`;
  const showHighRejectionPrompt =
    reviewedCount > 0 && rejectedCount / reviewedCount > 0.5 && !highRejectionPromptDismissed;

  useEffect(() => {
    setHighRejectionPromptDismissed(false);
  }, [currentCaseMeta.caseId]);

  useEffect(() => {
    if (!(reviewedCount > 0 && rejectedCount / reviewedCount > 0.5)) {
      setHighRejectionPromptDismissed(false);
    }
  }, [rejectedCount, reviewedCount]);

  useEffect(() => {
    if (availableFindings.length > 0) {
      setReportAccessNotice('');
    }
  }, [availableFindings.length]);

  const codeAreaDisplayMap = useMemo(() => {
    const base = new Map();
    FOCUS_AREA_OPTIONS.forEach((area) => base.set(area.id, area.label));
    return base;
  }, []);

  const normalizeCodeAreaId = useCallback((value) => {
    const raw = textOf(value, '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'all') return 'all';

    const normalized = raw.replace(/[^a-z0-9]+/g, ' ').trim();
    if (CODE_AREA_ALIASES[raw]) return CODE_AREA_ALIASES[raw];
    if (CODE_AREA_ALIASES[normalized]) return CODE_AREA_ALIASES[normalized];

    if (raw.includes('aml') || normalized.includes('money laundering') || normalized.includes('ctf')) {
      return 'aml';
    }
    if (
      normalized.includes('code of conduct') ||
      normalized.includes('complaint') ||
      normalized.includes('client care') ||
      normalized.includes('engagement')
    ) {
      return 'code-of-conduct';
    }
    if (normalized.includes('account') || normalized.includes('reconciliation')) return 'accounts';
    if (normalized.includes('management') || normalized.includes('supervision')) return 'management';
    if (normalized.includes('undertaking')) return 'undertakings';

    if (codeAreaDisplayMap.has(raw)) return raw;
    return raw;
  }, [codeAreaDisplayMap]);

  const formatCodeAreaLabel = useCallback(
    (value) => {
      const normalized = normalizeCodeAreaId(value);
      if (!normalized) return 'General';
      if (codeAreaDisplayMap.has(normalized)) return codeAreaDisplayMap.get(normalized);
      return textOf(value, 'General');
    },
    [codeAreaDisplayMap, normalizeCodeAreaId]
  );
  const notApplicableAreas = useMemo(
    () =>
      Object.entries(requirementsByCodeArea)
        .flatMap(([codeAreaId, rows]) =>
          (Array.isArray(rows) ? rows : [])
            .filter((entry) => isRequirementExcluded(entry.status))
            .map((entry) => `${formatCodeAreaLabel(codeAreaId)}: ${safeText(entry.label, entry.id)}`)
        )
        .filter(Boolean),
    [formatCodeAreaLabel, requirementsByCodeArea]
  );
  const persistedNotAssessedAreas = useMemo(() => {
    const selectedFocusAreas = new Set(
      (Array.isArray(currentCaseMeta.focusAreas) ? currentCaseMeta.focusAreas : [])
        .map((entry) => normalizeCodeAreaId(entry))
        .filter(Boolean)
    );
    const requirementAreaIds = new Set(
      Object.keys(requirementsByCodeArea)
        .map((entry) => normalizeCodeAreaId(entry))
        .filter(Boolean)
    );

    if (selectedFocusAreas.size > 0) {
      const scopedAreaIds =
        requirementAreaIds.size > 0
          ? Array.from(requirementAreaIds)
          : FOCUS_AREA_OPTIONS.map((area) => area.id);
      return scopedAreaIds
        .filter((areaId) => !selectedFocusAreas.has(areaId))
        .map((areaId) => ({ id: areaId, label: formatCodeAreaLabel(areaId) }))
        .sort((left, right) => left.label.localeCompare(right.label))
        .map((area) => area.label);
    }

    return Object.entries(requirementsByCodeArea)
      .flatMap(([codeAreaId, rows]) =>
        (Array.isArray(rows) ? rows : [])
          .filter((entry) => String(entry?.status || '').trim().toLowerCase() === 'not_assessed')
          .map((entry) => `${formatCodeAreaLabel(codeAreaId)}: ${safeText(entry.label, entry.id)}`)
      )
      .filter(Boolean);
  }, [currentCaseMeta.focusAreas, formatCodeAreaLabel, normalizeCodeAreaId, requirementsByCodeArea, safeText]);
  const effectiveNotAssessedAreas = isActiveCasePersisted ? persistedNotAssessedAreas : notAssessedAreas;
  const requirementsById = useMemo(() => {
    const lookup = new Map();
    Object.entries(requirementsByCodeArea).forEach(([codeAreaId, rows]) => {
      (Array.isArray(rows) ? rows : []).forEach((entry) => {
        if (!entry?.id) return;
        lookup.set(entry.id, {
          ...entry,
          codeAreaId: entry.codeAreaId || codeAreaId
        });
      });
    });
    return lookup;
  }, [requirementsByCodeArea]);
  const reportStale = hasGeneratedReport && reportNeedsRegeneration && !isDemoSeedCase;
  const overviewSummaryCards = useMemo(() => {
    const compliantCount = availableFindings.filter((finding) => getFindingBucketId(finding) === 'pass').length;
    const goodPracticeAreas = new Set();
    const unresolvedLeadCount = availableFindings.filter((finding) => {
      if (!isLeadFindingByTaxonomy(finding)) return false;
      return (resolvedFindingDecisions[finding.id] ?? 'unreviewed') === 'unreviewed';
    }).length;

    availableFindings.forEach((finding) => {
      const areaId = normalizeCodeAreaId(textOf(finding.codeArea || finding.code_area, ''));
      if (!areaId) return;
      if (getFindingBucketId(finding) === 'best_practice') {
        goodPracticeAreas.add(areaId);
      }
    });

    return [
      {
        id: 'attention',
        label: 'Non-compliant',
        value: criticalCount,
        detail: criticalCount > 0 ? `${criticalCount} confirmed non-compliant finding${criticalCount === 1 ? '' : 's'}` : 'none confirmed',
        tone: 'attention',
        active: findingViewFilters.includes('non_compliant'),
        onClick: () => toggleFindingViewFilter('non_compliant')
      },
      {
        id: 'review',
        label: 'Inconclusive',
        value: unresolvedLeadCount,
        detail:
          unresolvedLeadCount > 0
            ? `${unresolvedLeadCount} awaiting judgment`
            : 'none awaiting judgment',
        tone: 'review',
        active: findingViewFilters.includes('leads'),
        onClick: () => toggleFindingViewFilter('leads')
      },
      {
        id: 'compliant',
        label: 'Compliant',
        value: compliantCount,
        detail: compliantCount > 0 ? `${compliantCount} compliant finding${compliantCount === 1 ? '' : 's'}` : 'none identified',
        tone: 'pass',
        active: findingViewFilters.includes('compliant'),
        onClick: () => toggleFindingViewFilter('compliant')
      },
      {
        id: 'good',
        label: 'Good Practice',
        value: goodPracticeCount,
        detail:
          goodPracticeCount > 0
            ? `across ${goodPracticeAreas.size} code area${goodPracticeAreas.size === 1 ? '' : 's'}`
            : 'none highlighted',
        tone: 'good',
        active: findingViewFilters.includes('good_practice'),
        onClick: () => toggleFindingViewFilter('good_practice')
      }
    ];
  }, [
    availableFindings,
    criticalCount,
    findingViewFilters,
    goodPracticeCount,
    normalizeCodeAreaId,
    resolvedFindingDecisions,
    toggleFindingViewFilter
  ]);
  const hasDefaultFindingViewFilters = useMemo(() => {
    if (findingViewFilters.length !== DEFAULT_FINDING_VIEW_FILTERS.length) return false;
    const current = [...findingViewFilters].sort();
    const baseline = [...DEFAULT_FINDING_VIEW_FILTERS].sort();
    return current.every((entry, index) => entry === baseline[index]);
  }, [findingViewFilters]);
  const activeSeverityLabels = filterSeverity.map((key) => SEVERITY_LABEL_MAP[key] ?? key);

  const complianceCodeAreas = useMemo(() => {
    const map = new Map();
    const registerAreaId = (rawAreaId) => {
      const normalized = normalizeCodeAreaId(rawAreaId);
      if (!normalized) return;
      if (!map.has(normalized)) {
        map.set(normalized, {
          id: normalized,
          name: formatCodeAreaLabel(normalized),
          met: '0/0'
        });
      }
    };

    availableFindings.forEach((finding) => {
      registerAreaId(textOf(finding.codeArea || finding.code_area, ''));
    });

    Object.entries(requirementsByCodeArea).forEach(([areaId, rows]) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      registerAreaId(areaId);
    });

    const knownOrder = new Map(FOCUS_AREA_OPTIONS.map((area, index) => [area.id, index]));

    return Array.from(map.values()).sort((left, right) => {
      const leftIndex = knownOrder.get(left.id);
      const rightIndex = knownOrder.get(right.id);
      if (leftIndex !== undefined && rightIndex !== undefined && leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      if (leftIndex !== undefined && rightIndex === undefined) return -1;
      if (leftIndex === undefined && rightIndex !== undefined) return 1;
      return left.name.localeCompare(right.name);
    });
  }, [availableFindings, formatCodeAreaLabel, normalizeCodeAreaId, requirementsByCodeArea]);

  const reportIncludedFindings = useMemo(() => {
    return availableFindings.filter((finding) => {
      const decision = resolvedFindingDecisions[finding.id] ?? 'unreviewed';
      return decision !== 'dismissed' && (decision !== 'rejected' || isOverturnedFinding(finding));
    });
  }, [availableFindings, resolvedFindingDecisions, isOverturnedFinding]);

  const reportGoodPracticeFindings = useMemo(
    () => reportIncludedFindings.filter((finding) => getFindingBucketId(finding) === 'best_practice'),
    [reportIncludedFindings]
  );

  const reportAttentionFindings = useMemo(
    () => reportIncludedFindings.filter((finding) => {
      const bucket = getFindingBucketId(finding);
      return bucket === 'critical' || bucket === 'warning';
    }),
    [reportIncludedFindings]
  );

  const reportAppendixRows = useMemo(
    () =>
      reportIncludedFindings.map((finding, index) => ({
        id: `F-${String(index + 1).padStart(3, '0')}`,
        finding: textOf(finding.title, 'Finding'),
        severity: REPORT_SEVERITY_LABEL_MAP[getFindingBucketId(finding)] ?? 'Finding',
        codeArea: formatCodeAreaLabel(textOf(finding.codeArea || finding.code_area, 'General'))
      })),
    [formatCodeAreaLabel, reportIncludedFindings]
  );

  const reportCodeAreaSummaries = useMemo(() => {
    const grouped = new Map();
    reportIncludedFindings.forEach((finding) => {
      const key = normalizeCodeAreaId(
        textOf(finding.codeArea || finding.code_area, 'general').toLowerCase()
      ) || 'general';
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: formatCodeAreaLabel(key),
          attention: 0,
          goodPractice: 0,
          lead: 0,
          compliant: 0
        });
      }
      const entry = grouped.get(key);
      const bucket = getFindingBucketId(finding);
      if (bucket === 'critical') entry.attention += 1;
      if (bucket === 'warning') entry.lead += 1;
      if (bucket === 'best_practice') entry.goodPractice += 1;
      if (bucket === 'pass') entry.compliant += 1;
    });
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [formatCodeAreaLabel, normalizeCodeAreaId, reportIncludedFindings]);

  const reportCanGenerate = reportIncludedFindings.length > 0;
  const reportReviewBlockedReason =
    reportIncludedFindings.length === 0
      ? 'No findings are currently in scope for the report.'
      : '';

  const reportInterviewLines = useMemo(() => {
    const fromUploads = uploadItems
      .filter((item) =>
        isInterviewTranscriptUpload(item) ||
        /interview|mlro|holp|hofa/i.test(textOf(item.parties, ''))
      )
      .slice(0, 4)
      .flatMap((item) => {
        const interviewees = normalizeUploadInterviewees(item);
        if (interviewees.length === 0) {
          return [`${textOf(item.parties, 'Interviewee')} — source: ${textOf(item.name, 'Interview record')}`];
        }

        return interviewees.map((interviewee) => {
          const subjectLine = [interviewee.name, interviewee.role].filter(Boolean).join(' — ');
          const dateSuffix = interviewee.date ? ` (${interviewee.date})` : '';
          const contextSuffix = interviewee.contextNote ? ` — ${interviewee.contextNote}` : '';
          return `${subjectLine || textOf(item.parties, 'Interviewee')}${dateSuffix}${contextSuffix} — source: ${textOf(item.name, 'Interview record')}`;
        });
      })
      .slice(0, 4);

    if (fromUploads.length > 0) {
      return fromUploads;
    }

    const fromObservations = inspectorObservations
      .filter((obs) => /interview/i.test(textOf(obs.sourceType, '')))
      .slice(0, 4)
      .map((obs) => `${textOf(obs.actor, 'Inspector')} interview note — ${textOf(obs.ts, 'time not recorded')}`);

    return fromObservations;
  }, [uploadItems, inspectorObservations]);

  const buildReportSectionLines = useCallback(
    (sectionNarrativesSource, executiveSummaryValue) => {
      const total = reportIncludedFindings.length;
      const criticalCount = reportAttentionFindings.filter((finding) => getFindingBucketId(finding) === 'critical').length;
      const leadCount = reportAttentionFindings.filter((finding) => getFindingBucketId(finding) === 'warning').length;
      const compliantCount = reportIncludedFindings.filter((finding) => getFindingBucketId(finding) === 'pass').length;
      const goodPracticeCount = reportGoodPracticeFindings.length;
      const codeAreaCount = reportCodeAreaSummaries.length;
      const summary = total
        ? `Of ${total} findings across ${codeAreaCount || 1} code area${codeAreaCount === 1 ? '' : 's'}, ${compliantCount} are compliant, ${goodPracticeCount} identify good practice, and ${criticalCount + leadCount} are non-compliant or inconclusive.`
        : 'No findings are currently available for this case.';

      const summaryLine = safeText(executiveSummaryValue, '').trim() || summary;
      const codeAreaLineCursor = {};
      const resolveCodeAreaNarrativeLine = (rawCodeAreaId, fallbackText) => {
        const codeAreaId = normalizeCodeAreaId(safeText(rawCodeAreaId, ''));
        const lines = codeAreaId ? sectionNarrativesSource[codeAreaId] : null;
        if (!Array.isArray(lines) || lines.length === 0) {
          return fallbackText;
        }
        const cursor = codeAreaLineCursor[codeAreaId] ?? 0;
        const selectedLine = safeText(lines[Math.min(cursor, lines.length - 1)], '').trim();
        codeAreaLineCursor[codeAreaId] = cursor + 1;
        return selectedLine || fallbackText;
      };

      const goodPracticeLines =
        reportGoodPracticeFindings.length > 0
          ? reportGoodPracticeFindings.slice(0, 4).map((finding) =>
              resolveCodeAreaNarrativeLine(
                finding.codeArea || finding.code_area,
                textOf(finding.detail, textOf(finding.title, ''))
              )
            )
          : ['No good practice findings are currently mapped.'];

      const attentionLines =
        reportAttentionFindings.length > 0
          ? reportAttentionFindings.slice(0, 8).map((finding) =>
              resolveCodeAreaNarrativeLine(
                finding.codeArea || finding.code_area,
                textOf(finding.detail, textOf(finding.title, ''))
              )
            )
          : ['No attention findings are currently mapped.'];

      return {
        interviews:
          reportInterviewLines.length > 0
            ? reportInterviewLines
            : ['No interview transcripts uploaded'],
        summary: [summaryLine],
        goodPractice: goodPracticeLines,
        attention: attentionLines
      };
    },
    [
      reportAttentionFindings,
      reportCodeAreaSummaries.length,
      reportGoodPracticeFindings,
      reportInterviewLines,
      reportIncludedFindings,
      normalizeCodeAreaId
    ]
  );

  const reportSectionDefaults = useMemo(
    () => buildReportSectionLines(reportSectionNarrativesByCodeArea, reportExecutiveSummaryOverride),
    [buildReportSectionLines, reportSectionNarrativesByCodeArea, reportExecutiveSummaryOverride]
  );

  const reportSectionOriginals = useMemo(
    () => buildReportSectionLines(reportOriginalSectionNarrativesByCodeArea, reportOriginalExecutiveSummary),
    [buildReportSectionLines, reportOriginalSectionNarrativesByCodeArea, reportOriginalExecutiveSummary]
  );

  const getOriginalReportSectionLines = useCallback(
    (section, { codeAreaId = '' } = {}) => {
      if (section === 'summary') {
        return reportSectionOriginals.summary ?? [];
      }

      if ((section === 'attention' || section === 'goodPractice') && codeAreaId) {
        const persistedLines = reportOriginalSectionNarrativesByCodeArea[codeAreaId];
        if (Array.isArray(persistedLines) && persistedLines.length > 0) {
          return persistedLines.map((line) => safeText(line, '').trim()).filter(Boolean);
        }

        const sourceFindings = section === 'attention' ? reportAttentionFindings : reportGoodPracticeFindings;
        const fallbackLines = sourceFindings
          .filter((finding) => normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, '')) === codeAreaId)
          .map((finding) => textOf(finding.detail, textOf(finding.title, `${section} finding`)))
          .filter(Boolean);

        if (fallbackLines.length > 0) {
          return fallbackLines;
        }
      }

      return reportSectionOriginals[section] ?? [];
    },
    [
      normalizeCodeAreaId,
      reportAttentionFindings,
      reportGoodPracticeFindings,
      reportOriginalSectionNarrativesByCodeArea,
      reportSectionOriginals
    ]
  );

  const reportActionDefaults = useMemo(() => {
    const generated = reportAttentionFindings.map((finding) => ({
      id: `ra-auto-${finding.id}`,
      action: safeText(finding.title, 'Review and resolve finding'),
      codeRef: safeText(finding.reference, ''),
      codeArea: formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General')),
      deadline: '',
      person: ''
    }));
    return generated.length > 0 ? generated : REPORT_ACTION_DEFAULTS.map((item) => ({ ...item }));
  }, [reportAttentionFindings, formatCodeAreaLabel]);

  const reportActionBaselineItems = useMemo(() => {
    const sourceItems = reportActionOriginalItems.length > 0 ? reportActionOriginalItems : reportActionDefaults;
    return sourceItems.map((item) => ({ ...item }));
  }, [reportActionDefaults, reportActionOriginalItems]);

  const reportInspectionType = useMemo(() => {
    if (uploadItems.length > 0) return 'Desk-based review';
    return 'Inspection type pending';
  }, [uploadItems.length]);

  useEffect(() => {
    if (reportActionItems.length === 0 && reportActionBaselineItems.length > 0) {
      setReportActionItems(reportActionBaselineItems.map((item) => ({ ...item })));
    }
  }, [reportActionBaselineItems, reportActionItems.length]);

  useEffect(() => {
    if (!isDemoSeedCase || reportActionItems.length === 0 || reportActionDefaults.length === 0) return;

    const allActionsAutoGenerated = reportActionItems.every((item) => String(item?.id || '').trim().startsWith('ra-auto-'));
    const hasLegacyOwnerAssignment = reportActionItems.some(
      (item, index) => index === 0 && String(item?.person || '').trim() === String(currentCaseMeta.owner || '').trim()
    );
    const hasCountMismatch = reportActionItems.length !== reportActionDefaults.length;

    if (!allActionsAutoGenerated || (!hasLegacyOwnerAssignment && !hasCountMismatch)) return;

    const normalizedDefaults = reportActionDefaults.map((item) => ({ ...item }));
    setReportActionOriginalItems(normalizedDefaults);
    setReportActionItems(normalizedDefaults);
  }, [currentCaseMeta.owner, isDemoSeedCase, reportActionDefaults, reportActionItems]);

  useEffect(() => {
    if (appMode !== 'inspection' || !isActiveCasePersisted || isWorkspaceLoading) return;

    const cleanCaseId = currentCaseMeta.caseId?.trim();
    if (!cleanCaseId) return;

    const patch = {
      status: derivedCaseLifecycle.status,
      outcome: derivedCaseLifecycle.outcome
    };
    const patchKey = `${patch.status}|${patch.outcome}`;
    const lastPatch = lastPersistedCaseSummaryRef.current;
    if (lastPatch.caseId === cleanCaseId && lastPatch.key === patchKey) {
      return undefined;
    }

    const timer = setTimeout(() => {
      const currentLastPatch = lastPersistedCaseSummaryRef.current;
      if (currentLastPatch.caseId === cleanCaseId && currentLastPatch.key === patchKey) {
        return;
      }
      setCurrentCaseMeta((prev) =>
        prev.status === patch.status && prev.outcome === patch.outcome
          ? prev
          : { ...prev, status: patch.status, outcome: patch.outcome }
      );
      lastPersistedCaseSummaryRef.current = { caseId: cleanCaseId, key: patchKey };
      persistCasePatch({
        caseId: cleanCaseId,
        patch,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist case patch summary', error);
        lastPersistedCaseSummaryRef.current = { caseId: cleanCaseId, key: '' };
      });
    }, 550);

    return () => clearTimeout(timer);
  }, [
    appMode,
    derivedCaseLifecycle.outcome,
    derivedCaseLifecycle.status,
    isActiveCasePersisted,
    isWorkspaceLoading,
    currentCaseMeta.caseId,
    currentUser
  ]);

  const recurringFindingCount = useMemo(
    () => availableFindings.filter((finding) => RECURRING_FINDING_IDS.has(finding.id)).length,
    [availableFindings]
  );

  const currentCaseOutcome = useMemo(() => {
    const caseRow = dashboardCases.find((entry) => entry.id === currentCaseMeta.caseId);
    return caseRow?.outcome ?? 'in_progress';
  }, [dashboardCases, currentCaseMeta.caseId]);

  const historyTrendRows = useMemo(
    () =>
      reportCodeAreaSummaries.slice(0, 4).map((area) => {
        const total = area.attention + area.lead + area.goodPractice + area.compliant;
        const met = area.compliant + area.goodPractice;
        const trendLabel = area.attention > 0 ? 'Attention needed' : area.lead > 0 ? 'Monitoring' : 'Stable';
        const trendClass = area.attention > 0 ? 'rejected' : area.lead > 0 ? 'dismissed' : 'accepted';
        return {
          id: area.id,
          name: area.name,
          summary: `${met}/${Math.max(total, 1)} aligned · ${area.attention + area.lead} open`,
          trendLabel,
          trendClass
        };
      }),
    [reportCodeAreaSummaries]
  );

  const historyFindingsRows = useMemo(
    () =>
      reportAttentionFindings.slice(0, 6).map((finding) => {
        return {
          id: finding.id,
          title: textOf(finding.title, 'Finding'),
          codeArea: formatCodeAreaLabel(textOf(finding.codeArea || finding.code_area, 'General')),
          severity: REPORT_SEVERITY_LABEL_MAP[getFindingBucketId(finding)] ?? 'Finding',
          resolution:
            getFindingReviewDisplayState(finding) === 'accepted'
              ? 'Accepted'
              : getFindingReviewDisplayState(finding) === 'overturned'
                ? 'Overturned'
                : getFindingReviewDisplayState(finding) === 'rejected'
                  ? 'Rejected'
                  : getFindingReviewDisplayState(finding) === 'dismissed'
                  ? 'Dismissed'
                  : 'Open',
          recurring: RECURRING_FINDING_IDS.has(finding.id)
        };
      }),
    [formatCodeAreaLabel, getFindingReviewDisplayState, reportAttentionFindings]
  );

  const hasInspectionHistory = useMemo(
    () =>
      historyTrendRows.length > 0 ||
      historyFindingsRows.length > 0 ||
      Boolean(safeText(currentCaseMeta.previousInspection, '').trim()),
    [currentCaseMeta.previousInspection, historyFindingsRows.length, historyTrendRows.length]
  );

  const handleOpenHistoryFinding = useCallback(
    (findingId) => {
      const targetFinding = allFindings.find((finding) => finding?.id === findingId);
      if (targetFinding) {
        const targetCodeAreaId = normalizeCodeAreaId(safeText(targetFinding.codeArea || targetFinding.code_area, ''));
        if (targetCodeAreaId) {
          setExpandedCodeAreaIds((prev) => ({ ...prev, [targetCodeAreaId]: true }));
        }
        setActiveFindingId(findingId);
      }
      setCurrentStep(STEP_OVERVIEW);
    },
    [allFindings, normalizeCodeAreaId, safeText]
  );

  const activeCaseTabId = useMemo(() => {
    if (currentStep === STEP_CASE_SETUP) return 'case-setup';
    if (currentStep === STEP_VIEWER) {
      return viewerOriginStep === STEP_DOCUMENTS ? 'documents' : 'overview';
    }
    if (currentStep === STEP_OVERVIEW) return 'overview';
    if (currentStep === STEP_REPORT) return 'report';
    if (currentStep === STEP_HISTORY) return 'overview';
    return 'documents';
  }, [currentStep, viewerOriginStep]);

  const documentRows = useMemo(() => {
    const uploadByFilenameKey = new Map();
    uploadItems.forEach((item) => {
      buildUploadLookupKeys(item).forEach((key) => {
        if (key && !uploadByFilenameKey.has(key)) {
          uploadByFilenameKey.set(key, item);
        }
      });
    });
    return caseDocuments.map((doc) => {
      const findingsForDoc = allFindings.filter((finding) => finding.documentId === doc.id);
      const unresolvedForDoc = findingsForDoc.filter((finding) => !resolvedFindingDecisions[finding.id]).length;
      const uploadMatch = [...buildDocumentLookupKeys(doc)]
        .map((key) => uploadByFilenameKey.get(key))
        .find(Boolean);
      const uploadStatus = textOf(uploadMatch?.status, '');
      const status = uploadStatus
        ? uploadStatus === 'verified'
          ? 'verified'
          : uploadStatus === 'attention'
            ? 'attention'
            : 'reviewing'
        : unresolvedForDoc === 0
          ? 'verified'
          : unresolvedForDoc > 2
            ? 'attention'
            : 'reviewing';
      return {
        id: doc.id,
        label: doc.label,
        filename: doc.filename,
        classification: formatUploadClassificationLabel(uploadMatch ?? doc),
        parties: textOf(uploadMatch?.parties, textOf(doc.parties, 'Firm')),
        confidence: textOf(uploadMatch?.confidence, textOf(doc.confidence, 'medium')),
        uploadedOn: uploadMatch?.addedOn ?? doc.uploadedOn ?? '',
        summary: textOf(uploadMatch?.summary, textOf(doc.summary, '')),
        findingsCount: findingsForDoc.length,
        unresolvedForDoc,
        status,
        limitedAnalysis: isUploadLimitedAnalysis(uploadMatch)
      };
    });
  }, [allFindings, caseDocuments, resolvedFindingDecisions, uploadItems]);

  const localFilteredCrossDocResults = useMemo(() => {
    const query = docSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return allFindings
      .filter((finding) => {
        const relatedDoc = documentsById.get(finding.documentId);
        const haystack = [
          finding.title,
          finding.detail,
          relatedDoc?.label,
          finding.source?.text,
          finding.source?.section
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 20);
  }, [allFindings, docSearchQuery, documentsById]);

  const localFilteredInDocumentResults = useMemo(() => {
    const query = docSearchQuery.trim().toLowerCase();
    if (!query || !activeDocId) return [];
    return allFindings
      .filter((finding) => findingReferencesDocument(finding, activeDocId))
      .filter((finding) => {
        const haystack = [
          finding.title,
          finding.detail,
          finding.source?.text,
          finding.source?.section
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [allFindings, activeDocId, docSearchQuery]);

  const filteredCrossDocResults = useMemo(
    () => (providerSearchSupported ? providerSearchResults.slice(0, 20) : localFilteredCrossDocResults),
    [providerSearchResults, providerSearchSupported, localFilteredCrossDocResults]
  );

  const filteredInDocumentResults = useMemo(() => {
    if (!providerSearchSupported) return localFilteredInDocumentResults;
    const scoped = docSearchScope === 'document' && activeDocId
      ? providerSearchResults.filter(
          (finding) => !finding.documentId || findingReferencesDocument(finding, activeDocId)
        )
      : providerSearchResults;
    return scoped.slice(0, 8);
  }, [providerSearchSupported, providerSearchResults, docSearchScope, activeDocId, localFilteredInDocumentResults]);

  const formatOutcomeLabel = (outcome) => {
    const value = String(outcome || '').trim().toLowerCase();
    if (value === 'compliant') return 'Compliant';
    if (value === 'generally_compliant') return 'Generally compliant';
    if (value === 'non_compliant') return 'Non-compliant';
    return 'In progress';
  };

  const matchesCurrentUserAssignment = useCallback(
    (caseRow) => {
      if (!caseRow || typeof caseRow !== 'object') return false;

      const currentUserId = coerceText(currentUser?.uid);
      if (
        currentUserId &&
        [
          caseRow.assignedInspectorUserId,
          caseRow.inspectorId,
          caseRow.createdByUserId
        ].some((value) => coerceText(value) === currentUserId)
      ) {
        return true;
      }

      const cleanCurrentEmail = coerceText(currentUserEmail);
      if (!cleanCurrentEmail) return false;

      return [
        caseRow.assignedInspectorEmail,
        caseRow.inspectorEmail,
        caseRow.ownerEmail,
        caseRow.inspector,
        caseRow.owner
      ].some((value) => coerceText(value) === cleanCurrentEmail);
    },
    [currentUser?.uid, currentUserEmail]
  );

  const dashboardScopeCases = useMemo(() => {
    if (!hasTeamCaseAccess || teamView) {
      return dashboardCases;
    }

    return dashboardCases.filter((item) => matchesCurrentUserAssignment(item));
  }, [dashboardCases, hasTeamCaseAccess, matchesCurrentUserAssignment, teamView]);

  const dashboardCompletedCases = useMemo(
    () => dashboardScopeCases.filter((item) => item.status === 'completed'),
    [dashboardScopeCases]
  );

  const visibleDashboardCases = useMemo(() => {
    const search = dashboardSearch.trim().toLowerCase();
    return dashboardScopeCases.filter((item) => {
      if (!search) return true;
      const haystack = `${item.practice} ${item.id}`.toLowerCase();
      return haystack.includes(search);
    })
      .filter((item) => item.status !== 'completed')
      .filter((item) =>
        dashboardOutcomeFilter === 'All'
          ? true
          : dashboardOutcomeFilter === 'In progress'
            ? (item.outcome ?? 'in_progress') === 'in_progress'
            : dashboardOutcomeFilter === 'Compliant'
              ? (item.outcome ?? '') === 'compliant'
              : dashboardOutcomeFilter === 'Generally compliant'
                ? (item.outcome ?? '') === 'generally_compliant'
              : dashboardOutcomeFilter === 'Non-compliant'
                  ? (item.outcome ?? '') === 'non_compliant'
                  : true
      )
      .filter((item) =>
        hasTeamCaseAccess && teamView && dashboardInspectorFilter !== 'All inspectors'
          ? item.inspector === dashboardInspectorFilter
          : true
      )
      .filter((item) => matchesDashboardDateFilter(item, dashboardDateFilter));
  }, [
    dashboardScopeCases,
    dashboardSearch,
    dashboardOutcomeFilter,
    hasTeamCaseAccess,
    teamView,
    dashboardInspectorFilter,
    dashboardDateFilter
  ]);

  const dashboardInspectorOptions = useMemo(() => {
    const values = Array.from(new Set(dashboardCases.map((item) => item.inspector).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [dashboardCases]);

  const scopedActiveCaseCount = useMemo(
    () => visibleDashboardCases.filter((item) => item.progress < 100 && item.status !== 'completed').length,
    [visibleDashboardCases]
  );

  const scopedUnreviewedCount = useMemo(
    () => dashboardScopeCases.reduce((total, item) => total + (item.unreviewed ?? 0), 0),
    [dashboardScopeCases]
  );

  const scopedIdleOver7DaysCount = useMemo(
    () => dashboardScopeCases.filter((item) => extractIdleDays(item.lastActivity) > 7).length,
    [dashboardScopeCases]
  );

  const dashboardAttentionItems = useMemo(() => {
    if (!hasTeamCaseAccess || !teamView) return [];

    const sourceCases = visibleDashboardCases.length > 0 ? visibleDashboardCases : dashboardScopeCases;
    return sourceCases
      .filter((item) => item.progress < 100)
      .flatMap((item) => {
        const idleDays = extractIdleDays(item.lastActivity);
        const rows = [];

        if ((item.unreviewed ?? 0) > 0 && idleDays > 3) {
          rows.push({
            id: `attention-review-${item.id}`,
            caseId: item.id,
            practice: item.practice,
            message: `${item.unreviewed} unreviewed finding${item.unreviewed === 1 ? '' : 's'} unresolved for ${idleDays} day${idleDays === 1 ? '' : 's'}`,
            assignedTo: item.inspector,
            priority: 0
          });
        }

        if (idleDays > 7) {
          rows.push({
            id: `attention-idle-${item.id}`,
            caseId: item.id,
            practice: item.practice,
            message: `No activity for ${idleDays} day${idleDays === 1 ? '' : 's'}`,
            assignedTo: item.inspector,
            priority: 1
          });
        }

        return rows;
      })
      .sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.practice.localeCompare(right.practice);
      })
      .slice(0, 6);
  }, [dashboardScopeCases, hasTeamCaseAccess, teamView, visibleDashboardCases]);

  const dashboardScopeTitle = hasTeamCaseAccess && teamView ? 'Team Cases' : 'My Cases';
  const dashboardScopeRoleLabel = formatUserRoleLabel(currentUserRole);
  const dashboardScopeSummary = hasTeamCaseAccess && teamView ? 'team active cases' : 'active cases';
  const dashboardRoleNote = '';

  const queuedUploadCount = useMemo(
    () => uploadItems.filter((item) => item.status !== 'verified').length,
    [uploadItems]
  );

  const findingNoteCount = useMemo(() => Object.keys(findingNotes).length, [findingNotes]);
  const markedDocsCount = useMemo(
    () => Object.values(docsMarkedForReprocess).filter(Boolean).length,
    [docsMarkedForReprocess]
  );

  const hasCompletedClassificationRun = useMemo(
    () => uploadItems.some((item) => item.status !== 'queued'),
    [uploadItems]
  );

  const pendingReprocessSummary = useMemo(() => {
    if (!hasCompletedClassificationRun) return '';
    const segments = [];
    if (queuedUploadCount > 0) {
      segments.push(
        `${queuedUploadCount} queued document${queuedUploadCount === 1 ? '' : 's'}`
      );
    }
    if (findingNoteCount > 0) {
      segments.push(`${findingNoteCount} note${findingNoteCount === 1 ? '' : 's'} added`);
    }
    if (markedDocsCount > 0) {
      segments.push(`${markedDocsCount} document${markedDocsCount === 1 ? '' : 's'} marked for reprocess`);
    }
    if (pendingScopeChangeCount > 0) {
      segments.push(
        `${pendingScopeChangeCount} code area${pendingScopeChangeCount === 1 ? '' : 's'} restored to assessment`
      );
    }
    return segments.join(', ');
  }, [queuedUploadCount, findingNoteCount, markedDocsCount, pendingScopeChangeCount, hasCompletedClassificationRun]);

  const flattenedDocumentNotes = useMemo(
    () =>
      Object.entries(documentNotes)
        .flatMap(([docId, entries]) =>
          (entries ?? []).map((entry) => ({
            ...entry,
            docId,
            docLabel: documentsById.get(docId)?.label ?? docId
          }))
        )
        .sort((a, b) => (a.id < b.id ? 1 : -1)),
    [documentNotes, documentsById]
  );

  const isUploadReadyForConfirmation = useCallback((uploadItem) => {
    if (!uploadItem || uploadItem.status === 'queued') return false;
    if (!isUploadClassificationResolved(uploadItem)) return false;
    if (hasIncompleteUploadInterviewees(uploadItem)) return false;
    return true;
  }, []);

  const allUploadsVerified = useMemo(
    () =>
      uploadItems.length > 0 &&
      uploadItems.every((item) => item.status === 'verified' && isUploadReadyForConfirmation(item)),
    [isUploadReadyForConfirmation, uploadItems]
  );
  const verifiedUploadCount = useMemo(
    () => uploadItems.filter((item) => item.status === 'verified' && isUploadReadyForConfirmation(item)).length,
    [isUploadReadyForConfirmation, uploadItems]
  );
  const lowConfidenceUploadCount = useMemo(
    () => uploadItems.filter((item) => String(item.confidence || '').trim().toLowerCase() === 'low').length,
    [uploadItems]
  );
  const unclassifiedUploadCount = useMemo(
    () => uploadItems.filter((item) => !isUploadClassificationResolved(item)).length,
    [isUploadReadyForConfirmation, uploadItems]
  );
  const incompleteInterviewUploadCount = useMemo(
    () => uploadItems.filter((item) => hasIncompleteUploadInterviewees(item)).length,
    [uploadItems]
  );
  const limitedAnalysisUploadCount = useMemo(
    () => uploadItems.filter((item) => isUploadLimitedAnalysis(item)).length,
    [uploadItems]
  );
  const unverifiedUploadCount = useMemo(
    () =>
      uploadItems.filter((item) => item.status !== 'verified' || !isUploadReadyForConfirmation(item)).length,
    [isUploadReadyForConfirmation, uploadItems]
  );
  const confirmableUploadCount = useMemo(
    () => uploadItems.filter((item) => item.status !== 'verified' && isUploadReadyForConfirmation(item)).length,
    [isUploadReadyForConfirmation, uploadItems]
  );

  useEffect(() => {
    setHasViewedUploadTableEnd(uploadItems.length === 0);
  }, [uploadItems.length]);

  useEffect(() => {
    if (documentsPhase !== 'review') return undefined;
    const lastRow = uploadTableLastRowRef.current;
    if (!lastRow || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasViewedUploadTableEnd(true);
          observer.disconnect();
        }
      },
      { threshold: 0.55 }
    );

    observer.observe(lastRow);
    return () => observer.disconnect();
  }, [documentsPhase, uploadItems.length, expandedUploadSummaryId]);

  useEffect(() => {
    setReprocessBannerDismissed(false);
  }, [pendingReprocessSummary]);

  useEffect(() => {
    if (documentWorkspaceTab !== 'findings') {
      setDocCrossSearchOpen(false);
    }
  }, [documentWorkspaceTab]);

  useEffect(() => {
    const assistantAllowed = appMode === 'inspection';
    if (!assistantAllowed && reggieOpen) {
      setReggieOpen(false);
    }
  }, [appMode, currentStep, reggieOpen]);

  useEffect(() => {
    const documentsWorkflowContext =
      currentStep === STEP_DOCUMENTS || (currentStep === STEP_VIEWER && viewerOriginStep === STEP_DOCUMENTS);
    if (documentsWorkflowContext) {
      if (activeFindingId !== null) {
        setActiveFindingId(null);
      }
      return;
    }
    if (filteredFindings.length === 0) {
      setActiveFindingId(null);
      return;
    }
    if (!filteredFindings.some((finding) => finding.id === activeFindingId)) {
      setActiveFindingId(filteredFindings[0].id);
    }
  }, [filteredFindings, activeFindingId, currentStep, viewerOriginStep]);

  useEffect(() => {
    if (complianceCodeAreas.length === 0) return;
    const validIds = new Set(complianceCodeAreas.map((area) => area.id));
    setExpandedCodeAreaIds((prev) => {
      const entries = Object.entries(prev ?? {});
      if (entries.length === 0) return prev;

      let changed = false;
      const next = {};
      entries.forEach(([areaId, isExpanded]) => {
        if (isExpanded && validIds.has(areaId)) {
          next[areaId] = true;
          return;
        }
        if (isExpanded) changed = true;
      });

      return changed ? next : prev;
    });
  }, [complianceCodeAreas]);

  const totalSteps = INSPECTION_LINEAR_FINAL_STEP;

  const handleGoHome = useCallback(() => {
    setCaseOpenTransitionCaseId('');
    setAppMode('dashboard');
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setDocLevelNoteOpen(false);
    setReportPendingGateOpen(false);
    setReportRegenerateConfirmOpen(false);
    setReggieOpen(false);
    refreshDashboardCases();
  }, [currentCaseDashboardRow, refreshDashboardCases]);

  const handleCaseTabNavigate = (targetStep) => {
    if (targetStep <= maxStepUnlocked) {
      if (targetStep === STEP_REPORT) {
        setReportAccessNotice('');
        requestAnimationFrame(scrollWorkspaceToTop);
      }
      if (targetStep === STEP_DOCUMENTS) {
        setActiveFindingId(null);
        setActiveGuidanceContext(null);
      }
      setCurrentStep(targetStep);
      if (
        targetStep === STEP_REPORT &&
        reportCanGenerate &&
        availableFindings.length > 0 &&
        !reportGenerationInProgress &&
        (reportNeedsRegeneration || !hasGeneratedReport)
      ) {
        void runReportGeneration(hasGeneratedReport ? 'regenerate' : 'generate');
      }
    }
  };

  const handleOpenCase = (caseItem) => {
    const targetStep = STEP_OVERVIEW;
    const nextCaseId = coerceText(caseItem?.id).trim();
    setCaseOpenTransitionCaseId(nextCaseId);
    setIsWorkspaceLoading(true);
    setAppMode('inspection');
    setIsActiveCasePersisted(false);
    setFirestoreDocuments([]);
    setFirestoreFindings([]);
    setFirestoreRequirementsByCodeArea({});
    setFindingDecisions({});
    setFindingNotes({});
    setDocumentNotes({});
    setCaseContextNotes([]);
    setInspectorFindings([]);
    setInspectorObservations([]);
    setUploadItems([]);
    setCurrentStep(targetStep);
    setMaxStepUnlocked((prev) => Math.max(prev, totalSteps));
    setDocSearchQuery('');
    setDocCrossSearchOpen(false);
    setNoteTargetFindingId(null);
    setDocLevelNoteOpen(false);
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setFindingViewFilters(DEFAULT_FINDING_VIEW_FILTERS);
    setOverviewFindingScope(DEFAULT_OVERVIEW_FINDING_SCOPE);
    setViewerCodeAreaFilter('all');
    setFilterSeverity([]);
    setSeverityFilterOpen(false);
    setExpandedCodeAreaIds({});
    setExpandedOverviewFindingIds({});
    setClosingOverviewFindingIds({});
    setOverviewRequirementFilter({ areaId: '', requirementId: '' });
    setReportDraftVersion((prev) => prev + 1);
    setReportPendingChanges(false);
    if (targetStep === STEP_DOCUMENTS) {
      setDocumentsPhase('review');
      setDocumentWorkspaceTab('lifecycle');
    }
    if (targetStep === STEP_OVERVIEW) {
      setDocumentWorkspaceTab('findings');
    }
    if (targetStep === STEP_REPORT) {
      setReportNeedsRegeneration(false);
    } else {
      setReportNeedsRegeneration(true);
    }
    if (caseItem) {
      setCurrentCaseMeta((prev) => ({
        ...prev,
        practiceName: caseItem.practice ?? prev.practiceName,
        caseId: caseItem.id ?? prev.caseId,
        owner: caseItem.inspector ?? prev.owner,
        riskLevel: caseItem.risk ?? prev.riskLevel,
        status: caseItem.status ?? prev.status,
        outcome: caseItem.outcome ?? prev.outcome
      }));
    }
  };

  const handleOpenCompletedCase = (caseItem) => {
    const targetStep = STEP_OVERVIEW;
    const nextCaseId = coerceText(caseItem?.id).trim();
    setCaseOpenTransitionCaseId(nextCaseId);
    setIsWorkspaceLoading(true);
    setAppMode('inspection');
    setIsActiveCasePersisted(false);
    setFirestoreDocuments([]);
    setFirestoreFindings([]);
    setFirestoreRequirementsByCodeArea({});
    setFindingDecisions({});
    setFindingNotes({});
    setDocumentNotes({});
    setCaseContextNotes([]);
    setInspectorFindings([]);
    setInspectorObservations([]);
    setUploadItems([]);
    setCurrentStep(targetStep);
    setMaxStepUnlocked((prev) => Math.max(prev, totalSteps));
    setDocSearchQuery('');
    setDocCrossSearchOpen(false);
    setNoteTargetFindingId(null);
    setDocLevelNoteOpen(false);
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setFindingViewFilters(DEFAULT_FINDING_VIEW_FILTERS);
    setOverviewFindingScope(DEFAULT_OVERVIEW_FINDING_SCOPE);
    setViewerCodeAreaFilter('all');
    setFilterSeverity([]);
    setSeverityFilterOpen(false);
    setExpandedCodeAreaIds({});
    setExpandedOverviewFindingIds({});
    setClosingOverviewFindingIds({});
    setOverviewRequirementFilter({ areaId: '', requirementId: '' });
    setReportDraftVersion((prev) => prev + 1);
    setReportPendingChanges(false);
    setDocumentWorkspaceTab('findings');
    setReportNeedsRegeneration(false);
    if (caseItem) {
      setCurrentCaseMeta((prev) => ({
        ...prev,
        practiceName: caseItem.practice ?? prev.practiceName,
        caseId: caseItem.id ?? prev.caseId,
        owner: caseItem.inspector ?? prev.owner,
        riskLevel: caseItem.risk ?? prev.riskLevel,
        status: caseItem.status ?? prev.status,
        outcome: caseItem.outcome ?? prev.outcome
      }));
    }
  };

  const workflowTimelineStep =
    appMode === 'dashboard'
      ? 1
      : appMode === 'caseSetup'
        ? 2
        : currentStep === STEP_REPORT
          ? 5
          : currentStep === STEP_DOCUMENTS || currentStep === STEP_PROCESSING
            ? 3
            : 4;

  const setDashboardView = (nextTeamView) => {
    if (!hasTeamCaseAccess && nextTeamView) return;
    setTeamView(nextTeamView);
    clearDashboardFilters();
  };

  const clearDashboardFilters = () => {
    setDashboardSearch('');
    setDashboardDateFilter('All');
    setDashboardOutcomeFilter('All');
    setDashboardInspectorFilter('All inspectors');
    setShowCompletedCases(false);
  };

  const handleCreateCase = async () => {
    if (
      !caseSetupPracticeName.trim() ||
      selectedFocusAreaIds.size === 0
    ) {
      return;
    }
    if (isCreatingCase) return;
    setCaseCreateError('');
    const uncheckedAreas = FOCUS_AREA_OPTIONS.filter((area) => !selectedFocusAreaIds.has(area.id)).map(
      (area) => area.label
    );
    const nextCaseId = `case-${Date.now()}`;
    const nextPracticeName = caseSetupPracticeName.trim();
    const nextOwner =
      coerceText(currentUserProfile?.displayName).trim() ||
      coerceText(currentUser?.displayName).trim() ||
      currentUserEmail ||
      'Inspector';
    const nextRiskLevel = formatRiskLevelLabel(caseSetupRiskLevel);
    const nextTransactionType = caseSetupTransactionType || CASE_META.transactionType;
    const nextActingForLender =
      (caseSetupActingForLender || (CASE_META.actingForLender ? 'yes' : 'no')) === 'yes';
    const nextAmlTier = caseSetupAmlTier || CASE_META.amlTier;
    const nextHolp = caseSetupHolp.trim();
    const nextHofa = caseSetupHofa.trim();
    const nextPreviousInspection = caseSetupPreviousInspection || 'N/A';
    const nextFocusAreaIds = Array.from(selectedFocusAreaIds);
    const nextPreInspectionConcerns = caseSetupConcerns.trim();

    setIsCreatingCase(true);
    let createdCase = null;
    try {
      createdCase = await createCaseRecord({
        caseId: nextCaseId,
        practiceName: nextPracticeName,
        owner: nextOwner,
        riskLevel: nextRiskLevel,
        transactionType: nextTransactionType,
        actingForLender: nextActingForLender,
        amlTier: nextAmlTier,
        previousInspection: nextPreviousInspection,
        holp: nextHolp,
        hofa: nextHofa,
        focusAreas: nextFocusAreaIds,
        preInspectionConcerns: nextPreInspectionConcerns,
        questionnaireFileName: caseSetupQuestionnaireFile || null,
        questionnaireFile: caseSetupQuestionnaireFileBlob || null,
        user: currentUser
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create case in data provider', error);
      setCaseCreateError('Failed to create case. Check provider permissions/connectivity and try again.');
      setIsCreatingCase(false);
      return;
    }
    const persistedCaseId = String(createdCase?.id || createdCase?.case_id || nextCaseId).trim() || nextCaseId;

    const nowTs = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDeletedFindingIds({});
    setFindingDecisions({});
    setFindingNotes({});
    setDocumentNotes({});
    setCaseContextNotes([]);
    setInspectorObservations([]);
    setInspectorFindings([]);
    setReportPendingChanges(false);
    setReportNeedsRegeneration(true);
    setEditedReportSections({ interviews: false, summary: false, attention: false, goodPractice: false });
    setReportActionOriginalItems([]);
    setReportActionItems([]);
    setReportOriginalSectionNarrativesByCodeArea({});
    setReportSectionNarrativesByCodeArea({});
    setReportOriginalExecutiveSummary('');
    setReportExecutiveSummaryOverride('');
    setHistoryItems([
      {
        id: `h-${Date.now()}-created`,
        ts: nowTs,
        detail: `Case created: ${caseSetupPracticeName.trim()}`,
        actor: currentUserEmail || 'Inspector'
      },
      ...INITIAL_HISTORY_ITEMS
    ]);
    setNotAssessedAreas(uncheckedAreas);
    setCurrentCaseMeta((prev) => ({
      ...prev,
      practiceName: nextPracticeName,
      caseId: persistedCaseId,
      owner: nextOwner || prev.owner,
      started: new Date().toLocaleDateString(),
      riskLevel: nextRiskLevel,
      transactionType: nextTransactionType,
      actingForLender: nextActingForLender,
      amlTier: nextAmlTier,
      previousInspection: nextPreviousInspection,
      holp: nextHolp || prev.holp,
      hofa: nextHofa || prev.hofa,
      focusAreas: nextFocusAreaIds,
      preInspectionConcerns: nextPreInspectionConcerns
    }));
    setDashboardCases((prev) => [
      {
        id: persistedCaseId,
        practice: nextPracticeName,
        started: new Date().toLocaleDateString(),
        startedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActivityAt: Date.now(),
        progress: 0,
        progressLabel: '0/0 requirements reviewed',
        unreviewed: 0,
        leads: 0,
        goodPractice: 0,
        risk: nextRiskLevel,
        lastActivity: 'Just now',
        inspector: nextOwner,
        inspectorId: currentUser?.uid ?? '',
        assignedInspectorUserId: currentUser?.uid ?? '',
        assignedInspectorEmail: currentUserEmail,
        createdByUserId: currentUser?.uid ?? '',
        status: 'active'
      },
      ...prev.filter((entry) => entry.id !== nextCaseId && entry.id !== persistedCaseId)
    ]);
    setIsActiveCasePersisted(true);
    clearDashboardFilters();
    setUploadItems([]);
    setDocumentsPhase('intake');
    if (caseSetupFileInputRef.current) {
      caseSetupFileInputRef.current.value = '';
    }
    setDocumentWorkspaceTab('lifecycle');
    setDocSearchQuery('');
    setDocCrossSearchOpen(false);
    setDocSearchScope('document');
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setNoteTargetFindingId(null);
    setInlineRejectFindingId(null);
    setDocLevelNoteOpen(false);
    setReportPendingGateOpen(false);
    setReportRegenerateConfirmOpen(false);
    setReportPendingAction('generate');
    setHasGeneratedReport(false);
    setActiveClassificationMenu(null);
    setConfirmAllUploadsGateOpen(false);
    setHasViewedUploadTableEnd(false);
    setExpandedCodeAreaIds({});
    setExpandedOverviewFindingIds({});
    setClosingOverviewFindingIds({});
    setOverviewFindingScope(DEFAULT_OVERVIEW_FINDING_SCOPE);
    setOverviewRequirementFilter({ areaId: '', requirementId: '' });
    setPendingScopeChangeCount(0);
    setReportDraftVersion((prev) => prev + 1);
    setAppMode('inspection');
    skipNextWorkspaceLoadCaseIdRef.current = persistedCaseId;
    setCurrentStep(STEP_DOCUMENTS);
    setMaxStepUnlocked(STEP_DOCUMENTS);
    setIsCreatingCase(false);
  };

  const handleFindingDecision = (
    findingId,
    nextDecision,
    { reason = '', reasonNote = '', findingOverrides = {} } = {}
  ) => {
    const targetFinding = allFindings.find((finding) => finding.id === findingId) ?? null;
    const previousDecision = findingDecisions[findingId] ?? null;
    const findingForPersistence = targetFinding ? { ...targetFinding, ...findingOverrides } : null;
    const nextFindingState = buildNextFindingStateForDecision(
      targetFinding,
      nextDecision,
      reason,
      reasonNote,
      findingOverrides
    );

    setInlineRejectFindingId((prev) => (prev === findingId ? null : prev));
    setNoteTargetFindingId((prev) => (prev === findingId ? null : prev));
    setInlineDismissFindingId((prev) => (prev === findingId ? null : prev));
    setLeadConfirmModal((prev) => (prev.findingId === findingId ? { ...prev, open: false } : prev));
    setReportNeedsRegeneration(true);
    setFindingDecisions((prev) => {
      const next = { ...prev, [findingId]: nextDecision };
      if (!nextDecision) {
        delete next[findingId];
      }
      return next;
    });

    setUndoDecision({
      findingId,
      previousDecision,
      nextDecision,
      previousFindingState: targetFinding ? { ...targetFinding } : null
    });

    if (nextFindingState) {
      replaceFindingState(findingId, nextFindingState);
    }

    if (targetFinding) {
      const decisionLabel =
        nextDecision === 'rejected'
          ? 'Rejected'
          : nextDecision === 'dismissed'
            ? 'Dismissed after review'
            : nextDecision === null
              ? 'Cleared decision'
              : targetFinding?.certainty === 'lead'
                ? 'Confirmed as finding'
                : 'Accepted';
      setHistoryItems((items) => [
        {
          id: `h${Date.now()}`,
          ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detail: `${decisionLabel}: ${targetFinding.title}`,
          actor: currentUserEmail || 'Inspector'
        },
        ...items
      ]);
    }

    if (isActiveCasePersisted) {
      persistFindingDecision({
        caseId: currentCaseMeta.caseId,
        findingId,
        decision: nextDecision,
        reason,
        reasonNote,
        previousDecision,
        finding: findingForPersistence,
        user: currentUser
      })
        .then(() => refreshDashboardCases())
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to persist finding decision', error);
        });
    }
  };

  const handleRequestFindingDecision = (findingId, nextDecision, { source = 'viewer' } = {}) => {
    const clearAcceptedCollapseTimer = () => {
      const timerId = acceptedOverviewCollapseTimersRef.current[findingId];
      if (!timerId) return;
      clearTimeout(timerId);
      delete acceptedOverviewCollapseTimersRef.current[findingId];
    };

    if (nextDecision === 'accepted' || nextDecision === null || nextDecision === 'unreviewed') {
      clearAcceptedCollapseTimer();
      if (nextDecision === 'accepted' && source === 'overview' && overviewFindingScope === 'open') {
        setClosingOverviewFindingIds((prev) => ({ ...prev, [findingId]: true }));
        acceptedOverviewCollapseTimersRef.current[findingId] = window.setTimeout(() => {
          setClosingOverviewFindingIds((prev) => {
            const next = { ...prev };
            delete next[findingId];
            return next;
          });
          handleFindingDecision(findingId, 'accepted');
          delete acceptedOverviewCollapseTimersRef.current[findingId];
        }, 280);
        return;
      }
      setClosingOverviewFindingIds((prev) => {
        if (!prev[findingId]) return prev;
        const next = { ...prev };
        delete next[findingId];
        return next;
      });
      handleFindingDecision(findingId, nextDecision === 'unreviewed' ? null : nextDecision);
      return;
    }
    if (nextDecision === 'rejected') {
      clearAcceptedCollapseTimer();
      setNoteTargetFindingId(null);
      setInlineDismissFindingId(null);
      setInlineRejectFindingId(findingId);
      setInlineRejectReason('');
      setInlineRejectNote('');
      setActiveMenuFindingId(null);
      return;
    }
    if (nextDecision === 'dismissed') {
      clearAcceptedCollapseTimer();
      setNoteTargetFindingId(null);
      setInlineRejectFindingId(null);
      setInlineDismissFindingId(findingId);
      setInlineDismissReason('');
      setInlineDismissNote('');
      setActiveMenuFindingId(null);
      return;
    }
    clearAcceptedCollapseTimer();
    setActiveMenuFindingId(null);
  };

  const handleConfirmInlineReject = (findingId, requireOtherNote = true) => {
    if (!inlineRejectReason) return;
    if (requireOtherNote && inlineRejectReason === 'other' && !inlineRejectNote.trim()) return;
    handleFindingDecision(findingId, 'rejected', {
      reason: inlineRejectReason,
      reasonNote: inlineRejectNote.trim()
    });
    setInlineRejectFindingId(null);
    setInlineRejectReason('');
    setInlineRejectNote('');
  };

  const handleOpenAddNote = (findingId) => {
    setInlineRejectFindingId(null);
    setInlineDismissFindingId(null);
    setNoteTargetFindingId(findingId);
    const existing = findingNotes[findingId];
    const existingText = typeof existing === 'string' ? existing : existing?.text ?? '';
    setNoteDraft(existingText);
    setActiveMenuFindingId(null);
  };

  const handleSaveFindingNote = () => {
    if (!noteTargetFindingId) return;
    const cleanNote = noteDraft.trim();
    if (!cleanNote) {
      setNoteTargetFindingId(null);
      setNoteDraft('');
      return;
    }
    setFindingNotes((prev) => ({
      ...prev,
      [noteTargetFindingId]: {
        text: cleanNote,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actor: currentUserEmail || 'Inspector'
      }
    }));
    const targetFinding = allFindings.find((finding) => finding.id === noteTargetFindingId);
    if (targetFinding) {
      setHistoryItems((items) => [
        {
          id: `h${Date.now()}`,
          ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detail: `Note added: ${targetFinding.title}`,
          actor: currentUserEmail || 'Inspector'
        },
        ...items
      ]);
    }
    setReportNeedsRegeneration(true);

    if (isActiveCasePersisted) {
      persistFindingNote({
        caseId: currentCaseMeta.caseId,
        findingId: noteTargetFindingId,
        text: cleanNote,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist finding note', error);
      });
    }

    setNoteTargetFindingId(null);
    setNoteDraft('');
  };

  const handleConfirmInlineDismiss = (findingId, requireOtherNote = true) => {
    if (!inlineDismissReason) return;
    if (requireOtherNote && inlineDismissReason === 'other' && !inlineDismissNote.trim()) return;
    handleFindingDecision(findingId, 'dismissed', {
      reason: inlineDismissReason,
      reasonNote: inlineDismissNote.trim()
    });
    setInlineDismissFindingId(null);
    setInlineDismissReason('');
    setInlineDismissNote('');
  };

  const handleSubmitFeedback = async () => {
    const cleanFeedback = feedbackText.trim();
    if (!cleanFeedback) {
      setFeedbackOpen(false);
      return;
    }

    if (isActiveCasePersisted) {
      try {
        await persistFeedback({
          caseId: currentCaseMeta.caseId,
          category: feedbackCategory,
          text: cleanFeedback,
          metadata: {
            step: currentStep,
            mode: appMode
          },
          user: currentUser
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to persist feedback in data provider', error);
      }
    }

    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Feedback sent (${feedbackCategory})`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
    setFeedbackOpen(false);
    setFeedbackText('');
    setFeedbackCategory('suggestion');
  };

  const handleUpdateObservation = (observationId) => {
    const target = inspectorObservations.find((entry) => entry.id === observationId);
    if (!target) return;

    const nextText = window.prompt('Update observation text', target.text || '');
    if (nextText === null) return;
    const cleanedText = String(nextText).trim();
    if (!cleanedText) return;

    const updatedObservation = {
      ...target,
      text: cleanedText,
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: currentUserEmail || target.actor || 'Inspector'
    };

    setInspectorObservations((prev) =>
      prev.map((entry) =>
        entry.id === observationId
          ? updatedObservation
          : entry
      )
    );
    setReportNeedsRegeneration(true);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Observation updated (${updatedObservation.requirement})`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);

    if (isActiveCasePersisted) {
      persistObservationUpdate({
        caseId: currentCaseMeta.caseId,
        observationId,
        observation: updatedObservation,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist observation update', error);
      });
    }
  };

  const handleDeleteObservation = (observationId) => {
    const target = inspectorObservations.find((entry) => entry.id === observationId);
    if (!target) return;

    setInspectorObservations((prev) => prev.filter((entry) => entry.id !== observationId));
    setReportNeedsRegeneration(true);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Observation deleted (${target.requirement})`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);

    if (isActiveCasePersisted) {
      persistObservationDelete({
        caseId: currentCaseMeta.caseId,
        observationId,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist observation delete', error);
      });
    }
  };

  const openDocumentsFilePicker = useCallback(() => {
    documentsUploadInputRef.current?.click();
  }, []);

  const buildUploadItem = useCallback(
    (fileOrName, indexOffset = 0) => {
      const isFileObject = typeof File !== 'undefined' && fileOrName instanceof File;
      const incomingName = isFileObject ? fileOrName.name : fileOrName;
      const fallbackName = `uploaded-evidence-${uploadItems.length + indexOffset + 1}.pdf`;
      const resolvedName = coerceText(incomingName).trim() || fallbackName;
      const draft = {
        id: `up${Date.now()}-${indexOffset}-${Math.random().toString(36).slice(2, 7)}`,
        name: resolvedName,
        filename: resolvedName,
        file: isFileObject ? fileOrName : null,
        isLocalDraft: true,
        status: 'queued',
        classification: 'Unknown',
        parties: 'Firm',
        interviewees: [],
        confidence: '',
        addedOn: toIsoDate(new Date()),
        summary: 'Awaiting classification and inspector verification.'
      };
      return prepareUploadDraft(draft);
    },
    [uploadItems.length]
  );

  const addUploadItems = useCallback(
    (filesOrNames = []) => {
      const sourceItems = Array.isArray(filesOrNames) ? filesOrNames : [];
      const newItems =
        sourceItems.length > 0
          ? sourceItems.map((item, index) => buildUploadItem(item, index))
          : [buildUploadItem('', 0)];

      setUploadItems((prev) => [...newItems, ...prev]);
      setReportNeedsRegeneration(true);

    },
    [buildUploadItem]
  );

  const handleUploadFileSelection = useCallback(
    (event) => {
      const files = Array.from(event.target.files ?? []).filter((file) =>
        /\.(pdf|json)$/i.test(coerceText(file?.name)) ||
        file?.type === 'application/pdf' ||
        file?.type === 'application/json' ||
        file?.type === 'text/json'
      );
      if (files.length > 0) {
        addUploadItems(files);
      }
      event.target.value = '';
    },
    [addUploadItems]
  );

  const handleUploadDrop = useCallback(
    (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
        /\.(pdf|json)$/i.test(coerceText(file?.name)) ||
        file?.type === 'application/pdf' ||
        file?.type === 'application/json' ||
        file?.type === 'text/json'
      );
      if (files.length > 0) {
        addUploadItems(files);
      }
    },
    [addUploadItems]
  );

  const persistUpdatedUploadItem = useCallback(
    (updatedItem) => {
      if (!isActiveCasePersisted || !updatedItem) return;
      persistUploadItem({
        caseId: currentCaseMeta.caseId,
        uploadItem: updatedItem,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist upload item edit', error);
      });
    },
    [currentCaseMeta.caseId, currentUser, isActiveCasePersisted]
  );

  const handleRemoveUploadItem = useCallback(
    (uploadId) => {
      const cleanUploadId = String(uploadId || '').trim();
      if (!cleanUploadId) return;

      const target = uploadItems.find((item) => item.id === cleanUploadId);
      if (!target || target.status !== 'queued') return;

      setUploadItems((prev) => prev.filter((item) => item.id !== cleanUploadId));
      setActiveClassificationMenu((prev) => (prev === cleanUploadId ? null : prev));
      setReportNeedsRegeneration(true);

      if (!isActiveCasePersisted || target.isLocalDraft) return;

      persistUploadItemDelete({
        caseId: currentCaseMeta.caseId,
        uploadId: cleanUploadId,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to delete upload item', error);
      });
    },
    [currentCaseMeta.caseId, currentUser, isActiveCasePersisted, uploadItems]
  );

  const handleUploadClassificationSelect = (uploadId, groupLabel, optionLabel) => {
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;

        const nextBase = {
          ...entry,
          confirmed: false,
          classification: optionLabel === DOCUMENT_CLASSIFICATION_OTHER_OPTION ? groupLabel : optionLabel,
          classificationL1: groupLabel,
          classificationL2: optionLabel,
          classificationDetail:
            optionLabel === DOCUMENT_CLASSIFICATION_OTHER_OPTION ? entry.classificationDetail ?? '' : '',
          reviewDecision: '',
          limitedAnalysis: optionLabel === DOCUMENT_CLASSIFICATION_OTHER_OPTION,
          confidence: optionLabel === DOCUMENT_CLASSIFICATION_OTHER_OPTION ? 'low' : 'high',
          classification_confidence: optionLabel === DOCUMENT_CLASSIFICATION_OTHER_OPTION ? null : 0.98,
          status: 'classified',
          classificationReason: buildClassificationReason(entry.name, optionLabel),
          interviewees:
            optionLabel === 'Interview Transcript'
              ? normalizeUploadInterviewees(entry)
              : []
        };

        let nextEntry = prepareUploadDraft(nextBase);
        if (optionLabel === 'Interview Transcript' && nextEntry.interviewees.length === 0) {
          nextEntry = prepareUploadDraft({
            ...nextEntry,
            interviewees: [createIntervieweeDraft(`interviewee-${uploadId}`)]
          });
        }

        updatedItem = nextEntry;
        return nextEntry;
      })
    );
    setActiveClassificationMenu(null);
    setReportNeedsRegeneration(true);
    persistUpdatedUploadItem(updatedItem);
  };

  const handleUploadClassificationDetailChange = (uploadId, value) => {
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;

        const hasDetail = String(value || '').trim().length > 0;
        const nextEntry = prepareUploadDraft({
          ...entry,
          confirmed: false,
          reviewDecision: '',
          classificationDetail: value,
          confidence: 'low',
          classification_confidence: null,
          limitedAnalysis: !hasDetail,
          status: isUploadClassificationResolved(entry) ? 'classified' : 'queued'
        });
        updatedItem = nextEntry;
        return nextEntry;
      })
    );
    setReportNeedsRegeneration(true);
    persistUpdatedUploadItem(updatedItem);
  };

  const handleAddUploadInterviewee = (uploadId) => {
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;

        const nextEntry = prepareUploadDraft({
          ...entry,
          confirmed: false,
          reviewDecision: '',
          interviewees: [...normalizeUploadInterviewees(entry), createIntervieweeDraft(`interviewee-${uploadId}`)],
          status: 'classified'
        });
        updatedItem = nextEntry;
        return nextEntry;
      })
    );
    setReportNeedsRegeneration(true);
    persistUpdatedUploadItem(updatedItem);
  };

  const handleUpdateUploadInterviewee = (uploadId, intervieweeId, field, value) => {
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;

        const nextInterviewees = normalizeUploadInterviewees(entry).map((interviewee) =>
          interviewee.id === intervieweeId ? { ...interviewee, [field]: value } : interviewee
        );
        const nextEntry = prepareUploadDraft({
          ...entry,
          confirmed: false,
          reviewDecision: '',
          interviewees: nextInterviewees,
          status: 'classified'
        });
        updatedItem = nextEntry;
        return nextEntry;
      })
    );
    setReportNeedsRegeneration(true);
    persistUpdatedUploadItem(updatedItem);
  };

  const handleRemoveUploadInterviewee = (uploadId, intervieweeId) => {
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;

        const nextEntry = prepareUploadDraft({
          ...entry,
          confirmed: false,
          reviewDecision: '',
          interviewees: normalizeUploadInterviewees(entry).filter((interviewee) => interviewee.id !== intervieweeId),
          status: 'classified'
        });
        updatedItem = nextEntry;
        return nextEntry;
      })
    );
    setReportNeedsRegeneration(true);
    persistUpdatedUploadItem(updatedItem);
  };

  const handleUploadFieldChange = (uploadId, field, value) => {
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;
        const nextStatus =
          field === 'classification' && value === 'Unknown'
            ? 'queued'
            : field === 'status'
              ? value
              : entry.status === 'removed'
                ? 'removed'
              : field === 'classificationJustification'
                ? entry.status
              : isUploadClassificationResolved(entry)
                ? entry.status === 'verified'
                  ? 'verified'
                  : 'classified'
                : 'queued';
        const nextEntry = prepareUploadDraft({
          ...entry,
          [field]: value,
          status: nextStatus
        });
        updatedItem = nextEntry;
        return nextEntry;
      })
    );
    if (field === 'classification') {
      setActiveClassificationMenu(null);
    }
    setReportNeedsRegeneration(true);
    persistUpdatedUploadItem(updatedItem);
  };

  const handleSetUploadReviewDecision = (uploadId, nextDecisionValue) => {
    const nextDecision = nextDecisionValue === 'confirm' || nextDecisionValue === 'remove' ? nextDecisionValue : '';
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;

        const normalizedEntry = prepareUploadDraft(entry);
        const nextStatus = !isUploadClassificationResolved(normalizedEntry)
          ? 'queued'
          : nextDecision === 'remove'
            ? 'removed'
            : nextDecision === 'confirm'
              ? 'verified'
              : 'classified';
        const nextEntry = prepareUploadDraft({
          ...entry,
          reviewDecision: nextDecision,
          status: nextStatus,
          confirmed: nextDecision === 'confirm'
        });
        updatedItem = nextEntry;
        return nextEntry;
      })
    );
    setReportNeedsRegeneration(true);
    persistUpdatedUploadItem(updatedItem);
  };

  const handleToggleUploadConfirmed = (uploadId) => {
    const target = uploadItems.find((item) => item.id === uploadId);
    if (!target) return;
    if (!isUploadReadyForConfirmation(target)) return;

    const nextStatus = target.status === 'verified' ? 'classified' : 'verified';
    const nextItem = prepareUploadDraft({
      ...target,
      status: nextStatus,
      confirmed: nextStatus === 'verified'
    });
    setUploadItems((prev) =>
      prev.map((item) => (item.id === uploadId ? nextItem : item))
    );
    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}-${uploadId}`,
        detail:
          nextStatus === 'verified'
            ? `Document confirmed: ${target.name}`
            : `Document unconfirmed: ${target.name}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    setReportNeedsRegeneration(true);
    persistUpdatedUploadItem(nextItem);
  };

  const confirmAllEligibleUploads = () => {
    const verifiedUploads = uploadItems
      .filter((item) => isUploadReadyForConfirmation(item))
      .map((item) => prepareUploadDraft({ ...item, status: 'verified' }));
    if (verifiedUploads.length === 0) return;

    setUploadItems((prev) =>
      prev.map((item) =>
        isUploadReadyForConfirmation(item) ? prepareUploadDraft({ ...item, status: 'verified' }) : item
      )
    );
    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}-all`,
        detail: `${verifiedUploads.length} documents confirmed in bulk`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    setReportNeedsRegeneration(true);
    if (isActiveCasePersisted) {
      persistConfirmAllUploads({
        caseId: currentCaseMeta.caseId,
        uploadItems: verifiedUploads,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist bulk upload confirmation', error);
      });
    }
  };

  const handleConfirmAllUploads = () => {
    if (confirmableUploadCount === 0) return;
    if (!hasViewedUploadTableEnd) {
      setConfirmAllUploadsGateOpen(true);
      return;
    }
    confirmAllEligibleUploads();
  };

  const handleRunClassification = () => {
    if (uploadItems.length === 0) return;
    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}-classification`,
        detail: 'AI document classification triggered by inspector',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    startProcessingRun(PROCESSING_MODE_CLASSIFICATION);
  };

  const handleRerunClassification = () => {
    if (uploadItems.length === 0) return;
    const queuedUploads = uploadItems.map((item) =>
      prepareUploadDraft({
        ...item,
        status: 'queued',
        confirmed: false,
        reviewDecision: ''
      })
    );

    setUploadItems(queuedUploads);
    setReportNeedsRegeneration(true);
    if (isActiveCasePersisted) {
      queuedUploads.forEach((uploadItem) => persistUpdatedUploadItem(uploadItem));
    }

    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}-reclassify`,
        detail: 'AI document reclassification triggered by inspector',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    startProcessingRun(PROCESSING_MODE_CLASSIFICATION);
  };

  const handleGenerateFindings = () => {
    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}`,
        detail: 'Generate findings triggered by inspector',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    setReportNeedsRegeneration(true);
    setDocumentWorkspaceTab('findings');
    startProcessingRun(PROCESSING_MODE_FINDINGS);
    if (isActiveCasePersisted) {
      persistGenerateFindingsEvent({
        caseId: currentCaseMeta.caseId,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist generate findings event', error);
      });
    }
  };

  const applyGeneratedReport = (mode = 'generate') => {
    const nextGeneratedSections = buildReportSectionLines({}, '');
    const nextReportActions = reportActionBaselineItems.map((item) => ({ ...item }));
    const nextActionIds = new Set(nextReportActions.map((item) => item.id));
    const removedActionIds = reportActionItems
      .map((item) => item.id)
      .filter((actionId) => !nextActionIds.has(actionId));
    setReportRegenerateConfirmOpen(false);
    setReportPendingAction('generate');
    setHasGeneratedReport(true);
    setEditedReportSections({ interviews: false, summary: false, attention: false, goodPractice: false });
    setReportOriginalSectionNarrativesByCodeArea({});
    setReportSectionNarrativesByCodeArea({});
    setReportOriginalExecutiveSummary(nextGeneratedSections.summary?.[0] ?? '');
    setReportExecutiveSummaryOverride(nextGeneratedSections.summary?.[0] ?? '');
    setReportActionOriginalItems(nextReportActions.map((item) => ({ ...item })));
    setReportActionItems(nextReportActions);
    setDocsMarkedForReprocess({});
    setPendingScopeChangeCount(0);
    setReportPendingChanges(false);
    setReportNeedsRegeneration(false);
    setReportDraftVersion((prev) => prev + 1);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail:
          mode === 'regenerate'
            ? 'Report regenerated from latest findings'
            : 'Report generated from current in-scope findings',
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);

    if (isActiveCasePersisted) {
      persistGenerateReport({
        caseId: currentCaseMeta.caseId,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist report regeneration event', error);
      });

      Promise.all(
        nextReportActions.map(async (actionItem) => {
          const persisted = await persistReportAction({
            caseId: currentCaseMeta.caseId,
            actionItem,
            user: currentUser
          });
          return {
            localId: actionItem.id,
            persistedId: String(persisted?.id || persisted?.action_id || '').trim()
          };
        })
      ).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist report action baseline', error);
      }).then((results) => {
        if (!Array.isArray(results) || results.length === 0) return;
        const idReplacements = new Map(
          results
            .filter((row) => row.persistedId && row.persistedId !== row.localId)
            .map((row) => [row.localId, row.persistedId])
        );
        if (idReplacements.size === 0) return;
        setReportActionItems((prev) =>
          prev.map((entry) =>
            idReplacements.has(entry.id)
              ? { ...entry, id: idReplacements.get(entry.id) || entry.id }
              : entry
          )
        );
      });

      removedActionIds.forEach((actionId) => {
        void deleteReportActionItem(actionId);
      });
    }
  };

  const runReportGeneration = async (mode = 'generate') => {
    if (reportGenerationInProgress) return;

    setReportGenerationMode(mode);
    setReportGenerationInProgress(true);
    setReportPendingGateOpen(false);
    setReportRegenerateConfirmOpen(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      applyGeneratedReport(mode);
    } finally {
      setReportGenerationInProgress(false);
    }
  };

  const handleGenerateReport = () => {
    if (availableFindings.length === 0) return;
    if (reportGenerationInProgress) return;
    if (reportIncludedFindings.length === 0) return;
    if (reportPendingChanges) {
      setReportPendingAction('generate');
      setReportPendingGateOpen(true);
      return;
    }
    void runReportGeneration('generate');
  };

  const scrollWorkspaceToTop = useCallback(() => {
    const workspaceMain = document.querySelector('.workspace-main');
    if (workspaceMain instanceof HTMLElement) {
      workspaceMain.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleAttemptOverviewReport = () => {
    if (availableFindings.length === 0) {
      setReportAccessNotice('Generate findings from the selected documents before creating the report.');
      return;
    }

    setReportAccessNotice('');
    setMaxStepUnlocked((prev) => Math.max(prev, STEP_REPORT));
    setCurrentStep(STEP_REPORT);
    requestAnimationFrame(scrollWorkspaceToTop);

    if (reportCanGenerate && (reportNeedsRegeneration || !hasGeneratedReport) && !reportGenerationInProgress) {
      void runReportGeneration(hasGeneratedReport ? 'regenerate' : 'generate');
    }
  };

  const handleConfirmReportRegenerate = () => {
    if (reportGenerationInProgress) return;
    void runReportGeneration('regenerate');
  };

  const handleDeleteFinding = async (findingId) => {
    const target = allFindings.find((finding) => finding.id === findingId);
    if (!target) return;

    setDeletedFindingIds((prev) => ({ ...prev, [findingId]: true }));
    if (isInspectorAddedFinding(target)) {
      setInspectorFindings((prev) => prev.filter((entry) => entry.id !== findingId));
    }
    setReportNeedsRegeneration(true);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Finding deleted: ${target.title}`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);

    if (isActiveCasePersisted && currentCaseMeta.caseId && isInspectorAddedFinding(target)) {
      try {
        await persistInspectorFindingDelete({
          caseId: currentCaseMeta.caseId,
          findingId: target.id,
          user: currentUser
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete manual finding in data provider', error);
      }
    }
  };

  const handleRestoreNotAssessedArea = (areaLabel) => {
    const nextAreaLabel = safeText(areaLabel, '').trim();
    if (!nextAreaLabel) return;

    setNotAssessedAreas((prev) => prev.filter((entry) => entry !== nextAreaLabel));
    setPendingScopeChangeCount((prev) => prev + 1);
    setReportPendingChanges(true);
    setReprocessBannerDismissed(false);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Code area restored to assessment: ${nextAreaLabel}`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
  };

  const handleExportReport = async () => {
    const appendReportExportHistory = () => {
      setHistoryItems((items) => [
        {
          id: `h${Date.now()}`,
          ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detail: 'Report export generated',
          actor: currentUserEmail || 'Inspector'
        },
        ...items
      ]);
    };
    const triggerBlobDownload = (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    };
    const reportFilename = `CLC_Inspection_Report_${currentCaseMeta.caseId || 'case'}.pdf`;

    if (reportExportRef.current) {
      try {
        const { blob, filename } = await exportStyledInspectionReportPdf({
          element: reportExportRef.current,
          filename: reportFilename,
          caseLabel: currentCaseMeta.caseId || currentCaseMeta.practiceName
        });
        triggerBlobDownload(blob, filename);
        appendReportExportHistory();
        return;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to export styled report, falling back to generated PDF', error);
      }
    }

    if (isActiveCasePersisted) {
      try {
        const exportedReport = await exportCaseReport({
          caseId: currentCaseMeta.caseId,
          format: 'pdf'
        });
        if (exportedReport?.supported && exportedReport?.downloadUrl) {
          const anchor = document.createElement('a');
          anchor.href = exportedReport.downloadUrl;
          anchor.download = exportedReport.filename || `CLC_Inspection_Report_${currentCaseMeta.caseId}.pdf`;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          if (exportedReport.revokeOnUse) {
            URL.revokeObjectURL(exportedReport.downloadUrl);
          }
          appendReportExportHistory();
          return;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to export report via provider, falling back to local export', error);
      }
    }

    const totalFindings = reportIncludedFindings.length;
    const criticalCount = reportAttentionFindings.filter((finding) => getFindingBucketId(finding) === 'critical').length;
    const leadCount = reportAttentionFindings.filter((finding) => getFindingBucketId(finding) === 'warning').length;
    const compliantCount = reportIncludedFindings.filter((finding) => getFindingBucketId(finding) === 'pass').length;
    const goodPracticeCount = reportGoodPracticeFindings.length;
    const actionPlanLines = reportActionItems.map(
      (item) =>
        `[${item.codeRef ? `${item.codeRef} | ` : ''}${item.codeArea}] ${item.action} | Deadline: ${
          item.deadline || 'TBD'
        } | Owner: ${item.person || 'Unassigned'}`
    );
    const goodPracticeLines =
      reportGoodPracticeFindings.length > 0
        ? reportGoodPracticeFindings.slice(0, 4).map((finding, index) => {
            const narrative = safeText(
              reportSectionDefaults.goodPractice[index],
              safeText(finding.detail, safeText(finding.title, 'Good Practice finding'))
            );
            const codeArea = formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General'));
            return `${codeArea}: ${narrative}`;
          })
        : reportSectionDefaults.goodPractice;
    const attentionLines =
      reportAttentionFindings.length > 0
        ? reportAttentionFindings.slice(0, 8).map((finding, index) => {
            const narrative = safeText(
              reportSectionDefaults.attention[index],
              safeText(finding.detail, safeText(finding.title, 'Attention finding'))
            );
            const codeArea = formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General'));
            return `${codeArea}: ${narrative}`;
          })
        : reportSectionDefaults.attention;
    const appendixLines = reportAppendixRows.map(
      (row) => `${row.id} | ${row.severity} | ${row.codeArea} | ${row.finding}`
    );
    const { blob, filename } = createInspectionReportPdf({
      caseMeta: {
        practiceName: currentCaseMeta.practiceName,
        caseId: currentCaseMeta.caseId,
        inspector: currentCaseMeta.owner,
        inspectionDate: currentCaseMeta.started,
        inspectionType: reportInspectionType,
        holp: currentCaseMeta.holp,
        hofa: currentCaseMeta.hofa
      },
      summaryLines: [
        `Total findings: ${totalFindings}`,
        `Non-compliant: ${criticalCount}`,
        `Inconclusive: ${leadCount}`,
        `Compliant: ${compliantCount}`,
        `Good practice: ${goodPracticeCount}`
      ],
      sections: [
        { heading: 'Interviews Conducted', lines: reportSectionDefaults.interviews, bulleted: true },
        { heading: 'Compliance Summary', lines: reportSectionDefaults.summary },
        { heading: 'Areas of Good Practice', lines: goodPracticeLines, bulleted: true },
        { heading: 'Areas Requiring Attention', lines: attentionLines, bulleted: true },
        ...(actionPlanLines.length > 0
          ? [{ heading: 'Action Plan', lines: actionPlanLines, bulleted: true }]
          : []),
        ...(caseContextNotes.length > 0
          ? [
              {
                heading: 'Case Context Notes',
                lines: caseContextNotes
                  .slice(0, 8)
                  .map((note) => `${note.text} (${note.ts}, ${note.actor})`),
                bulleted: true
              }
            ]
          : []),
        ...(inspectorObservations.length > 0
          ? [
              {
                heading: 'Inspector Observations',
                lines: inspectorObservations
                  .slice(0, 8)
                  .map((obs) => `[${obs.requirement}] ${obs.text} (${obs.sourceType}, ${obs.ts})`),
                bulleted: true
              }
            ]
          : []),
        ...(appendixLines.length > 0
          ? [{ heading: 'Appendix - Detailed Findings', lines: appendixLines, bulleted: true }]
          : [])
      ],
      filename: `CLC_Inspection_Report_${currentCaseMeta.caseId}.pdf`
    });
    triggerBlobDownload(blob, filename);
    appendReportExportHistory();
  };

  const createComposerDocumentAnchor = useCallback(
    (documentId) => {
      const documentRow = documentsById.get(documentId);
      const availableBoxes = Array.isArray(documentRow?.overlay?.boxes) ? documentRow.overlay.boxes : [];
      const preferredBoxId =
        documentId === activeDocId
          ? coerceText(activeDocBoxId) || coerceText(availableBoxes[0]?.id)
          : coerceText(availableBoxes[0]?.id);
      return {
        useHighlight: Boolean(preferredBoxId),
        boxId: preferredBoxId || '',
        note: ''
      };
    },
    [activeDocBoxId, activeDocId, documentsById]
  );

  const updateComposerDocumentAnchor = useCallback(
    (documentId, updater) => {
      setComposerModal((prev) => {
        const currentAnchor = prev.documentAnchors?.[documentId] ?? createComposerDocumentAnchor(documentId);
        const nextAnchor =
          typeof updater === 'function'
            ? updater(currentAnchor)
            : { ...currentAnchor, ...updater };
        return {
          ...prev,
          documentAnchors: {
            ...(prev.documentAnchors ?? {}),
            [documentId]: nextAnchor
          }
        };
      });
    },
    [createComposerDocumentAnchor]
  );

  const toggleComposerDocument = useCallback(
    (documentId, checked) => {
      setComposerModal((prev) => {
        const selectedDocumentIds = new Set(prev.selectedDocumentIds ?? []);
        const nextAnchors = { ...(prev.documentAnchors ?? {}) };

        if (checked) {
          selectedDocumentIds.add(documentId);
          if (!nextAnchors[documentId]) {
            nextAnchors[documentId] = createComposerDocumentAnchor(documentId);
          }
        } else {
          selectedDocumentIds.delete(documentId);
          delete nextAnchors[documentId];
        }

        return {
          ...prev,
          selectedDocumentIds: Array.from(selectedDocumentIds),
          documentAnchors: nextAnchors
        };
      });
    },
    [createComposerDocumentAnchor]
  );

  const composerSelectedDocuments = useMemo(
    () =>
      (composerModal.selectedDocumentIds ?? [])
        .map((documentId) => documentsById.get(documentId))
        .filter(Boolean),
    [composerModal.selectedDocumentIds, documentsById]
  );

  const isComposerDocumentAnchorComplete = useCallback(
    (documentId) => {
      const anchor = composerModal.documentAnchors?.[documentId];
      const documentRow = documentsById.get(documentId);
      const hasBoxes = Array.isArray(documentRow?.overlay?.boxes) && documentRow.overlay.boxes.length > 0;
      if (anchor?.useHighlight && hasBoxes) {
        return Boolean(coerceText(anchor?.boxId));
      }
      return Boolean(coerceText(anchor?.note).trim());
    },
    [composerModal.documentAnchors, documentsById]
  );
  const isComposerEvidenceStepValid = useMemo(
    () =>
      composerSelectedDocuments.length > 0 &&
      composerSelectedDocuments.every((documentRow) => isComposerDocumentAnchorComplete(documentRow.id)),
    [composerSelectedDocuments, isComposerDocumentAnchorComplete]
  );

  const buildManualFindingEvidencePassage = useCallback(
    (documentId, anchor, fallbackText, passageId) => {
      const documentRow = documentsById.get(documentId);
      if (!documentRow) return null;

      const documentLabel =
        coerceText(documentRow?.filename) || coerceText(documentRow?.label) || 'Case document';
      const selectedBox = Array.isArray(documentRow?.overlay?.boxes)
        ? documentRow.overlay.boxes.find((box) => coerceText(box?.id) === coerceText(anchor?.boxId)) ?? null
        : null;
      const boxId = coerceText(selectedBox?.id) || null;
      const pageNumber = Number.isFinite(selectedBox?.page) ? selectedBox.page : null;
      const noteText = coerceText(anchor?.note).trim();
      const snippet =
        coerceText(selectedBox?.details) || coerceText(selectedBox?.title) || noteText || fallbackText;

      return {
        id: passageId,
        documentId,
        document_id: documentId,
        documentName: documentLabel,
        document_name: documentLabel,
        file: documentLabel,
        boxId,
        box_id: boxId,
        page: pageNumber,
        pages: Number.isFinite(pageNumber) ? [pageNumber] : [],
        bboxes: Array.isArray(selectedBox?.bbox) ? [selectedBox.bbox] : [],
        excerpt: snippet,
        text: noteText || snippet,
        text_description: noteText || snippet || null,
        section: coerceText(selectedBox?.category) || (anchor?.useHighlight ? 'Highlighted passage' : 'Evidence note')
      };
    },
    [documentsById]
  );
  const createLeadConfirmDocumentAnchor = useCallback(
    (finding, documentId) => {
      const documentRow = documentsById.get(documentId);
      const availableBoxes = Array.isArray(documentRow?.overlay?.boxes) ? documentRow.overlay.boxes : [];
      const rawPassages = Array.isArray(finding?.evidence_passages)
        ? finding.evidence_passages
        : Array.isArray(finding?.evidencePassages)
          ? finding.evidencePassages
          : [];
      const matchedPassage =
        rawPassages.find(
          (passage) =>
            coerceText(passage?.document_id || passage?.documentId || finding?.documentId) ===
            coerceText(documentId)
        ) ?? null;
      const preferredBoxId =
        getFindingPreferredBoxIdForDocument(finding, documentId) ||
        (documentId === activeDocId ? coerceText(activeDocBoxId) : '') ||
        coerceText(availableBoxes[0]?.id);

      return {
        useHighlight: Boolean(preferredBoxId),
        boxId: preferredBoxId || '',
        note: coerceText(
          matchedPassage?.text_description || matchedPassage?.text || matchedPassage?.excerpt
        ).trim()
      };
    },
    [activeDocBoxId, activeDocId, documentsById]
  );

  const updateLeadConfirmDocumentAnchor = useCallback(
    (documentId, updater) => {
      if (!leadConfirmFinding) return;
      setLeadConfirmModal((prev) => {
        const currentAnchor =
          prev.documentAnchors?.[documentId] ?? createLeadConfirmDocumentAnchor(leadConfirmFinding, documentId);
        const nextAnchor =
          typeof updater === 'function'
            ? updater(currentAnchor)
            : { ...currentAnchor, ...updater };
        return {
          ...prev,
          documentAnchors: {
            ...(prev.documentAnchors ?? {}),
            [documentId]: nextAnchor
          }
        };
      });
    },
    [createLeadConfirmDocumentAnchor, leadConfirmFinding]
  );

  const toggleLeadConfirmDocument = useCallback(
    (documentId, checked) => {
      if (!leadConfirmFinding) return;
      setLeadConfirmModal((prev) => {
        const selectedDocumentIds = new Set(prev.selectedDocumentIds ?? []);
        const nextAnchors = { ...(prev.documentAnchors ?? {}) };

        if (checked) {
          selectedDocumentIds.add(documentId);
          if (!nextAnchors[documentId]) {
            nextAnchors[documentId] = createLeadConfirmDocumentAnchor(leadConfirmFinding, documentId);
          }
        } else {
          selectedDocumentIds.delete(documentId);
          delete nextAnchors[documentId];
        }

        return {
          ...prev,
          selectedDocumentIds: Array.from(selectedDocumentIds),
          documentAnchors: nextAnchors
        };
      });
    },
    [createLeadConfirmDocumentAnchor, leadConfirmFinding]
  );

  const leadConfirmSelectedDocuments = useMemo(
    () =>
      (leadConfirmModal.selectedDocumentIds ?? [])
        .map((documentId) => documentsById.get(documentId))
        .filter(Boolean),
    [documentsById, leadConfirmModal.selectedDocumentIds]
  );

  const isLeadConfirmDocumentAnchorComplete = useCallback(
    (documentId) => {
      const anchor = leadConfirmModal.documentAnchors?.[documentId];
      const documentRow = documentsById.get(documentId);
      const hasBoxes = Array.isArray(documentRow?.overlay?.boxes) && documentRow.overlay.boxes.length > 0;
      if (anchor?.useHighlight && hasBoxes) {
        return Boolean(coerceText(anchor?.boxId));
      }
      return Boolean(coerceText(anchor?.note).trim());
    },
    [documentsById, leadConfirmModal.documentAnchors]
  );

  const isLeadConfirmEvidenceReady = useMemo(
    () =>
      leadConfirmSelectedDocuments.length > 0 &&
      leadConfirmSelectedDocuments.every((documentRow) => isLeadConfirmDocumentAnchorComplete(documentRow.id)),
    [isLeadConfirmDocumentAnchorComplete, leadConfirmSelectedDocuments]
  );

  const openComposerModal = (type) => {
    const defaultDocumentId = activeDocId || caseDocuments[0]?.id || '';
    setManualEvidenceModalOpen(false);
    setComposerModal({
      open: true,
      type,
      step: 1,
      text: '',
      sourceType: type === 'manual' ? '' : OBSERVATION_SOURCE_OPTIONS[0],
      requirement: FINDING_REQUIREMENT_OPTIONS[0],
      selectedRequirements: [FINDING_REQUIREMENT_OPTIONS[0]],
      polarity: 'non_compliant',
      goodPractice: false,
      evidenceType: type === 'manual' ? '' : 'document',
      evidenceNote: '',
      selectedDocumentIds: defaultDocumentId ? [defaultDocumentId] : [],
      documentAnchors: defaultDocumentId
        ? { [defaultDocumentId]: createComposerDocumentAnchor(defaultDocumentId) }
        : {}
    });
  };

  const closeComposerModal = () => {
    setManualEvidenceModalOpen(false);
    setComposerModal((prev) => ({ ...prev, open: false }));
  };

  const openManualEvidenceFlow = useCallback(() => {
    setComposerModal((prev) => ({ ...prev, open: false }));
    setManualEvidenceModalOpen(true);
  }, []);

  const handleManualEvidenceBack = useCallback(() => {
    setManualEvidenceModalOpen(false);
    setComposerModal((prev) => ({ ...prev, open: true, step: 2 }));
  }, []);

  const submitComposerModal = async () => {
    const label = composerModal.type === 'manual' ? 'Manual finding added' : 'General observation added';
    const cleanedText = composerModal.text.trim();
    if (!cleanedText) return;
    const selectedRequirements =
      composerModal.selectedRequirements?.length
        ? composerModal.selectedRequirements
        : [composerModal.requirement || FINDING_REQUIREMENT_OPTIONS[0]];
    if (composerModal.type === 'manual') {
      const title =
        cleanedText.length > 96 ? `${cleanedText.slice(0, 93).trim()}...` : cleanedText;
      const createdAtKey = Date.now();
      const selectedDocumentIds =
        composerModal.evidenceType === 'document'
          ? (composerModal.selectedDocumentIds ?? []).filter((documentId) => documentsById.has(documentId))
          : [];

      if (composerModal.evidenceType === 'document') {
        if (selectedDocumentIds.length === 0) return;
        if (!selectedDocumentIds.every((documentId) => isComposerDocumentAnchorComplete(documentId))) {
          return;
        }
      }

      const evidencePassageTemplates =
        composerModal.evidenceType === 'document'
          ? selectedDocumentIds
              .map((documentId, docIndex) =>
                buildManualFindingEvidencePassage(
                  documentId,
                  composerModal.documentAnchors?.[documentId],
                  cleanedText,
                  `inspector-${createdAtKey}-template-${docIndex}`
                )
              )
              .filter(Boolean)
          : [];
      const primaryPassage = evidencePassageTemplates[0] ?? null;
      const linkedDocumentId = primaryPassage?.documentId || '';
      const sectionLabel =
        composerModal.evidenceType === 'document'
          ? evidencePassageTemplates.length > 1
            ? 'Multi-document evidence'
            : primaryPassage?.section || 'Document evidence'
          : composerModal.sourceType;
      const sourceFile =
        composerModal.evidenceType === 'document'
          ? evidencePassageTemplates.length > 1
            ? `${evidencePassageTemplates.length} linked documents`
            : primaryPassage?.documentName || 'Linked document'
          : 'Case-level';
      const sourceText =
        composerModal.evidenceType === 'document'
          ? primaryPassage?.text || cleanedText
          : composerModal.evidenceNote?.trim() || cleanedText;
      let generatedFindings = selectedRequirements.map((requirement, index) => ({
        id: `inspector-${createdAtKey}-${index}`,
        severity: deriveLegacyFindingSeverity({
          certainty: 'finding',
          polarity: composerModal.polarity,
          isGoodPractice: composerModal.polarity === 'compliant' && composerModal.goodPractice,
          reviewStatus: 'unreviewed'
        }),
        title,
        detail: cleanedText,
        documentId: linkedDocumentId,
        boxId: primaryPassage?.boxId || null,
        codeArea: inferRequirementCodeArea(requirement),
        requirementId: requirement,
        certainty: 'finding',
        polarity: composerModal.polarity,
        isGoodPractice: composerModal.polarity === 'compliant' && composerModal.goodPractice,
        requirementSeverity: getRequirementSeverity(requirement),
        observationSource:
          composerModal.evidenceType === 'document' ? 'Document evidence' : composerModal.sourceType,
        reviewStatus: 'unreviewed',
        evidencePassages: evidencePassageTemplates.map((passage, passageIndex) => ({
          ...passage,
          id: `inspector-${createdAtKey}-${index}-passage-${passageIndex}`
        })),
        evidence_passages: evidencePassageTemplates.map((passage, passageIndex) => ({
          ...passage,
          id: `inspector-${createdAtKey}-${index}-passage-${passageIndex}`
        })),
        source: {
          file: sourceFile,
          page: composerModal.evidenceType === 'document' ? primaryPassage?.page ?? null : null,
          section: sectionLabel,
          text: sourceText
        },
        reference: `${requirement} · ${
          composerModal.evidenceType === 'document' ? 'Document evidence' : composerModal.sourceType
        }`,
        origin: 'inspector',
        isInspectorAdded: true
      }));

      if (isActiveCasePersisted && currentCaseMeta.caseId) {
        try {
          generatedFindings = await Promise.all(
            generatedFindings.map(async (manualFinding) => {
              const persisted = await persistInspectorFinding({
                caseId: currentCaseMeta.caseId,
                finding: manualFinding,
                user: currentUser
              });
              return {
                ...manualFinding,
                id: persisted?.id || persisted?.item_id || manualFinding.id,
                origin: persisted?.source || manualFinding.origin,
                isInspectorAdded: true
              };
            })
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to persist manual finding in data provider', error);
        }
      }

      setInspectorFindings((prev) => [...generatedFindings, ...prev]);
    }
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail:
          composerModal.type === 'observation'
            ? `${label} (${selectedRequirements.length} requirement${
                selectedRequirements.length === 1 ? '' : 's'
              })`
            : `${label} (${selectedRequirements.length} requirement${
                selectedRequirements.length === 1 ? '' : 's'
              })`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
    if (composerModal.type === 'observation') {
      const createdAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let generatedObservations = selectedRequirements.map((requirement, index) => ({
        id: `obs-${Date.now()}-${index}`,
        text: cleanedText,
        requirement,
        sourceType: composerModal.sourceType,
        ts: createdAt,
        actor: currentUserEmail || 'Inspector'
      }));

      if (isActiveCasePersisted && currentCaseMeta.caseId) {
        try {
          generatedObservations = await Promise.all(
            generatedObservations.map(async (entry) => {
              const persisted = await persistObservation({
                caseId: currentCaseMeta.caseId,
                observation: entry,
                user: currentUser
              });
              const persistedId = persisted?.id || entry.id;
              const persistedTs = persisted?.created_at ? formatTimeLabel(persisted.created_at) : entry.ts;
              const persistedActor =
                persisted?.author?.name || persisted?.actor?.name || persisted?.actorName || entry.actor;
              return {
                ...entry,
                id: persistedId,
                ts: persistedTs,
                actor: persistedActor
              };
            })
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to persist observation in data provider', error);
        }
      }

      setInspectorObservations((prev) => [...generatedObservations, ...prev]);
    }
    setReportNeedsRegeneration(true);
    setManualEvidenceModalOpen(false);
    closeComposerModal();
  };

  const openReggie = (scope = 'all') => {
    setReggieScope(scope);
    setReggieOpen(true);
  };

  const activeReggieChat = useMemo(
    () => reggieChats.find((chat) => chat.id === activeReggieChatId) ?? reggieChats[0] ?? null,
    [activeReggieChatId, reggieChats]
  );

  const reggieMessages = activeReggieChat?.messages ?? [];
  const reggieBusy = Boolean(activeReggieChat?.isStreaming);

  const clearReggieChatTimers = useCallback((chatId) => {
    const timerIds = reggieTimersRef.current[chatId] ?? [];
    timerIds.forEach((timerId) => window.clearTimeout(timerId));
    delete reggieTimersRef.current[chatId];
  }, []);

  const updateReggieChat = useCallback((chatId, updater) => {
    setReggieChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const nextChat = typeof updater === 'function' ? updater(chat) : { ...chat, ...updater };
        return {
          ...nextChat,
          updatedAt: Date.now()
        };
      })
    );
  }, []);

  const updateReggieChatMessage = useCallback(
    (chatId, messageId, updater) => {
      updateReggieChat(chatId, (chat) => ({
        ...chat,
        messages: (chat.messages ?? []).map((message) =>
          message.id === messageId
            ? typeof updater === 'function'
              ? updater(message)
              : { ...message, ...updater }
            : message
        )
      }));
    },
    [updateReggieChat]
  );

  const appendReggieMessage = useCallback(
    (chatId, message, { scope = reggieScope } = {}) => {
      updateReggieChat(chatId, (chat) => {
        const nextMessages = [...(chat.messages ?? []), message];
        const nextTitle =
          chat.title === 'New chat' && message.role === 'user'
            ? message.text.trim().slice(0, 48) || 'New chat'
            : chat.title;
        return {
          ...chat,
          title: nextTitle,
          scope,
          messages: nextMessages
        };
      });
    },
    [reggieScope, updateReggieChat]
  );

  const scheduleReggieChatMessage = useCallback(
    (chatId, message, delayMs, options = {}) => {
      const timerId = window.setTimeout(() => {
        appendReggieMessage(chatId, message, options);
        reggieTimersRef.current[chatId] = (reggieTimersRef.current[chatId] ?? []).filter(
          (entry) => entry !== timerId
        );
      }, delayMs);
      reggieTimersRef.current[chatId] = [...(reggieTimersRef.current[chatId] ?? []), timerId];
    },
    [appendReggieMessage]
  );

  const handleCreateNewReggieChat = useCallback(
    (scope = reggieScope) => {
      const nextChat = createReggieChat(scope);
      setReggieChats((prev) => [nextChat, ...prev]);
      setActiveReggieChatId(nextChat.id);
      setReggieScope(scope);
      setReggieInput('');
    },
    [reggieScope]
  );

  const handleSelectReggieChat = useCallback(
    (chatId) => {
      const selectedChat = reggieChats.find((chat) => chat.id === chatId);
      if (!selectedChat) return;
      setActiveReggieChatId(chatId);
      setReggieScope(selectedChat.scope || 'all');
      setReggieInput('');
    },
    [reggieChats]
  );

  const toggleFocusArea = (areaId) => {
    setSelectedFocusAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const handleSelectAllFocusAreas = () => {
    setSelectedFocusAreaIds(new Set(FOCUS_AREA_OPTIONS.map((area) => area.id)));
  };

  const handleDeselectAllFocusAreas = () => {
    setSelectedFocusAreaIds(new Set());
  };

  const handleApplyAmlPreset = () => {
    setSelectedFocusAreaIds(new Set(RISK_REGISTER_PRESET));
    setNotAssessedAreas(
      FOCUS_AREA_OPTIONS.filter((area) => !RISK_REGISTER_PRESET.includes(area.id)).map((area) => area.label)
    );
    setCaseSetupRiskLevel('medium');
    setCaseSetupTransactionType((prev) => prev || CASE_META.transactionType);
    setCaseSetupActingForLender((prev) => prev || (CASE_META.actingForLender ? 'yes' : 'no'));
    setCaseSetupAmlTier((prev) => prev || CASE_META.amlTier);
  };

  const handleApplyPracticePreset = (profile) => {
    if (!profile) return;
    setSelectedFocusAreaIds(new Set(profile.focusAreas || []));
    setNotAssessedAreas(
      FOCUS_AREA_OPTIONS.filter((area) => !(profile.focusAreas || []).includes(area.id)).map((area) => area.label)
    );
    setCaseSetupConcerns(profile.preInspectionConcerns || '');
  };

  const handleOpenNewCase = useCallback(() => {
    setCaseCreateError('');
    setCaseSetupPracticeName('');
    setCaseSetupHolp('');
    setCaseSetupHofa('');
    setCaseSetupRiskLevel('not-assessed');
    setCaseSetupTransactionType('');
    setCaseSetupActingForLender('');
    setCaseSetupAmlTier('');
    setCaseSetupPreviousInspection('');
    setCaseSetupConcerns('');
    setCaseSetupQuestionnaireFile('');
    setCaseSetupQuestionnaireFileBlob(null);
    setSelectedFocusAreaIds(new Set(FOCUS_AREA_OPTIONS.map((area) => area.id)));
    if (caseSetupFileInputRef.current) {
      caseSetupFileInputRef.current.value = '';
    }
    setCurrentCaseMeta(CASE_META);
    setAppMode('inspection');
    setCurrentStep(STEP_CASE_SETUP);
    setMaxStepUnlocked(STEP_CASE_SETUP);
  }, []);

  const setReportEditableRef = (section, index, node, meta = {}) => {
    const bucket = reportEditableRefs.current[section];
    const metaBucket = reportEditableMetaRefs.current[section];
    if (!bucket || !metaBucket) return;
    bucket[index] = node || null;
    metaBucket[index] = meta && typeof meta === 'object' ? meta : {};
  };

  const getReportSectionLines = useCallback((section, { codeAreaId = '' } = {}) => {
    const nodes = reportEditableRefs.current[section] ?? [];
    const metas = reportEditableMetaRefs.current[section] ?? [];
    return nodes
      .map((node, index) => ({
        text: String(node?.textContent || '').trim(),
        meta: metas[index] || {}
      }))
      .filter((entry) =>
        !codeAreaId || String(entry.meta?.codeAreaId || '').trim() === String(codeAreaId).trim()
      )
      .map((entry) => entry.text)
      .filter(Boolean);
  }, []);

  const queuePersistReportSection = useCallback(
    (section, { immediate = false, codeAreaId = '' } = {}) => {
      const cleanCaseId = currentCaseMeta.caseId?.trim();
      if (!isActiveCasePersisted || !cleanCaseId || !section) return;

      const resolveSectionIds = () => {
        const scopedCodeAreaId = String(codeAreaId || '').trim();
        if (scopedCodeAreaId) {
          const sectionId = reportSectionIdsByCodeArea[scopedCodeAreaId];
          return sectionId ? [sectionId] : [];
        }

        const directSectionId = String(section || '').trim();
        if (directSectionId.startsWith('section_')) return [directSectionId];

        if (section === 'attention') {
          const ids = reportAttentionFindings
            .map((finding) => normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, '')))
            .map((codeAreaId) => reportSectionIdsByCodeArea[codeAreaId])
            .filter(Boolean);
          return Array.from(new Set(ids));
        }

        if (section === 'goodPractice') {
          const ids = reportGoodPracticeFindings
            .map((finding) => normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, '')))
            .map((codeAreaId) => reportSectionIdsByCodeArea[codeAreaId])
            .filter(Boolean);
          return Array.from(new Set(ids));
        }

        return [];
      };

      const runPersist = async () => {
        const lines = getReportSectionLines(section, { codeAreaId });
        if (lines.length === 0) return;
        const resolvedSectionIds = resolveSectionIds();

        try {
          if (resolvedSectionIds.length > 0) {
            await Promise.all(
              resolvedSectionIds.map((sectionId) =>
                persistReportSectionPatch({
                  caseId: cleanCaseId,
                  sectionId,
                  lines,
                  codeAreaId: scopedCodeAreaId || undefined,
                  user: currentUser
                })
              )
            );
          }
          if (section === 'summary') {
            await persistReportPatch({
              caseId: cleanCaseId,
              report: {
                executive_summary: lines.join(' ')
              },
              user: currentUser
            });
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to persist report section "${section}"`, error);
        }
      };

      if (immediate) {
        const existing = reportSectionPersistTimersRef.current[section];
        if (existing) {
          clearTimeout(existing);
          delete reportSectionPersistTimersRef.current[section];
        }
        void runPersist();
        return;
      }

      const existing = reportSectionPersistTimersRef.current[section];
      if (existing) {
        clearTimeout(existing);
      }
      reportSectionPersistTimersRef.current[section] = setTimeout(() => {
        delete reportSectionPersistTimersRef.current[section];
        void runPersist();
      }, 450);
    },
    [
      currentCaseMeta.caseId,
      currentUser,
      getReportSectionLines,
      isActiveCasePersisted,
      normalizeCodeAreaId,
      reportAttentionFindings,
      reportGoodPracticeFindings,
      reportSectionIdsByCodeArea
    ]
  );

  const handleReportSectionEdited = useCallback(
    (section, options = {}) => {
      const scopedCodeAreaId = String(options?.codeAreaId || '').trim();
      if (section === 'summary') {
        const lines = getReportSectionLines('summary');
        setReportExecutiveSummaryOverride(lines.join(' ').trim());
      }
      if (scopedCodeAreaId && (section === 'attention' || section === 'goodPractice')) {
        const lines = getReportSectionLines(section, { codeAreaId: scopedCodeAreaId });
        setReportSectionNarrativesByCodeArea((prev) => ({
          ...prev,
          [scopedCodeAreaId]: lines
        }));
      }
      setEditedReportSections((prev) => ({ ...prev, [section]: true }));
      queuePersistReportSection(section, options);
    },
    [getReportSectionLines, queuePersistReportSection]
  );

  const handleRevertReportSection = (section) => {
    const defaults = reportSectionOriginals[section] ?? [];
    const nodes = reportEditableRefs.current[section] ?? [];
    defaults.forEach((value, idx) => {
      const node = nodes[idx];
      if (node) node.textContent = value;
    });
    setEditedReportSections((prev) => ({ ...prev, [section]: false }));
    if (section === 'summary') {
      setReportExecutiveSummaryOverride(reportOriginalExecutiveSummary);
    }
    if (section === 'attention' || section === 'goodPractice') {
      const affectedCodeAreas = (section === 'attention' ? reportAttentionFindings : reportGoodPracticeFindings)
        .map((finding) => normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, '')))
        .filter(Boolean);
      if (affectedCodeAreas.length > 0) {
        setReportSectionNarrativesByCodeArea((prev) => {
          const next = { ...prev };
          affectedCodeAreas.forEach((codeAreaId) => {
            const originalLines = reportOriginalSectionNarrativesByCodeArea[codeAreaId];
            if (Array.isArray(originalLines) && originalLines.length > 0) {
              next[codeAreaId] = [...originalLines];
            } else {
              delete next[codeAreaId];
            }
          });
          return next;
        });
      }
    }

    const cleanCaseId = currentCaseMeta.caseId?.trim();
    if (!isActiveCasePersisted || !cleanCaseId || !section) return;
    const resolvedSections = (() => {
      const directSectionId = String(section || '').trim();
      if (directSectionId.startsWith('section_')) {
        const codeAreaId = normalizeCodeAreaId(directSectionId.replace(/^section[_-]/i, ''));
        return [{ sectionId: directSectionId, codeAreaId }];
      }

      if (section === 'attention') {
        const pairs = reportAttentionFindings
          .map((finding) => normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, '')))
          .filter(Boolean)
          .map((codeAreaId) => ({
            sectionId: reportSectionIdsByCodeArea[codeAreaId],
            codeAreaId
          }))
          .filter((entry) => entry.sectionId);
        return Array.from(new Map(pairs.map((entry) => [entry.sectionId, entry])).values());
      }

      if (section === 'goodPractice') {
        const pairs = reportGoodPracticeFindings
          .map((finding) => normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, '')))
          .filter(Boolean)
          .map((codeAreaId) => ({
            sectionId: reportSectionIdsByCodeArea[codeAreaId],
            codeAreaId
          }))
          .filter((entry) => entry.sectionId);
        return Array.from(new Map(pairs.map((entry) => [entry.sectionId, entry])).values());
      }

      return [];
    })();

    if (resolvedSections.length > 0) {
      Promise.all(
        resolvedSections.map(({ sectionId, codeAreaId }) =>
          persistReportSectionRevert({
            caseId: cleanCaseId,
            sectionId,
            codeAreaId,
            lines: getOriginalReportSectionLines(section, { codeAreaId }),
            user: currentUser
          })
        )
      ).catch((error) => {
        // eslint-disable-next-line no-console
        console.error(`Failed to revert report section "${section}"`, error);
      });
    }

    if (section === 'summary') {
      void persistReportPatch({
        caseId: cleanCaseId,
        report: {
          executive_summary: defaults.join(' ')
        },
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist report summary after section revert', error);
      });
    }
  };

  const upsertReportActionItem = useCallback(
    async (actionItem, originalId = actionItem?.id) => {
      const cleanCaseId = currentCaseMeta.caseId?.trim();
      if (!isActiveCasePersisted || !cleanCaseId || !actionItem) return;

      try {
        const persisted = await persistReportAction({
          caseId: cleanCaseId,
          actionItem,
          user: currentUser
        });
        const persistedId = String(persisted?.id || persisted?.action_id || '').trim();
        if (persistedId && persistedId !== originalId) {
          setReportActionItems((prev) =>
            prev.map((entry) =>
              entry.id === originalId
                ? { ...entry, id: persistedId }
                : entry
            )
          );
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to persist report action in data provider', error);
      }
    },
    [currentCaseMeta.caseId, currentUser, isActiveCasePersisted]
  );

  const deleteReportActionItem = useCallback(
    async (actionId) => {
      const cleanCaseId = currentCaseMeta.caseId?.trim();
      const cleanActionId = String(actionId || '').trim();
      if (!isActiveCasePersisted || !cleanCaseId || !cleanActionId) return;

      try {
        await persistReportActionDelete({
          caseId: cleanCaseId,
          actionId: cleanActionId,
          user: currentUser
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete report action in data provider', error);
      }
    },
    [currentCaseMeta.caseId, currentUser, isActiveCasePersisted]
  );

  const buildFallbackReggieResponse = useCallback(
    (query) => {
      const candidateRows = filteredCrossDocResults.slice(0, 2);
      if (candidateRows.length === 0) {
        return {
          answerText:
            'I could not find a stronger direct match in the current demo corpus. Try asking about John Bloggs, source of funds, the MLRO interview, or bank statements.',
          citations: [],
          sourceMode: 'fallback'
        };
      }

      const citations = candidateRows.map((finding, index) => {
        const documentRow = documentsById.get(finding.documentId);
        return {
          n: index + 1,
          label: `[${index + 1}]`,
          source: documentRow?.filename || documentRow?.name || finding.documentId,
          quote: safeText(finding.detail, safeText(finding.title, 'Linked case evidence'))
        };
      });

      return {
        answerText: `I found the strongest linked material for "${query}" in the current case, particularly ${citations
          .map((citation) => citation.label)
          .join(' and ')}.`,
        citations,
        sourceMode: 'fallback'
      };
    },
    [documentsById, filteredCrossDocResults, safeText]
  );

  const hasReggieRuntimeKey = Boolean(textOf(reggieRuntimeApiKey, ''));

  const buildReggieGuidanceCitationContext = (source, quote = '') => {
    const sourceText = textOf(source, '').trim();
    if (!sourceText) return null;

    const sourceLower = sourceText.toLowerCase();
    const quoteText = textOf(quote, '').trim();
    const quoteLower = quoteText.toLowerCase();
    let linkedDocumentLabel = '';
    let linkedDocumentPath = '';
    let linkedDocumentPage = 1;

    if (sourceLower.includes('anti-money laundering') || sourceLower.includes('aml guidance')) {
      linkedDocumentLabel = 'CLC Anti-Money Laundering Guidance';
      linkedDocumentPath = GUIDANCE_SOURCE_PATHS.amlGuidance;
      linkedDocumentPage = 1;
    } else if (sourceLower.includes('acting for lenders') || sourceLower.includes('mortgage fraud')) {
      linkedDocumentLabel = 'Acting for Lenders and Prevention and Detection of Mortgage Fraud';
      linkedDocumentPath = GUIDANCE_SOURCE_PATHS.actingForLenders;
      linkedDocumentPage = resolveActingForLendersPage(sourceLower, quoteLower);
    } else if (sourceLower.includes('code of conduct')) {
      linkedDocumentLabel = 'CLC Code of Conduct';
      linkedDocumentPath = GUIDANCE_SOURCE_PATHS.codeOfConduct;
      linkedDocumentPage = resolveCodeOfConductPage(sourceLower, quoteLower);
    } else if (sourceLower.includes('firm aml policy')) {
      linkedDocumentLabel = 'Firm AML Policy';
      linkedDocumentPath = GUIDANCE_SOURCE_PATHS.amlPolicy;
      linkedDocumentPage = 1;
    }

    if (!linkedDocumentPath) return null;

    const linkedDocumentUrl =
      typeof window !== 'undefined'
        ? new URL(linkedDocumentPath, window.location.href).toString()
        : '';

    return {
      title: sourceText,
      reference: sourceText,
      detail: quoteText || 'Citation source opened from Reggie.',
      documentLabel: linkedDocumentLabel,
      page: String(linkedDocumentPage),
      pdf: linkedDocumentUrl
    };
  };

  const handleOpenReggieCitation = (citation) => {
    const sourceCandidates = [
      citation?.source,
      citation?.documentId,
      citation?.document_id,
      citation?.documentName,
      citation?.document_name,
      citation?.file,
      citation?.filename,
      citation?.findingId,
      citation?.finding_id
    ]
      .map((entry) => textOf(entry, '').trim())
      .filter(Boolean);
    const uniqueSources = Array.from(new Set(sourceCandidates));
    const source = uniqueSources[0] ?? '';
    if (!source) return;

    const returnContext =
      currentStep === STEP_VIEWER && captureViewerSelection().documentId
        ? {
            step: STEP_VIEWER,
            selection: captureViewerSelection(),
            viewerOriginStep,
            showDocBoxes,
            isViewerFocusMode
          }
        : currentStep === STEP_DOCUMENTS
          ? { step: STEP_DOCUMENTS }
          : { step: STEP_OVERVIEW };
    const openRawReggieDocument = (documentId) => {
      handleViewDocument(documentId, null, null, STEP_DOCUMENTS);
      setReggieViewerReturnContext(returnContext);
      setShowDocBoxes(false);
      setIsViewerFocusMode(false);
      setReggieOpen(false);
    };

    const sourceLowerSet = new Set(uniqueSources.map((entry) => entry.toLowerCase()));
    const findingMatch = allFindings.find((finding) => sourceLowerSet.has(textOf(finding?.id, '').toLowerCase()));
    const findingDocumentId = textOf(findingMatch?.documentId ?? findingMatch?.document_id, '');
    if (findingDocumentId) {
      openRawReggieDocument(findingDocumentId);
      return;
    }

    const normalizedSourceIds = uniqueSources.map((entry) => entry.replace(/\.(pdf|json)$/i, ''));
    const directDocumentId = normalizedSourceIds.find((candidate) => documentsById.has(candidate));
    if (directDocumentId) {
      openRawReggieDocument(directDocumentId);
      return;
    }

    const directDocumentMatch = caseDocuments.find((documentRow) =>
      normalizedSourceIds.some((candidate) => textOf(documentRow?.id, '').toLowerCase() === candidate.toLowerCase())
    );
    if (directDocumentMatch?.id) {
      openRawReggieDocument(directDocumentMatch.id);
      return;
    }

    const sourceKeys = buildFilenameKeySet([...uniqueSources, ...normalizedSourceIds]);
    const documentMatch = caseDocuments.find((documentRow) => {
      const documentKeys = buildDocumentLookupKeys(documentRow);
      return [...documentKeys].some((key) => sourceKeys.has(key));
    });

    if (documentMatch?.id) {
      openRawReggieDocument(documentMatch.id);
      return;
    }

    const guidanceContext = uniqueSources
      .map((candidate) => buildReggieGuidanceCitationContext(candidate, citation?.quote))
      .find(Boolean);
    if (guidanceContext) {
      setActiveGuidanceContext(guidanceContext);
      setGuidanceReturnContext(returnContext);
      setViewerOriginStep(returnContext.viewerOriginStep ?? STEP_OVERVIEW);
      setReggieOpen(false);
      setCurrentStep(STEP_VIEWER);
    }
  };

  const buildLiveReggieInspectionMessage = useCallback((inspection) => ({
    id: nextReggieMessageId('reggie-inspection'),
    kind: 'inspection_card',
    role: 'assistant',
    topic: textOf(inspection?.topic, 'Investigation'),
    answerText: textOf(inspection?.answerText, ''),
    citations: normalizeReggieCitations(inspection?.citations),
    sourceMode: 'live-high'
  }), []);

  const buildLiveReggieFindingProposalMessage = useCallback((finding) => ({
    id: nextReggieMessageId('reggie-proposal'),
    kind: 'finding_proposal',
    role: 'assistant',
    proposalStatus: 'pending',
    rejectionReason: '',
    citations: normalizeReggieCitations(finding?.citations),
    sourceMode: 'live-high',
    finding: {
      title: textOf(finding?.title, 'Proposed finding'),
      polarity: textOf(finding?.polarity, 'non_compliant'),
      certainty: textOf(finding?.certainty, 'finding'),
      isGoodPractice: Boolean(finding?.isGoodPractice),
      severity: textOf(finding?.severity, 'warning'),
      codeArea: textOf(finding?.codeArea, ''),
      requirementId: textOf(finding?.requirementId, ''),
      documentId: textOf(finding?.documentId, ''),
      summary: textOf(finding?.summary, ''),
      evidence: textOf(finding?.evidence, '')
    }
  }), []);

  const buildAcceptedReggieInspectorFinding = useCallback(
    (message) => {
      const proposedFinding = message?.finding ?? {};
      const proposedCitations = Array.isArray(message?.citations) ? message.citations : [];
      const requirementId = textOf(proposedFinding?.requirementId, '').trim();
      const rawDocumentCandidates = [
        textOf(proposedFinding?.documentId, ''),
        ...proposedCitations.map((citation) => textOf(citation?.source, ''))
      ].filter(Boolean);

      let resolvedDocumentId = rawDocumentCandidates.find((candidate) => documentsById.has(candidate)) ?? '';

      if (!resolvedDocumentId && rawDocumentCandidates.length > 0) {
        const candidateKeys = buildFilenameKeySet(rawDocumentCandidates);
        const matchedDocument = caseDocuments.find((documentRow) => {
          const documentKeys = buildDocumentLookupKeys(documentRow);
          return [...documentKeys].some((key) => candidateKeys.has(key));
        });
        resolvedDocumentId = matchedDocument?.id ?? '';
      }

      const linkedDocument = resolvedDocumentId ? documentsById.get(resolvedDocumentId) : null;
      const rawCodeArea = textOf(proposedFinding?.codeArea, '');
      const normalizedCodeArea =
        normalizeCodeAreaId(rawCodeArea) ||
        normalizeCodeAreaId(inferRequirementCodeArea(requirementId)) ||
        'aml';
      const polarity = textOf(proposedFinding?.polarity, '').trim().toLowerCase() === 'compliant'
        ? 'compliant'
        : 'non_compliant';
      const severity = textOf(proposedFinding?.severity, '').trim().toLowerCase() || 'warning';
      const certainty = textOf(proposedFinding?.certainty, '').trim().toLowerCase() === 'lead' ? 'lead' : 'finding';
      const isGoodPractice = Boolean(proposedFinding?.isGoodPractice) || severity === 'best_practice';
      const summary = textOf(proposedFinding?.summary, '').trim();
      const evidence = textOf(proposedFinding?.evidence, summary).trim();
      const baseFinding = {
        id: `inspector-reggie-${Date.now()}`,
        severity,
        title: textOf(proposedFinding?.title, 'Reggie proposed finding'),
        detail: summary || evidence || 'Reggie proposed finding',
        documentId: resolvedDocumentId,
        boxId: null,
        codeArea: normalizedCodeArea,
        requirementId: requirementId || null,
        certainty,
        polarity,
        isGoodPractice,
        requirementSeverity: requirementId
          ? getRequirementSeverity(requirementId)
          : severity === 'best_practice'
            ? 'best_practice'
            : severity === 'compliant'
              ? 'pass'
              : severity === 'warning'
                ? 'warning'
                : 'critical',
        observationSource: resolvedDocumentId ? 'Document evidence' : 'Cross-document review',
        reviewStatus: 'unreviewed',
        evidencePassages: [],
        evidence_passages: [],
        source: {
          file:
            linkedDocument?.filename ||
            linkedDocument?.label ||
            textOf(proposedCitations[0]?.source, '') ||
            'Reggie',
          page: null,
          section: 'Reggie proposed finding',
          text: evidence || summary || 'Reggie proposed finding'
        },
        reference: `${requirementId || 'Reggie'} · Reggie proposed finding`,
        origin: 'inspector',
        isInspectorAdded: true
      };

      return buildNextFindingStateForDecision(baseFinding, 'accepted') ?? baseFinding;
    },
    [
      buildNextFindingStateForDecision,
      caseDocuments,
      documentsById,
      getRequirementSeverity,
      inferRequirementCodeArea,
      normalizeCodeAreaId
    ]
  );

  const sendMockReggieMessage = useCallback(
    (chatId, query, { scope = reggieScope } = {}) => {
      const userMessage = { id: nextReggieMessageId('reggie-user'), role: 'user', text: query };
      const response = findMediumReggieResponse(query) ?? buildFallbackReggieResponse(query);
      const assistantMessage = {
        id: nextReggieMessageId('reggie-answer'),
        role: 'assistant',
        answerText: response.answerText,
        citations: response.citations,
        sourceMode: response.sourceMode
      };

      appendReggieMessage(chatId, userMessage, { scope });
      clearReggieChatTimers(chatId);

      const planningMessage = {
        id: nextReggieMessageId('reggie-plan'),
        role: 'assistant',
        text:
          'Okay, let me plan my approach.\n1. Check the most relevant document.\n2. Cross-reference any linked evidence.\n3. Return the strongest grounded answer with citations.'
      };
      const crossCheckMessage = {
        id: nextReggieMessageId('reggie-crosscheck'),
        role: 'assistant',
        text:
          scope === 'document'
            ? 'I am checking this document first, then looking for any linked references elsewhere in the case.'
            : 'I am scanning the linked documents now and cross-checking for the strongest grounded answer.'
      };

      scheduleReggieChatMessage(chatId, planningMessage, 1200, { scope });
      scheduleReggieChatMessage(chatId, crossCheckMessage, 3600, { scope });
      scheduleReggieChatMessage(chatId, assistantMessage, 7200, { scope });
    },
    [
      appendReggieMessage,
      buildFallbackReggieResponse,
      clearReggieChatTimers,
      findMediumReggieResponse,
      reggieScope,
      scheduleReggieChatMessage
    ]
  );

  const sendLiveReggieMessage = useCallback(
    async (chatId, query, { appendUserMessage = true, scope = reggieScope } = {}) => {
      const cleanQuery = textOf(query, '');
      const apiKey = textOf(reggieRuntimeApiKey, '');
      if (!cleanQuery || !apiKey) return;

      if (appendUserMessage) {
        appendReggieMessage(
          chatId,
          { id: nextReggieMessageId('reggie-user'), role: 'user', text: cleanQuery },
          { scope }
        );
      }

      clearReggieChatTimers(chatId);
      updateReggieChat(chatId, { isStreaming: true, scope });
      let liveMessageDelayMs = 900;
      const queueLiveAssistantMessage = (message) => {
        scheduleReggieChatMessage(chatId, message, liveMessageDelayMs, { scope });
        liveMessageDelayMs += 1600;
      };

      try {
        const existingChat = reggieChats.find((chat) => chat.id === chatId);
        let sessionId = textOf(existingChat?.sessionId, '');
        if (!sessionId) {
          sessionId = await createReggieRuntimeSession({
            apiKey,
            userId: currentUserEmail || 'demo-user'
          });
          updateReggieChat(chatId, { sessionId, scope });
        }

        const seenToolCallIds = new Set();
        let lastVisibleText = '';
        let emittedVisibleAssistantPayload = false;

        for await (const event of streamReggieRuntimeQuery({
          apiKey,
          userId: currentUserEmail || 'demo-user',
          sessionId,
          message: cleanQuery
        })) {
          const parts = Array.isArray(event?.content?.parts) ? event.content.parts : [];

          parts.forEach((part) => {
            if (!part || part.function_response) return;

            const functionCall = part.function_call;
            if (functionCall?.id && seenToolCallIds.has(functionCall.id)) return;

            if (functionCall?.name === 'present_inspection') {
              queueLiveAssistantMessage(buildLiveReggieInspectionMessage(functionCall.args?.inspection));
              emittedVisibleAssistantPayload = true;
              if (functionCall.id) seenToolCallIds.add(functionCall.id);
              return;
            }

            if (functionCall?.name === 'propose_finding') {
              queueLiveAssistantMessage(buildLiveReggieFindingProposalMessage(functionCall.args?.finding));
              emittedVisibleAssistantPayload = true;
              if (functionCall.id) seenToolCallIds.add(functionCall.id);
              return;
            }

            const text = textOf(part?.text, '');
            if (!text || isReggieAckText(text)) return;
            lastVisibleText = text;
            if (event?.partial) return;

            const parsed = parseReggieTextAndCitations(text);
            queueLiveAssistantMessage(
              {
                id: nextReggieMessageId('reggie-answer'),
                role: 'assistant',
                answerText: parsed.answerText || text,
                citations: parsed.citations,
                sourceMode: 'live-high'
              }
            );
            emittedVisibleAssistantPayload = true;
          });
        }

        if (!emittedVisibleAssistantPayload && lastVisibleText) {
          const parsed = parseReggieTextAndCitations(lastVisibleText);
          queueLiveAssistantMessage(
            {
              id: nextReggieMessageId('reggie-answer'),
              role: 'assistant',
              answerText: parsed.answerText || lastVisibleText,
              citations: parsed.citations,
              sourceMode: 'live-high'
            }
          );
        }
      } catch (error) {
        appendReggieMessage(
          chatId,
          {
            id: nextReggieMessageId('reggie-error'),
            role: 'assistant',
            text: error instanceof Error ? error.message : 'Reggie is unavailable right now.'
          },
          { scope }
        );
      } finally {
        updateReggieChat(chatId, { isStreaming: false, scope });
      }
    },
    [
      appendReggieMessage,
      buildLiveReggieFindingProposalMessage,
      buildLiveReggieInspectionMessage,
      clearReggieChatTimers,
      currentUserEmail,
      reggieChats,
      reggieRuntimeApiKey,
      reggieScope,
      scheduleReggieChatMessage,
      updateReggieChat
    ]
  );

  const handleAcceptFindingProposal = useCallback(
    async (message) => {
      const chatId = activeReggieChat?.id ?? activeReggieChatId;
      if (!chatId || !message?.id) return;

      if (!isActiveCasePersisted || !currentCaseMeta.caseId) {
        updateReggieChatMessage(chatId, message.id, {
          proposalStatus: 'pending',
          rejectionReason: ''
        });
        appendReggieMessage(
          chatId,
          {
            id: nextReggieMessageId('reggie-error'),
            role: 'assistant',
            text: 'This proposed finding cannot be saved because the current case is not persisted yet.'
          },
          { scope: activeReggieChat?.scope || reggieScope }
        );
        return;
      }

      updateReggieChatMessage(chatId, message.id, {
        proposalStatus: 'saving',
        rejectionReason: ''
      });

      try {
        const acceptedFinding = buildAcceptedReggieInspectorFinding(message);
        const persisted = await persistInspectorFinding({
          caseId: currentCaseMeta.caseId,
          finding: acceptedFinding,
          user: currentUser
        });
        const persistedFinding = {
          ...acceptedFinding,
          id: persisted?.id || acceptedFinding.id,
          origin: 'inspector',
          isInspectorAdded: true
        };

        setInspectorFindings((prev) => [persistedFinding, ...prev]);
        setReportNeedsRegeneration(true);
        setHistoryItems((items) => [
          {
            id: `h${Date.now()}`,
            ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detail: `Accepted Reggie finding: ${persistedFinding.title}`,
            actor: currentUserEmail || 'Inspector'
          },
          ...items
        ]);

        updateReggieChatMessage(chatId, message.id, {
          proposalStatus: 'accepted',
          rejectionReason: ''
        });

        void refreshDashboardCases();
        void sendLiveReggieMessage(
          chatId,
          `Accepted proposed finding: ${textOf(message?.finding?.title, 'Proposed finding')}`,
          {
            appendUserMessage: false,
            scope: activeReggieChat?.scope || reggieScope
          }
        );
      } catch (error) {
        updateReggieChatMessage(chatId, message.id, {
          proposalStatus: 'pending',
          rejectionReason: ''
        });
        appendReggieMessage(
          chatId,
          {
            id: nextReggieMessageId('reggie-error'),
            role: 'assistant',
            text:
              error instanceof Error
                ? `The proposed finding could not be saved: ${error.message}`
                : 'The proposed finding could not be saved.'
          },
          { scope: activeReggieChat?.scope || reggieScope }
        );
      }
    },
    [
      activeReggieChat,
      activeReggieChatId,
      appendReggieMessage,
      buildAcceptedReggieInspectorFinding,
      currentCaseMeta.caseId,
      currentUser,
      currentUserEmail,
      isActiveCasePersisted,
      refreshDashboardCases,
      reggieScope,
      sendLiveReggieMessage,
      updateReggieChatMessage
    ]
  );

  const handleRejectFindingProposal = useCallback(
    (message, reason) => {
      const chatId = activeReggieChat?.id ?? activeReggieChatId;
      const cleanReason = textOf(reason, '');
      if (!chatId || !message?.id || !cleanReason) return;
      updateReggieChatMessage(chatId, message.id, {
        proposalStatus: 'rejected',
        rejectionReason: cleanReason
      });
      void sendLiveReggieMessage(
        chatId,
        `Rejected proposed finding: ${textOf(message?.finding?.title, 'Proposed finding')}\nReason: ${cleanReason}`,
        {
          appendUserMessage: false,
          scope: activeReggieChat?.scope || reggieScope
        }
      );
    },
    [activeReggieChat, activeReggieChatId, reggieScope, sendLiveReggieMessage, updateReggieChatMessage]
  );

  const handleSendReggie = useCallback(
    (manualQuery) => {
      const query = textOf(manualQuery ?? reggieInput, '');
      if (!query) return;

      let chatId = activeReggieChat?.id ?? activeReggieChatId ?? '';
      if (!activeReggieChat || !chatId) {
        const bootstrapChat = createReggieChat(reggieScope);
        setReggieChats((prev) => [bootstrapChat, ...prev]);
        setActiveReggieChatId(bootstrapChat.id);
        chatId = bootstrapChat.id;
      }

      setReggieInput('');

      if (reggieThinkingLevel === 'high') {
        if (activeReggieChat?.isStreaming) {
          return;
        }

        if (!hasReggieRuntimeKey) {
          appendReggieMessage(
            chatId,
            {
              id: nextReggieMessageId('reggie-key-required'),
              role: 'assistant',
              text: 'High mode needs a Reggie access key. Add it in the panel controls and try again.'
            },
            { scope: reggieScope }
          );
          return;
        }

        void sendLiveReggieMessage(chatId, query, { appendUserMessage: true, scope: reggieScope });
        return;
      }

      sendMockReggieMessage(chatId, query, { scope: reggieScope });
    },
    [
      activeReggieChat,
      activeReggieChatId,
      appendReggieMessage,
      hasReggieRuntimeKey,
      reggieInput,
      reggieScope,
      reggieThinkingLevel,
      sendLiveReggieMessage,
      sendMockReggieMessage
    ]
  );

  const handleQuickReggiePrompt = useCallback(
    (prompt) => {
      handleSendReggie(prompt);
    },
    [handleSendReggie]
  );

  const handleUndoDecision = () => {
    if (!undoDecision) return;
    setReportNeedsRegeneration(true);
    setFindingDecisions((prev) => {
      const next = { ...prev, [undoDecision.findingId]: undoDecision.previousDecision };
      if (!undoDecision.previousDecision) {
        delete next[undoDecision.findingId];
      }
      return next;
    });
    if (undoDecision.previousFindingState) {
      replaceFindingState(undoDecision.findingId, undoDecision.previousFindingState);
    }

    if (isActiveCasePersisted) {
      persistFindingDecision({
        caseId: currentCaseMeta.caseId,
        findingId: undoDecision.findingId,
        decision: undoDecision.previousDecision,
        previousDecision: undoDecision.nextDecision,
        finding: undoDecision.previousFindingState,
        user: currentUser
      })
        .then(() => refreshDashboardCases())
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to persist undo decision', error);
        });
    }

    setUndoDecision(null);
  };

  const handleJumpToEvidencePassage = (finding, passage) => {
    if (!finding) return;
    const targetDocumentId = textOf(passage?.documentId, '') || finding.documentId;
    if (!targetDocumentId) return;
    const targetBoxId = textOf(passage?.boxId, '') || finding.boxId || null;
    handleViewDocument(targetDocumentId, targetBoxId, finding.id, STEP_REPORT);
  };

  const handleToggleFilter = (severity) => {
    setFilterSeverity((prev) =>
      prev.includes(severity) ? prev.filter((item) => item !== severity) : [...prev, severity]
    );
  };

  const handleSelectDocBox = useCallback(
    (boxId, { scrollFinding = true, documentId, origin } = {}) => {
      const targetDocId = documentId ?? activeDocId;
      const doc = documentsById.get(targetDocId);
      const availableBoxes = doc?.overlay?.boxes ?? [];

      if (availableBoxes.length === 0) {
        setActiveDocBoxId(null);
        return;
      }

      const resolvedBoxId =
        boxId && availableBoxes.some((box) => box.id === boxId) ? boxId : availableBoxes[0].id;

      setActiveDocBoxId(resolvedBoxId);
      if (origin !== 'pdf') {
        setDocFocusSignal((prev) => prev + 1);
      }

      const key = `${targetDocId}:${resolvedBoxId}`;
      const match = findingByDocAndBox.get(key);
      if (match && scrollFinding) {
        setActiveFindingId(match.id);
        const node = findingRefs.current[match.id];
        if (node) {
          node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    },
    [activeDocId, documentsById, findingByDocAndBox]
  );

  const captureViewerSelection = useCallback(
    () => ({
      documentId: activeDocId,
      boxId: activeDocBoxId,
      findingId: activeFindingId
    }),
    [activeDocBoxId, activeDocId, activeFindingId]
  );

  const resolveViewerSelection = useCallback(
    (documentId, boxId, findingId) => {
      const cleanDocumentId = coerceText(documentId);
      if (!cleanDocumentId) return null;

      const doc = documentsById.get(cleanDocumentId);
      if (!doc) return null;

      const availableBoxes = Array.isArray(doc?.overlay?.boxes) ? doc.overlay.boxes : [];
      const explicitFindingId = coerceText(findingId);
      const resolvedFinding =
        (explicitFindingId
          ? allFindings.find((item) => item.id === explicitFindingId)
          : null) ??
        (() => {
          const cleanBoxId = coerceText(boxId);
          if (!cleanBoxId) return null;
          return findingByDocAndBox.get(`${cleanDocumentId}:${cleanBoxId}`) ?? null;
        })();

      const candidateBoxIds = [
        coerceText(boxId),
        getFindingPreferredBoxIdForDocument(resolvedFinding, cleanDocumentId),
        coerceText(availableBoxes[0]?.id)
      ].filter(Boolean);

      const resolvedBoxId =
        candidateBoxIds.find((candidateId) =>
          availableBoxes.some((entry) => coerceText(entry?.id) === candidateId)
        ) ?? null;

      return {
        documentId: cleanDocumentId,
        boxId: resolvedBoxId,
        findingId: resolvedFinding?.id ?? null
      };
    },
    [documentsById, allFindings, findingByDocAndBox]
  );

  const applyViewerSelection = useCallback(
    (
      { documentId, boxId, findingId, originStep = viewerOriginStep },
      { pushHistory = false, scrollViewer = true } = {}
    ) => {
      const resolvedSelection = resolveViewerSelection(documentId, boxId, findingId);
      if (!resolvedSelection) return;

      const currentSelection = captureViewerSelection();
      if (currentStep === STEP_VIEWER && pushHistory && currentSelection.documentId) {
        if (!viewerSelectionsMatch(currentSelection, resolvedSelection)) {
          setViewerSelectionHistory((prev) => [...prev, currentSelection]);
        }
      } else if (currentStep !== STEP_VIEWER) {
        setViewerSelectionHistory([]);
      }

      setDocCrossSearchOpen(false);
      if (resolvedSelection.documentId === activeDocId) {
        handleSelectDocBox(resolvedSelection.boxId, {
          scrollFinding: false,
          documentId: resolvedSelection.documentId
        });
      } else {
        pendingDocBoxRef.current = resolvedSelection.boxId;
        setActiveDocId(resolvedSelection.documentId);
        setActiveDocBoxId(resolvedSelection.boxId ?? null);
      }

      setActiveFindingId(resolvedSelection.findingId);
      if (resolvedSelection.findingId) {
        setExpandedViewerFindingIds((prev) => ({ ...prev, [resolvedSelection.findingId]: true }));
      }
      if (resolvedSelection.findingId && findingRefs.current[resolvedSelection.findingId]) {
        findingRefs.current[resolvedSelection.findingId].scrollIntoView({
          block: 'center',
          behavior: 'smooth'
        });
      }

      setDocPulse(resolvedSelection.documentId);
      if (scrollViewer && docViewerRef.current) {
        docViewerRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }

      setViewerOriginStep(originStep);
      if (currentStep !== STEP_VIEWER) {
        setCurrentStep(STEP_VIEWER);
      }
    },
    [
      activeDocId,
      captureViewerSelection,
      currentStep,
      handleSelectDocBox,
      resolveViewerSelection,
      viewerOriginStep
    ]
  );

  const handleViewDocument = useCallback(
    (documentId, boxId, findingId, originStep = viewerOriginStep) => {
      if (originStep === STEP_OVERVIEW) {
        setOverviewRequirementFilter({ areaId: '', requirementId: '' });
      }
      setActiveGuidanceContext(null);
      setReggieViewerReturnContext(null);
      setShowDocBoxes(!(originStep === STEP_DOCUMENTS && !findingId));
      applyViewerSelection(
        { documentId, boxId, findingId, originStep },
        { pushHistory: currentStep === STEP_VIEWER }
      );
    },
    [applyViewerSelection, currentStep, setOverviewRequirementFilter, viewerOriginStep]
  );

  const handleExitReggieViewerContext = useCallback(() => {
    const returnContext = reggieViewerReturnContext;
    setReggieViewerReturnContext(null);
    if (returnContext?.step === STEP_VIEWER && returnContext?.selection?.documentId) {
      setViewerOriginStep(returnContext.viewerOriginStep ?? STEP_OVERVIEW);
      setShowDocBoxes(returnContext.showDocBoxes ?? true);
      setIsViewerFocusMode(returnContext.isViewerFocusMode ?? false);
      applyViewerSelection(
        {
          ...returnContext.selection,
          originStep: returnContext.viewerOriginStep ?? STEP_OVERVIEW
        },
        { pushHistory: false, scrollViewer: false }
      );
      setCurrentStep(STEP_VIEWER);
      return;
    }
    if (returnContext?.step === STEP_DOCUMENTS) {
      setCurrentStep(STEP_DOCUMENTS);
      return;
    }
    setCurrentStep(STEP_OVERVIEW);
  }, [applyViewerSelection, reggieViewerReturnContext]);

  const handleViewerBack = useCallback(() => {
    if (viewerSelectionHistory.length === 0) return;
    const previousSelection = viewerSelectionHistory[viewerSelectionHistory.length - 1];
    setViewerSelectionHistory((prev) => prev.slice(0, -1));
    applyViewerSelection(previousSelection, { pushHistory: false });
  }, [applyViewerSelection, viewerSelectionHistory]);

  const handleClearViewerFindingFocus = useCallback(() => {
    applyViewerSelection(
      {
        documentId: activeDocId,
        boxId: activeDocBoxId,
        findingId: null,
        originStep: viewerOriginStep
      },
      { pushHistory: currentStep === STEP_VIEWER }
    );
  }, [activeDocBoxId, activeDocId, applyViewerSelection, currentStep, viewerOriginStep]);

  const handleSelectDocTab = useCallback(
    (docId) => {
      applyViewerSelection(
        {
          documentId: docId,
          findingId: activeViewerFindingDocumentIds.length > 0 ? activeViewerFinding?.id ?? null : null,
          originStep: viewerOriginStep
        },
        { pushHistory: currentStep === STEP_VIEWER }
      );
    },
    [activeViewerFinding, activeViewerFindingDocumentIds.length, applyViewerSelection, currentStep, viewerOriginStep]
  );

  const handleCycleDocument = useCallback(
    (direction) => {
      if (!viewerDocumentSequence.length) return;
      const startIndex = viewerDocumentIndex >= 0 ? viewerDocumentIndex : 0;
      const nextIndex =
        (startIndex + direction + viewerDocumentSequence.length) % viewerDocumentSequence.length;
      const nextDoc = viewerDocumentSequence[nextIndex];
      if (nextDoc) {
        applyViewerSelection(
          {
            documentId: nextDoc.id,
            findingId: activeViewerFindingDocumentIds.length > 0 ? activeViewerFinding?.id ?? null : null,
            originStep: viewerOriginStep
          },
          { pushHistory: currentStep === STEP_VIEWER }
        );
      }
    },
    [
      activeViewerFinding,
      activeViewerFindingDocumentIds.length,
      applyViewerSelection,
      currentStep,
      viewerDocumentIndex,
      viewerDocumentSequence,
      viewerOriginStep
    ]
  );

  const openLeadConfirmModal = useCallback(
    (findingId, originStep = STEP_OVERVIEW) => {
      const targetFinding = allFindings.find((finding) => finding.id === findingId);
      if (!targetFinding) return;

      const rawPassages = Array.isArray(targetFinding?.evidence_passages)
        ? targetFinding.evidence_passages
        : Array.isArray(targetFinding?.evidencePassages)
          ? targetFinding.evidencePassages
          : [];
      const targetDocumentId =
        coerceText(rawPassages[0]?.document_id || rawPassages[0]?.documentId) ||
        coerceText(targetFinding.documentId) ||
        activeDocId;
      const selectedDocumentIds = Array.from(
        new Set(
          [
            coerceText(targetFinding.documentId),
            ...rawPassages.map((passage) => coerceText(passage?.document_id || passage?.documentId))
          ].filter(Boolean)
        )
      );
      if (selectedDocumentIds.length === 0 && activeDocId) {
        selectedDocumentIds.push(activeDocId);
      }
      const targetBoxId = getFindingPreferredBoxIdForDocument(targetFinding, targetDocumentId);

      setInlineRejectFindingId(null);
      setInlineDismissFindingId(null);
      setNoteTargetFindingId(null);
      setActiveMenuFindingId(null);
      setLeadConfirmModal({
        open: true,
        findingId,
        step: 1,
        polarity: targetFinding?.polarity === 'compliant' ? 'compliant' : 'non_compliant',
        goodPractice:
          targetFinding?.polarity === 'compliant' &&
          (targetFinding?.isGoodPractice === true || targetFinding?.is_good_practice === true),
        originStep,
        caseLevel: false,
        caseLevelSource: '',
        caseLevelDescription: '',
        selectedDocumentIds,
        activeDocumentId: targetDocumentId || selectedDocumentIds[0] || '',
        documentAnchors: Object.fromEntries(
          selectedDocumentIds.map((documentId) => [
            documentId,
            createLeadConfirmDocumentAnchor(targetFinding, documentId)
          ])
        )
      });
      if (originStep === STEP_OVERVIEW && targetDocumentId) {
        handleViewDocument(targetDocumentId, targetBoxId, findingId, originStep);
      }
    },
    [activeDocId, allFindings, createLeadConfirmDocumentAnchor, getFindingPreferredBoxIdForDocument, handleViewDocument]
  );

  const closeLeadConfirmModal = useCallback(() => {
    setLeadConfirmModal((prev) => ({ ...prev, open: false }));
  }, []);

  const launchLeadEvidenceHighlighter = useCallback(() => {
    if (!leadConfirmFinding) return;

    const rawPassages = Array.isArray(leadConfirmFinding?.evidence_passages)
      ? leadConfirmFinding.evidence_passages
      : Array.isArray(leadConfirmFinding?.evidencePassages)
        ? leadConfirmFinding.evidencePassages
        : [];
    const targetDocumentId =
      coerceText(rawPassages[0]?.document_id || rawPassages[0]?.documentId) ||
      coerceText(leadConfirmFinding.documentId) ||
      activeDocId;
    const targetBoxId = getFindingPreferredBoxIdForDocument(leadConfirmFinding, targetDocumentId);

    if (targetDocumentId) {
      handleViewDocument(targetDocumentId, targetBoxId, leadConfirmFinding.id, leadConfirmModal.originStep);
    }
  }, [
    activeDocId,
    getFindingPreferredBoxIdForDocument,
    handleViewDocument,
    leadConfirmFinding,
    leadConfirmModal.originStep
  ]);

  const handleSubmitLeadConfirm = useCallback(() => {
    if (!leadConfirmFinding) return;
    if (leadConfirmModal.caseLevel) {
      const caseLevelSource = coerceText(leadConfirmModal.caseLevelSource).trim();
      const caseLevelDescription = coerceText(leadConfirmModal.caseLevelDescription).trim();
      if (!caseLevelSource || !caseLevelDescription) return;

      handleFindingDecision(leadConfirmFinding.id, 'accepted', {
        findingOverrides: {
          polarity: leadConfirmModal.polarity,
          isGoodPractice: leadConfirmModal.polarity === 'compliant' && leadConfirmModal.goodPractice,
          observationSource: caseLevelSource,
          evidencePassages: [],
          evidence_passages: [],
          documentId: '',
          boxId: null,
          source: {
            file: 'Case-level',
            page: null,
            section: caseLevelSource,
            text: caseLevelDescription
          }
        }
      });
      return;
    }

    if (!isLeadConfirmEvidenceReady) return;

    const selectedDocumentIds = (leadConfirmModal.selectedDocumentIds ?? []).filter((documentId) =>
      documentsById.has(documentId)
    );
    const evidencePassages = selectedDocumentIds
      .map((documentId, index) =>
        buildManualFindingEvidencePassage(
          documentId,
          leadConfirmModal.documentAnchors?.[documentId],
          coerceText(leadConfirmFinding?.detail) || coerceText(leadConfirmFinding?.title) || 'Confirmed finding',
          `lead-confirm-${leadConfirmFinding.id}-${index}`
        )
      )
      .filter(Boolean);
    if (evidencePassages.length === 0) return;

    const primaryPassage = evidencePassages[0] ?? null;

    handleFindingDecision(leadConfirmFinding.id, 'accepted', {
      findingOverrides: {
        polarity: leadConfirmModal.polarity,
        isGoodPractice: leadConfirmModal.polarity === 'compliant' && leadConfirmModal.goodPractice,
        evidencePassages,
        evidence_passages: evidencePassages,
        documentId: primaryPassage?.documentId || leadConfirmFinding.documentId,
        boxId: primaryPassage?.boxId || leadConfirmFinding.boxId
      }
    });
  }, [
    buildManualFindingEvidencePassage,
    documentsById,
    handleFindingDecision,
    isLeadConfirmEvidenceReady,
    leadConfirmFinding,
    leadConfirmModal.caseLevel,
    leadConfirmModal.caseLevelDescription,
    leadConfirmModal.documentAnchors,
    leadConfirmModal.goodPractice,
    leadConfirmModal.polarity,
    leadConfirmModal.caseLevelSource,
    leadConfirmModal.selectedDocumentIds
  ]);

  const handleSaveDocumentNote = useCallback(() => {
    const cleanNote = docLevelNoteDraft.trim();
    setDocLevelNoteOpen(false);
    if (!cleanNote) {
      setDocLevelNoteDraft('');
      return;
    }
    if (activeDocId) {
      setDocumentNotes((prev) => {
        const existing = prev[activeDocId] ?? [];
        return {
          ...prev,
          [activeDocId]: [
            {
              id: `dn-${Date.now()}`,
              text: cleanNote,
              ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              actor: currentUserEmail || 'Inspector'
            },
            ...existing
          ]
        };
      });
    }
    setReportNeedsRegeneration(true);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Document note added (${activeDocument?.label ?? 'Current document'})`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
    setDocLevelNoteDraft('');
    if (isActiveCasePersisted) {
      persistDocumentNote({
        caseId: currentCaseMeta.caseId,
        documentId: activeDocId,
        text: cleanNote,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist document note', error);
      });
    }
  }, [
    docLevelNoteDraft,
    activeDocId,
    activeDocument?.label,
    currentCaseMeta.caseId,
    currentUser,
    currentUserEmail,
    isActiveCasePersisted
  ]);

  useEffect(() => {
    if (currentStep !== STEP_VIEWER) return;
    const pendingBoxId = pendingDocBoxRef.current;
    pendingDocBoxRef.current = null;
    const nextBoxId = pendingBoxId ?? activeDocBoxes[0]?.id ?? null;
    if (nextBoxId || activeDocBoxes.length === 0) {
      handleSelectDocBox(nextBoxId, { scrollFinding: false });
    }
  }, [currentStep, activeDocBoxes, handleSelectDocBox]);

  const findingMatchesCodeArea = (finding, areaId) => {
    if (!finding || !areaId) return false;
    const normalizedArea = normalizeCodeAreaId(areaId);
    const explicitCodeArea = normalizeCodeAreaId(
      safeText(finding.codeArea || finding.code_area, '')
    );
    if (explicitCodeArea && explicitCodeArea === normalizedArea) {
      return true;
    }
    if (explicitCodeArea) {
      return false;
    }
    const keywords = CODE_AREA_KEYWORDS[normalizedArea] ?? [];
    if (keywords.length === 0) return false;
    try {
      const haystack = [
        finding?.reference,
        finding?.title,
        finding?.detail,
        finding?.source?.section,
        finding?.source?.file,
        finding?.source?.text
      ]
        .filter((value) => value !== null && value !== undefined)
        .map((value) => safeText(value, ''))
        .join(' ')
        .toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    } catch (_error) {
      return false;
    }
  };

  const dashboardIsBusy = isDashboardLoading || isCurrentUserProfileLoading;
  const isProvisioningBlocked =
    DATA_PROVIDER_MODE === 'firestore' && Boolean(currentUser?.uid) && !isCurrentUserProfileLoading && !currentUserProfile;

  const renderDashboard = () => (
    <DashboardPage
      dashboardScopeRoleLabel={dashboardScopeRoleLabel}
      dashboardScopeTitle={dashboardScopeTitle}
      hasTeamCaseAccess={hasTeamCaseAccess}
      dashboardRoleNote={dashboardRoleNote}
      onOpenNewCase={handleOpenNewCase}
      teamView={teamView}
      setDashboardView={setDashboardView}
      dashboardCases={dashboardCases}
      scopedActiveCaseCount={scopedActiveCaseCount}
      dashboardScopeSummary={dashboardScopeSummary}
      dashboardSearch={dashboardSearch}
      setDashboardSearch={setDashboardSearch}
      dashboardDateFilter={dashboardDateFilter}
      setDashboardDateFilter={setDashboardDateFilter}
      dashboardOutcomeFilter={dashboardOutcomeFilter}
      setDashboardOutcomeFilter={setDashboardOutcomeFilter}
      dashboardInspectorFilter={dashboardInspectorFilter}
      setDashboardInspectorFilter={setDashboardInspectorFilter}
      dashboardInspectorOptions={dashboardInspectorOptions}
      clearDashboardFilters={clearDashboardFilters}
      showCompletedCases={showCompletedCases}
      setShowCompletedCases={setShowCompletedCases}
      scopedUnreviewedCount={scopedUnreviewedCount}
      scopedIdleOver7DaysCount={scopedIdleOver7DaysCount}
      dashboardAttentionItems={dashboardAttentionItems}
      handleOpenCase={handleOpenCase}
      handleOpenCompletedCase={handleOpenCompletedCase}
      dashboardIsBusy={dashboardIsBusy}
      dashboardError={dashboardError}
      visibleDashboardCases={visibleDashboardCases}
      renderRiskDots={renderRiskDots}
      dashboardCompletedCases={dashboardCompletedCases}
      showRecentlyCompleted={showRecentlyCompleted}
      setShowRecentlyCompleted={setShowRecentlyCompleted}
      formatOutcomeLabel={formatOutcomeLabel}
    />
  );

  const renderCaseSetup = () => {
    return (
      <CaseSetupPage
        caseCreateError={caseCreateError}
        caseSetupPracticeName={caseSetupPracticeName}
        setCaseSetupPracticeName={setCaseSetupPracticeName}
        setCaseSetupHolp={setCaseSetupHolp}
        setCaseSetupHofa={setCaseSetupHofa}
        setCaseSetupPreviousInspection={setCaseSetupPreviousInspection}
        caseSetupHolp={caseSetupHolp}
        caseSetupHofa={caseSetupHofa}
        caseSetupRiskLevel={caseSetupRiskLevel}
        setCaseSetupRiskLevel={setCaseSetupRiskLevel}
        caseSetupTransactionType={caseSetupTransactionType}
        setCaseSetupTransactionType={setCaseSetupTransactionType}
        caseSetupActingForLender={caseSetupActingForLender}
        setCaseSetupActingForLender={setCaseSetupActingForLender}
        caseSetupAmlTier={caseSetupAmlTier}
        setCaseSetupAmlTier={setCaseSetupAmlTier}
        caseSetupPreviousInspection={caseSetupPreviousInspection}
        caseSetupConcerns={caseSetupConcerns}
        setCaseSetupConcerns={setCaseSetupConcerns}
        selectedFocusAreaIds={selectedFocusAreaIds}
        toggleFocusArea={toggleFocusArea}
        handleSelectAllFocusAreas={handleSelectAllFocusAreas}
        handleDeselectAllFocusAreas={handleDeselectAllFocusAreas}
        handleApplyAmlPreset={handleApplyAmlPreset}
        handleApplyPracticePreset={handleApplyPracticePreset}
        caseSetupFileInputRef={caseSetupFileInputRef}
        setCaseSetupQuestionnaireFile={setCaseSetupQuestionnaireFile}
        setCaseSetupQuestionnaireFileBlob={setCaseSetupQuestionnaireFileBlob}
        caseSetupQuestionnaireFile={caseSetupQuestionnaireFile}
        isCreatingCase={isCreatingCase}
        handleCreateCase={handleCreateCase}
        isCaseCreated={Boolean(currentCaseMeta.caseId)}
      />
    );
  };

  const renderComplianceByCodeArea = () => (
    <ComplianceByCodeAreaPanel
      openComposerModal={openComposerModal}
      complianceCodeAreas={complianceCodeAreas}
      requirementsByCodeArea={requirementsByCodeArea}
      requirementsById={requirementsById}
      availableFindings={availableFindings}
      findingMatchesCodeArea={findingMatchesCodeArea}
      getFindingBucketId={getFindingBucketId}
      expandedCodeAreaIds={expandedCodeAreaIds}
      setExpandedCodeAreaIds={setExpandedCodeAreaIds}
      filteredFindings={overviewFilteredFindings}
      overviewFindingScope={overviewFindingScope}
      overviewRequirementFilter={overviewRequirementFilter}
      setOverviewRequirementFilter={setOverviewRequirementFilter}
      findingDecisions={resolvedFindingDecisions}
      expandedOverviewFindingIds={expandedOverviewFindingIds}
      setExpandedOverviewFindingIds={setExpandedOverviewFindingIds}
      closingOverviewFindingIds={closingOverviewFindingIds}
      findingSeverityBadgeMap={FINDING_SEVERITY_BADGE_MAP}
      findingEvidenceStrengthMap={FINDING_EVIDENCE_STRENGTH_MAP}
      isLeadFindingByTaxonomy={isLeadFindingByTaxonomy}
      isInspectorAddedFinding={isInspectorAddedFinding}
      buildEvidencePassages={buildEvidencePassages}
      safeText={safeText}
      formatReferenceText={formatReferenceText}
      activeMenuFindingId={activeMenuFindingId}
      setActiveMenuFindingId={setActiveMenuFindingId}
      findingMenuRef={findingMenuRef}
      handleRequestFindingDecision={handleRequestFindingDecision}
      handleDeleteFinding={handleDeleteFinding}
      handleJumpToRequirement={handleJumpToRequirement}
      handleViewDocument={handleViewDocument}
      handleShowGuidance={handleShowGuidance}
      openLeadConfirmModal={openLeadConfirmModal}
      inlineRejectFindingId={inlineRejectFindingId}
      inlineRejectReason={inlineRejectReason}
      setInlineRejectReason={setInlineRejectReason}
      inlineRejectNote={inlineRejectNote}
      setInlineRejectNote={setInlineRejectNote}
      handleConfirmInlineReject={handleConfirmInlineReject}
      setInlineRejectFindingId={setInlineRejectFindingId}
      inlineDismissFindingId={inlineDismissFindingId}
      inlineDismissReason={inlineDismissReason}
      setInlineDismissReason={setInlineDismissReason}
      inlineDismissNote={inlineDismissNote}
      setInlineDismissNote={setInlineDismissNote}
      handleConfirmInlineDismiss={handleConfirmInlineDismiss}
      setInlineDismissFindingId={setInlineDismissFindingId}
      leadConfirmOpen={leadConfirmModal.open}
      leadConfirmFindingId={leadConfirmModal.findingId}
      leadConfirmOriginStep={leadConfirmModal.originStep}
      closeLeadConfirmModal={closeLeadConfirmModal}
      launchLeadEvidenceHighlighter={launchLeadEvidenceHighlighter}
      notAssessedExpanded={notAssessedExpanded}
      setNotAssessedExpanded={setNotAssessedExpanded}
      notApplicableExpanded={notApplicableExpanded}
      setNotApplicableExpanded={setNotApplicableExpanded}
      notAssessedAreas={effectiveNotAssessedAreas}
      notApplicableAreas={notApplicableAreas}
      handleRestoreNotAssessedArea={handleRestoreNotAssessedArea}
    />
  );

  const renderFindingsWorkspace = () => (
    <ViewerStage
      caseDocuments={caseDocuments}
      setCurrentStep={setCurrentStep}
      viewerOriginStep={viewerOriginStep}
      customViewerBackLabel={
        reggieViewerReturnContext
          ? reggieViewerReturnContext.step === STEP_DOCUMENTS
            ? 'Documents'
            : reggieViewerReturnContext.step === STEP_VIEWER
              ? 'Document Viewer'
              : 'Findings'
          : null
      }
      onViewerBreadcrumbBack={reggieViewerReturnContext ? handleExitReggieViewerContext : null}
      activeViewerFinding={activeViewerFinding}
      activeViewerFindingDocumentIds={activeViewerFindingDocumentIds}
      viewerDocumentSequence={viewerDocumentSequence}
      viewerDocumentIndex={viewerDocumentIndex}
      filteredFindings={filteredFindings}
      findingReferencesDocument={findingReferencesDocument}
      activeDocId={activeDocId}
      viewerCodeAreaFilter={viewerCodeAreaFilter}
      findingMatchesCodeArea={findingMatchesCodeArea}
      availableFindings={availableFindings}
      isViewerFocusMode={isViewerFocusMode}
      setIsViewerFocusMode={setIsViewerFocusMode}
      docViewerRef={docViewerRef}
      viewerSelectionHistory={viewerSelectionHistory}
      handleViewerBack={handleViewerBack}
      activeDocument={activeDocument}
      safeText={safeText}
      handleClearViewerFindingFocus={handleClearViewerFindingFocus}
      handleCycleDocument={handleCycleDocument}
      maxStepUnlocked={maxStepUnlocked}
      handleCaseTabNavigate={handleCaseTabNavigate}
      activeCaseTabId={activeCaseTabId}
      docPulse={docPulse}
      handleSelectDocTab={handleSelectDocTab}
      showDocBoxes={showDocBoxes}
      setShowDocBoxes={setShowDocBoxes}
      activeDocBoxes={activeDocBoxes}
      activeDocBoxId={activeDocBoxId}
      handleSelectDocBox={handleSelectDocBox}
      docPdfScrollRef={docPdfScrollRef}
      docFocusSignal={docFocusSignal}
      activeDocMinimapMarkers={activeDocMinimapMarkers}
      docCrossSearchOpen={docCrossSearchOpen}
      setDocCrossSearchOpen={setDocCrossSearchOpen}
      setFeedbackOpen={setFeedbackOpen}
      docSearchScope={docSearchScope}
      setDocSearchScope={setDocSearchScope}
      docSearchQuery={docSearchQuery}
      isProviderSearchLoading={isProviderSearchLoading}
      filteredInDocumentResults={filteredInDocumentResults}
      filteredCrossDocResults={filteredCrossDocResults}
      documentsById={documentsById}
      requirementsByCodeArea={requirementsByCodeArea}
      formatSourceDocumentRef={formatSourceDocumentRef}
      handleViewDocument={handleViewDocument}
      getFindingPreferredBoxIdForDocument={getFindingPreferredBoxIdForDocument}
      severityFilterRef={severityFilterRef}
      filterSeverity={filterSeverity}
      setSeverityFilterOpen={setSeverityFilterOpen}
      severityFilterOpen={severityFilterOpen}
      severityCounts={severityCounts}
      severityLabelMap={SEVERITY_LABEL_MAP}
      handleToggleFilter={handleToggleFilter}
      setFilterSeverity={setFilterSeverity}
      viewerTypeFilterRef={viewerTypeFilterRef}
      findingViewFilters={findingViewFilters}
      setViewerTypeFilterOpen={setViewerTypeFilterOpen}
      viewerTypeFilterOpen={viewerTypeFilterOpen}
      findingFilterLabelMap={FINDING_FILTER_LABEL_MAP}
      toggleFindingViewFilter={toggleFindingViewFilter}
      clearFindingViewFilters={clearFindingViewFilters}
      viewerCodeAreaFilterRef={viewerCodeAreaFilterRef}
      setViewerCodeAreaFilter={setViewerCodeAreaFilter}
      setViewerCodeAreaFilterOpen={setViewerCodeAreaFilterOpen}
      viewerCodeAreaFilterOpen={viewerCodeAreaFilterOpen}
      activeSeverityLabels={activeSeverityLabels}
      getFindingBucketId={getFindingBucketId}
      activeFindingId={activeFindingId}
      setActiveFindingId={setActiveFindingId}
      expandedViewerFindingIds={expandedViewerFindingIds}
      setExpandedViewerFindingIds={setExpandedViewerFindingIds}
      findingDecisions={resolvedFindingDecisions}
      isLeadFindingByTaxonomy={isLeadFindingByTaxonomy}
      isInspectorAddedFinding={isInspectorAddedFinding}
      findingSeverityBadgeMap={FINDING_SEVERITY_BADGE_MAP}
      findingEvidenceStrengthMap={FINDING_EVIDENCE_STRENGTH_MAP}
      buildEvidencePassages={buildEvidencePassages}
      findingRefs={findingRefs}
      currentCaseMeta={currentCaseMeta}
      activeMenuFindingId={activeMenuFindingId}
      setActiveMenuFindingId={setActiveMenuFindingId}
      findingMenuRef={findingMenuRef}
      handleRequestFindingDecision={handleRequestFindingDecision}
      handleDeleteFinding={handleDeleteFinding}
      handleJumpToRequirement={handleJumpToRequirement}
      formatReferenceText={formatReferenceText}
      openLeadConfirmModal={openLeadConfirmModal}
      inlineRejectFindingId={inlineRejectFindingId}
      inlineRejectReason={inlineRejectReason}
      setInlineRejectReason={setInlineRejectReason}
      inlineRejectNote={inlineRejectNote}
      setInlineRejectNote={setInlineRejectNote}
      handleConfirmInlineReject={handleConfirmInlineReject}
      setInlineRejectFindingId={setInlineRejectFindingId}
      inlineDismissFindingId={inlineDismissFindingId}
      inlineDismissReason={inlineDismissReason}
      setInlineDismissReason={setInlineDismissReason}
      inlineDismissNote={inlineDismissNote}
      setInlineDismissNote={setInlineDismissNote}
      handleConfirmInlineDismiss={handleConfirmInlineDismiss}
      setInlineDismissFindingId={setInlineDismissFindingId}
      handleShowGuidance={handleShowGuidance}
      onOpenDocumentAssistant={() => openReggie('document')}
    />
  );

  const renderDocumentsLifecycleWorkspace = () => (
    <DocumentsStage
      documentsUploadInputRef={documentsUploadInputRef}
      handleUploadFileSelection={handleUploadFileSelection}
      documentPhaseOptions={DOCUMENT_PHASE_OPTIONS}
      documentsPhase={documentsPhase}
      setDocumentsPhase={setDocumentsPhase}
      uploadAreaCollapsed={uploadAreaCollapsed}
      setUploadAreaCollapsed={setUploadAreaCollapsed}
      openDocumentsFilePicker={openDocumentsFilePicker}
      handleUploadDrop={handleUploadDrop}
      uploadItems={uploadItems}
      handleRemoveUploadItem={handleRemoveUploadItem}
      prepareUploadDraft={prepareUploadDraft}
      formatUploadClassificationLabel={formatUploadClassificationLabel}
      isUploadClassificationResolved={isUploadClassificationResolved}
      isUploadReadyForConfirmation={isUploadReadyForConfirmation}
      expandedUploadSummaryId={expandedUploadSummaryId}
      setExpandedUploadSummaryId={setExpandedUploadSummaryId}
      buildUploadLookupKeys={buildUploadLookupKeys}
      buildFilenameKeySet={buildFilenameKeySet}
      documentRows={documentRows}
      textOf={textOf}
      normalizeUploadInterviewees={normalizeUploadInterviewees}
      isInterviewTranscriptUpload={isInterviewTranscriptUpload}
      isUploadLimitedAnalysis={isUploadLimitedAnalysis}
      hasIncompleteUploadInterviewees={hasIncompleteUploadInterviewees}
      uploadTableLastRowRef={uploadTableLastRowRef}
      activeClassificationMenu={activeClassificationMenu}
      setActiveClassificationMenu={setActiveClassificationMenu}
      documentClassificationGroups={DOCUMENT_CLASSIFICATION_GROUPS}
      documentClassificationOtherOption={DOCUMENT_CLASSIFICATION_OTHER_OPTION}
      handleUploadClassificationSelect={handleUploadClassificationSelect}
      handleUploadClassificationDetailChange={handleUploadClassificationDetailChange}
      handleViewDocument={handleViewDocument}
      stepDocuments={STEP_DOCUMENTS}
      currentCaseMeta={currentCaseMeta}
      toIsoDate={toIsoDate}
      formatShortDisplayDate={formatShortDisplayDate}
      toDateInputValue={toDateInputValue}
      handleUpdateUploadInterviewee={handleUpdateUploadInterviewee}
      handleRemoveUploadInterviewee={handleRemoveUploadInterviewee}
      handleAddUploadInterviewee={handleAddUploadInterviewee}
      handleUploadFieldChange={handleUploadFieldChange}
      handleSetUploadReviewDecision={handleSetUploadReviewDecision}
      renderConfidenceDots={renderConfidenceDots}
      unclassifiedUploadCount={unclassifiedUploadCount}
      lowConfidenceUploadCount={lowConfidenceUploadCount}
      incompleteInterviewUploadCount={incompleteInterviewUploadCount}
      limitedAnalysisUploadCount={limitedAnalysisUploadCount}
      verifiedUploadCount={verifiedUploadCount}
      unverifiedUploadCount={unverifiedUploadCount}
      confirmableUploadCount={confirmableUploadCount}
      hasViewedUploadTableEnd={hasViewedUploadTableEnd}
      allUploadsVerified={allUploadsVerified}
      handleRunClassification={handleRunClassification}
      handleRerunClassification={handleRerunClassification}
      handleGenerateFindings={handleGenerateFindings}
      processingLog={processingLog}
    />
  );

  const handleReprocessNow = () => {
    setReprocessBannerDismissed(true);
    setDocumentWorkspaceTab('lifecycle');
    setDocsMarkedForReprocess({});
    setPendingScopeChangeCount(0);
    setReportPendingChanges(false);
    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}-reprocess`,
        detail: `Reprocess started (${pendingReprocessSummary})`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Reprocess requested (${pendingReprocessSummary})`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
    startProcessingRun(PROCESSING_MODE_FINDINGS);
  };

  const renderCaseHeader = () => {
    if (currentStep === STEP_VIEWER) {
      return null;
    }
    const openFindings = allFindings.filter((finding) => !resolvedFindingDecisions[finding.id]).length;
    const dataSourceLabel = isActiveCasePersisted ? 'Firestore' : 'Draft';
    const caseTabCounts = {
      overview: availableFindings.length,
      documents: Math.max(caseDocuments.length, uploadItems.length)
    };
    return (
      <CaseHeader
        currentStep={currentStep}
        currentCaseMeta={currentCaseMeta}
        renderRiskDots={renderRiskDots}
        openFindings={openFindings}
        dataSourceLabel={dataSourceLabel}
        isViewerStep={currentStep === STEP_VIEWER}
        onOpenSearch={() => {
          setDocumentWorkspaceTab('search');
          openReggie('all');
        }}
        pendingReprocessSummary={pendingReprocessSummary}
        reprocessBannerDismissed={reprocessBannerDismissed}
        onReprocessNow={handleReprocessNow}
        activeCaseTabId={activeCaseTabId}
        maxStepUnlocked={maxStepUnlocked}
        handleCaseTabNavigate={handleCaseTabNavigate}
        caseTabCounts={caseTabCounts}
        reportStale={reportStale}
      />
    );
  };

  const renderOverviewWorkspace = () => (
    <OverviewStage
      caseDocumentsLength={caseDocuments.length}
      onGoToDocuments={() => {
        setDocumentsPhase(caseDocuments.length > 0 ? 'review' : 'intake');
        setCurrentStep(STEP_DOCUMENTS);
      }}
      onGoToReport={handleAttemptOverviewReport}
      findingVisibilityScope={overviewFindingScope}
      onSetFindingVisibilityScope={setOverviewFindingScope}
      overviewFilterRef={overviewFilterRef}
      findingViewFilters={findingViewFilters}
      overviewFilterOpen={overviewFilterOpen}
      setOverviewFilterOpen={setOverviewFilterOpen}
      findingFilterLabelMap={FINDING_FILTER_LABEL_MAP}
      toggleFindingViewFilter={toggleFindingViewFilter}
      onClearFindingFilters={clearFindingViewFilters}
      onResetFindingFilters={resetFindingViewFiltersToDefault}
      reportBlockedMessage={reportAccessNotice}
      overviewSummaryCards={overviewSummaryCards}
      hasDefaultFindingViewFilters={hasDefaultFindingViewFilters}
      allRequirementsMet={allRequirementsMet}
      allRequirementsMetDetail={allRequirementsMetDetail}
      showHighRejectionPrompt={showHighRejectionPrompt}
      onOpenContextNote={() => setContextNoteOpen(true)}
      onDismissHighRejectionPrompt={() => setHighRejectionPromptDismissed(true)}
      complianceContent={renderComplianceByCodeArea()}
    />
  );

  const renderProcessingWorkspace = () => (
    <ProcessingStage
      analysisTitle={analysisTitle}
      analysisMessage={analysisMessage}
      analysisProgress={analysisProgress}
      analysisStageIndex={analysisStageIndex}
      analysisSteps={activeProcessingSteps}
      analysisCompletionLabel={analysisCompletionLabel}
    />
  );

  const renderReportWorkspace = () => (
    <ReportStage
      availableFindings={availableFindings}
      onGoToDocumentsTab={() => {
        setCurrentStep(STEP_DOCUMENTS);
        setDocumentsPhase('review');
        setDocumentWorkspaceTab('lifecycle');
      }}
      hasGeneratedReport={hasGeneratedReport}
      reportGenerationInProgress={reportGenerationInProgress}
      reportGenerationMode={reportGenerationMode}
      reportCanGenerate={reportCanGenerate}
      reportReviewBlockedReason={reportReviewBlockedReason}
      reportPendingChanges={reportPendingChanges}
      onBackToFindings={() => {
        setCurrentStep(STEP_OVERVIEW);
        requestAnimationFrame(scrollWorkspaceToTop);
      }}
      onGenerateReport={handleGenerateReport}
      onOpenPendingChangesGate={() => {
        setReportPendingAction('regenerate');
        setReportPendingGateOpen(true);
      }}
      reportStale={reportStale}
      onOpenRegenerateConfirm={() => {
        setReportPendingAction('regenerate');
        setReportRegenerateConfirmOpen(true);
      }}
      onExportReport={handleExportReport}
      assetBase={assetBase}
      reportDraftVersion={reportDraftVersion}
      currentCaseMeta={currentCaseMeta}
      reportInspectionType={reportInspectionType}
      editedReportSections={editedReportSections}
      handleRevertReportSection={handleRevertReportSection}
      reportSectionDefaults={reportSectionDefaults}
      setReportEditableRef={setReportEditableRef}
      handleReportSectionEdited={handleReportSectionEdited}
      reportGoodPracticeFindings={reportGoodPracticeFindings}
      safeText={safeText}
      formatCodeAreaLabel={formatCodeAreaLabel}
      formatReferenceText={formatReferenceText}
      normalizeCodeAreaId={normalizeCodeAreaId}
      reportAttentionFindings={reportAttentionFindings}
      buildEvidencePassages={buildEvidencePassages}
      handleJumpToEvidencePassage={handleJumpToEvidencePassage}
      reportActionBaselineItems={reportActionBaselineItems}
      reportActionItems={reportActionItems}
      setReportActionItems={setReportActionItems}
      upsertReportActionItem={upsertReportActionItem}
      deleteReportActionItem={deleteReportActionItem}
      reportCodeAreaSummaries={reportCodeAreaSummaries}
      caseContextNotes={caseContextNotes}
      inspectorObservations={inspectorObservations}
      handleUpdateObservation={handleUpdateObservation}
      handleDeleteObservation={handleDeleteObservation}
      notAssessedAreas={effectiveNotAssessedAreas}
      reportAppendixRows={reportAppendixRows}
      reportExportRef={reportExportRef}
    />
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case STEP_CASE_SETUP:
        return renderCaseSetup();
      case STEP_DOCUMENTS:
        return renderDocumentsLifecycleWorkspace();
      case STEP_PROCESSING:
        return renderProcessingWorkspace();
      case STEP_OVERVIEW:
        return renderOverviewWorkspace();
      case STEP_VIEWER:
        return activeGuidanceContext ? (
          <div className="stage-card doc-viewer-stage doc-viewer-stage--guidance">
            <GuidanceContextLayout
              embedded
              guidance={activeGuidanceContext}
              backLabel={guidanceReturnContext?.step === STEP_VIEWER ? 'Back to Document Viewer' : 'Back to Findings'}
              onBack={handleExitGuidanceContext}
            />
          </div>
        ) : (
          <div className="stage-card doc-viewer-stage">
            {renderFindingsWorkspace()}
          </div>
        );
      case STEP_HISTORY:
        return renderOverviewWorkspace();
      case STEP_REPORT:
        return renderReportWorkspace();
      default:
        return null;
    }
  };

  const renderFeedbackControls = () => (
    <FeedbackControls
      onOpen={() => setFeedbackOpen(true)}
      isOpen={feedbackOpen}
      feedbackCategory={feedbackCategory}
      setFeedbackCategory={setFeedbackCategory}
      feedbackText={feedbackText}
      setFeedbackText={setFeedbackText}
      onClose={() => setFeedbackOpen(false)}
      onSubmit={handleSubmitFeedback}
    />
  );

  const shellAppTitle = 'CLC Inspection Intelligence';
  const shellHeaderContext =
    appMode === 'inspection' && currentCaseMeta.practiceName && (currentStep !== STEP_CASE_SETUP || currentCaseMeta.caseId)
      ? currentCaseMeta.practiceName
      : appMode === 'caseSetup' || (appMode === 'inspection' && currentStep === STEP_CASE_SETUP)
        ? 'New Inspection Case'
        : 'Dashboard';
  const shellShowHeaderContextChevron = false;
  const shellCompactHeader = appMode === 'inspection' && currentStep === STEP_VIEWER;
  const shellShowAssistant = appMode === 'inspection';
  const showWorkspaceOpenLoader =
    appMode === 'inspection' &&
    (isWorkspaceLoading ||
      (Boolean(caseOpenTransitionCaseId) &&
        caseOpenTransitionCaseId === coerceText(currentCaseMeta.caseId).trim()));
  const shellPageHelpText =
    appMode === 'dashboard'
      ? 'Use the dashboard to open an existing inspection case or start a new one.'
      : appMode === 'caseSetup' || (appMode === 'inspection' && currentStep === STEP_CASE_SETUP)
        ? 'Set the inspection scope and case properties before uploading evidence.'
        : '';
  const handleExitGuidanceContext = useCallback(() => {
    const returnContext = guidanceReturnContext;
    setActiveGuidanceContext(null);
    setGuidanceReturnContext(null);
    if (returnContext?.step === STEP_VIEWER && returnContext?.selection?.documentId) {
      setViewerOriginStep(returnContext.viewerOriginStep ?? STEP_OVERVIEW);
      setShowDocBoxes(returnContext.showDocBoxes ?? true);
      setIsViewerFocusMode(returnContext.isViewerFocusMode ?? false);
      applyViewerSelection(
        {
          ...returnContext.selection,
          originStep: returnContext.viewerOriginStep ?? STEP_OVERVIEW
        },
        { pushHistory: false, scrollViewer: false }
      );
      setCurrentStep(STEP_VIEWER);
      return;
    }
    setCurrentStep(STEP_OVERVIEW);
  }, [applyViewerSelection, guidanceReturnContext]);

  const handleShowGuidance = useCallback(
    (finding) => {
      const areaId = normalizeCodeAreaId(safeText(finding?.codeArea || finding?.code_area, ''));
      const referenceText = safeText(finding?.reference, '');
      const referenceLower = referenceText.toLowerCase();
      const findingTitle = safeText(finding?.title, 'Regulatory requirement');
      const titleLower = findingTitle.toLowerCase();
      const findingDetail = safeText(finding?.detail, '');
      let linkedDocumentLabel = '';
      let linkedDocumentPath = '';
      let linkedDocumentPage = 1;

      if (referenceLower.includes('firm aml policy')) {
        linkedDocumentLabel = 'Firm AML Policy';
        linkedDocumentPath = GUIDANCE_SOURCE_PATHS.amlPolicy;
        linkedDocumentPage = 1;
      } else if (areaId === 'aml' || referenceLower.includes('anti-money laundering')) {
        linkedDocumentLabel = 'CLC Anti-Money Laundering Guidance';
        linkedDocumentPath = GUIDANCE_SOURCE_PATHS.amlGuidance;
        linkedDocumentPage =
          findingTitle === 'Identity Document Does Not Match Client'
          || findingTitle === 'Firm AML Policy Accepts Older Address Evidence Than CLC Guidance Allows'
            ? 2
            : 1;
      } else if (
        areaId === 'lenders' ||
        referenceLower.includes('acting for lenders') ||
        referenceLower.includes('mortgage fraud')
      ) {
        linkedDocumentLabel = 'Acting for Lenders and Prevention and Detection of Mortgage Fraud';
        linkedDocumentPath = GUIDANCE_SOURCE_PATHS.actingForLenders;
        linkedDocumentPage = resolveActingForLendersPage(referenceLower, titleLower);
      } else if (areaId === 'code-of-conduct' || referenceLower.includes('code of conduct')) {
        linkedDocumentLabel = 'CLC Code of Conduct';
        linkedDocumentPath = GUIDANCE_SOURCE_PATHS.codeOfConduct;
        linkedDocumentPage = resolveCodeOfConductPage(referenceLower, titleLower);
      }
      const linkedDocumentUrl =
        linkedDocumentPath && typeof window !== 'undefined'
          ? new URL(linkedDocumentPath, window.location.href).toString()
          : '';

      setActiveGuidanceContext({
        title: findingTitle,
        reference: referenceText || 'Requirement context',
        detail: findingDetail || 'No further requirement context is bundled for this finding.',
        documentLabel: linkedDocumentLabel,
        page: linkedDocumentPath ? String(linkedDocumentPage) : '',
        pdf: linkedDocumentUrl
      });
      if (currentStep === STEP_VIEWER) {
        setGuidanceReturnContext({
          step: STEP_VIEWER,
          selection: captureViewerSelection(),
          viewerOriginStep,
          showDocBoxes,
          isViewerFocusMode
        });
      } else {
        setGuidanceReturnContext({ step: STEP_OVERVIEW });
        setViewerOriginStep(STEP_OVERVIEW);
      }
      setCurrentStep(STEP_VIEWER);
    },
    [
      captureViewerSelection,
      currentStep,
      isViewerFocusMode,
      normalizeCodeAreaId,
      safeText,
      showDocBoxes,
      viewerOriginStep
    ]
  );
  const handleJumpToRequirement = useCallback(
    (finding) => {
      const areaId = normalizeCodeAreaId(safeText(finding?.codeArea || finding?.code_area, ''));
      const requirementId = safeText(finding?.requirementId || finding?.requirement_id, '');
      if (areaId) {
        setExpandedCodeAreaIds((prev) => ({ ...prev, [areaId]: true }));
      }
      setOverviewRequirementFilter(areaId ? { areaId, requirementId } : { areaId: '', requirementId: '' });
      setCurrentStep(STEP_OVERVIEW);
    },
    [normalizeCodeAreaId, safeText]
  );
  const shellNavigationItems = useMemo(() => {
    if (appMode === 'inspection') {
      const caseTabCounts = {
        overview: availableFindings.length,
        documents: Math.max(caseDocuments.length, uploadItems.length)
      };

      return [
        {
          id: 'dashboard',
          label: 'Dashboard',
          detail: 'All inspection cases',
          onSelect: handleGoHome
        },
        ...CASE_TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          detail:
            tab.id === 'case-setup'
              ? 'Set up inspection scope'
              : tab.id === 'overview'
                ? 'Review findings'
                : tab.id === 'documents'
                  ? 'Select and classify evidence'
                  : 'Generate and export output',
          count: Object.prototype.hasOwnProperty.call(caseTabCounts, tab.id) ? caseTabCounts[tab.id] : undefined,
          disabled: tab.step > maxStepUnlocked || (tab.id === 'overview' && allFindingsRejectedOrDismissed),
          showAlert: tab.id === 'report' && reportStale,
          onSelect: () => handleCaseTabNavigate(tab.step)
        }))
      ];
    }

    if (appMode === 'caseSetup') {
      return [
        {
          id: 'dashboard',
          label: 'Dashboard',
          detail: 'All inspection cases',
          onSelect: handleGoHome
        },
        {
          id: 'case-setup',
          label: 'New Case',
          detail: 'Set up inspection scope',
          onSelect: handleOpenNewCase
        }
      ];
    }

    return [
      {
        id: 'dashboard',
        label: 'Dashboard',
        detail: 'All inspection cases',
        onSelect: handleGoHome
      }
    ];
  }, [
    appMode,
    availableFindings.length,
    caseDocuments.length,
    handleCaseTabNavigate,
    handleGoHome,
    handleOpenNewCase,
    maxStepUnlocked,
    reportStale,
    uploadItems.length,
    allFindingsRejectedOrDismissed
  ]);
  const shellActiveNavigationId =
    appMode === 'inspection'
      ? activeCaseTabId || 'overview'
      : appMode === 'caseSetup'
        ? 'case-setup'
        : 'dashboard';
  const shellNavigationCaption =
    currentCaseMeta.caseId
      ? `${currentCaseMeta.practiceName || 'Inspection case'} · ${currentCaseMeta.caseId}`
      : appMode === 'inspection' && currentStep === STEP_CASE_SETUP
        ? 'New case'
        : 'Inspection workspace';

  if (isProvisioningBlocked) {
    return <AccessPendingPage onSignOut={onSignOut} />;
  }

  if (appMode === 'dashboard') {
    return (
      <WorkspaceShell
        currentUserEmail={currentUserEmail}
        onHome={handleGoHome}
        onSignOut={onSignOut}
        onOpenAssistant={null}
        assistantOpen={false}
        appTitle={shellAppTitle}
        headerContext={shellHeaderContext}
        showHeaderContext={false}
        showHeaderContextChevron={false}
        compactHeader={false}
        showNavigationMenu
        navigationCaption={shellNavigationCaption}
        navigationItems={shellNavigationItems}
        activeNavigationId={shellActiveNavigationId}
        pageHelpText={shellPageHelpText}
        afterMain={renderFeedbackControls()}
      >
        {renderDashboard()}
      </WorkspaceShell>
    );
  }

  if (appMode === 'caseSetup') {
    return (
      <WorkspaceShell
        currentUserEmail={currentUserEmail}
        onHome={handleGoHome}
        onSignOut={onSignOut}
        onOpenAssistant={null}
        assistantOpen={false}
        appTitle={shellAppTitle}
        headerContext={shellHeaderContext}
        showHeaderContext={false}
        showHeaderContextChevron={false}
        compactHeader={false}
        showNavigationMenu
        navigationCaption={shellNavigationCaption}
        navigationItems={shellNavigationItems}
        activeNavigationId={shellActiveNavigationId}
        pageHelpText={shellPageHelpText}
        afterMain={renderFeedbackControls()}
      >
        {renderCaseSetup()}
      </WorkspaceShell>
    );
  }

  return (
    <>
      <WorkspaceShell
        currentUserEmail={currentUserEmail}
        onHome={handleGoHome}
        onSignOut={onSignOut}
        onOpenAssistant={shellShowAssistant ? () => openReggie('all') : null}
        assistantOpen={shellShowAssistant && reggieOpen}
        appTitle={shellAppTitle}
        headerContext={shellHeaderContext}
        showHeaderContext={false}
        showHeaderContextChevron={shellShowHeaderContextChevron}
        compactHeader={shellCompactHeader}
        showNavigationMenu
        navigationCaption={shellNavigationCaption}
        navigationItems={shellNavigationItems}
        activeNavigationId={shellActiveNavigationId}
        pageHelpText={shellPageHelpText}
        afterMain={
          <>
            <UndoToast undoDecision={undoDecision} onUndo={handleUndoDecision} />
            {renderFeedbackControls()}
          <ReggiePanel
            isOpen={reggieOpen}
            onClose={() => setReggieOpen(false)}
            reggieScope={reggieScope}
            reggieThinkingLevel={reggieThinkingLevel}
            setReggieThinkingLevel={setReggieThinkingLevel}
            suggestions={REGGIE_SUGGESTIONS}
            reggieChats={reggieChats}
            activeReggieChatId={activeReggieChat?.id ?? activeReggieChatId}
            onCreateNewChat={() => handleCreateNewReggieChat(reggieScope)}
            onSelectChat={handleSelectReggieChat}
            reggieMessages={reggieMessages}
            onQuickPrompt={handleQuickReggiePrompt}
            onOpenCitation={handleOpenReggieCitation}
            reggieInput={reggieInput}
            setReggieInput={setReggieInput}
            onSend={handleSendReggie}
            hasReggieRuntimeKey={hasReggieRuntimeKey}
            reggieBusy={reggieBusy}
            onAcceptFindingProposal={handleAcceptFindingProposal}
            onRejectFindingProposal={handleRejectFindingProposal}
          />
          <ConfirmAllUploadsModal
            isOpen={confirmAllUploadsGateOpen}
            onCancel={() => setConfirmAllUploadsGateOpen(false)}
            onConfirm={() => {
              setConfirmAllUploadsGateOpen(false);
              confirmAllEligibleUploads();
            }}
          />
          <ReportPendingModal
            isOpen={reportPendingGateOpen}
            reportPendingAction={reportPendingAction}
            onCancel={() => setReportPendingGateOpen(false)}
            onGenerateCurrent={() => {
              setReportPendingGateOpen(false);
              if (reportPendingAction === 'generate') {
                void runReportGeneration('generate');
                return;
              }
              setReportRegenerateConfirmOpen(true);
            }}
            onReprocessFirst={() => {
              setReportPendingGateOpen(false);
              setDocumentWorkspaceTab('lifecycle');
              setReportPendingChanges(false);
              setDocsMarkedForReprocess({});
              setPendingScopeChangeCount(0);
              setProcessingLog((prev) => [
                {
                  id: `p${Date.now()}-report-reprocess`,
                  detail: 'Reprocess requested from report pending-changes gate',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                },
                ...prev
              ]);
              startProcessingRun(PROCESSING_MODE_FINDINGS);
            }}
          />
          <ReportRegenerateModal
            isOpen={reportRegenerateConfirmOpen}
            onCancel={() => setReportRegenerateConfirmOpen(false)}
            onConfirm={handleConfirmReportRegenerate}
          />
        </>
      }
    >
        {showWorkspaceOpenLoader ? (
          <div className="stage-card workspace-loading-stage">
            <div className="edge-empty-card workspace-loading-card">
              <div className="spinner-sumplexity spinner-lg" aria-hidden="true" />
              <h3>Opening case</h3>
              <p>Loading documents, findings and report state from the data provider.</p>
            </div>
          </div>
        ) : (
          <>
            {renderCaseHeader()}
            {renderStepContent()}
          </>
        )}
      </WorkspaceShell>
      <ContextNoteModal
        isOpen={contextNoteOpen}
        draft={contextNoteDraft}
        setDraft={setContextNoteDraft}
        onClose={() => setContextNoteOpen(false)}
        onSave={() => {
          const cleanNote = contextNoteDraft.trim();
          if (cleanNote) {
            setHighRejectionPromptDismissed(true);
            setCaseContextNotes((prev) => [
              {
                id: `ctx-${Date.now()}`,
                text: cleanNote,
                ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                actor: currentUserEmail || 'Inspector'
              },
              ...prev
            ]);
            setHistoryItems((items) => [
              {
                id: `h${Date.now()}`,
                ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detail: 'Case context note updated',
                actor: currentUserEmail || 'Inspector'
              },
              ...items
            ]);
            setReportNeedsRegeneration(true);
            if (isActiveCasePersisted) {
              persistContextNote({
                caseId: currentCaseMeta.caseId,
                text: cleanNote,
                user: currentUser
              }).catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Failed to persist context note', error);
              });
            }
          }
          setContextNoteOpen(false);
          setContextNoteDraft('');
        }}
      />
      <LeadConfirmModal
        isOpen={leadConfirmModal.open && currentStep === STEP_VIEWER}
        leadConfirmFinding={leadConfirmFinding}
        safeText={safeText}
        leadConfirmModal={leadConfirmModal}
        setLeadConfirmModal={setLeadConfirmModal}
        caseDocuments={caseDocuments}
        toggleLeadConfirmDocument={toggleLeadConfirmDocument}
        leadConfirmSelectedDocuments={leadConfirmSelectedDocuments}
        createLeadConfirmDocumentAnchor={createLeadConfirmDocumentAnchor}
        isLeadConfirmDocumentAnchorComplete={isLeadConfirmDocumentAnchorComplete}
        updateLeadConfirmDocumentAnchor={updateLeadConfirmDocumentAnchor}
        coerceText={coerceText}
        onClose={closeLeadConfirmModal}
        isEvidenceReady={isLeadConfirmEvidenceReady}
        onSubmit={handleSubmitLeadConfirm}
      />
      <ComposerModal
        isOpen={composerModal.open}
        composerModal={composerModal}
        setComposerModal={setComposerModal}
        observationSourceOptions={OBSERVATION_SOURCE_OPTIONS}
        findingRequirementOptions={FINDING_REQUIREMENT_OPTIONS}
        manualCaseLevelSourceOptions={MANUAL_CASE_LEVEL_SOURCE_OPTIONS}
        onClose={closeComposerModal}
        onSubmit={submitComposerModal}
        onOpenEvidenceFlow={openManualEvidenceFlow}
      />
      <ManualEvidenceModal
        isOpen={manualEvidenceModalOpen}
        composerModal={composerModal}
        caseDocuments={caseDocuments}
        toggleComposerDocument={toggleComposerDocument}
        composerSelectedDocuments={composerSelectedDocuments}
        createComposerDocumentAnchor={createComposerDocumentAnchor}
        isComposerDocumentAnchorComplete={isComposerDocumentAnchorComplete}
        updateComposerDocumentAnchor={updateComposerDocumentAnchor}
        coerceText={coerceText}
        isEvidenceStepValid={isComposerEvidenceStepValid}
        onBack={handleManualEvidenceBack}
        onClose={closeComposerModal}
        onSubmit={submitComposerModal}
      />
    </>
  );
}
