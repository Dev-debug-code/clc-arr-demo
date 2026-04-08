import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUserProfile } from '../../services/userProfile.js';
import {
  DATA_PROVIDER_MODE,
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
  persistConfirmAllUploads,
  persistContextNote,
  persistDocumentNote,
  persistFindingDecision,
  persistFindingNote,
  persistGenerateFindingsEvent,
  persistGenerateReport,
  persistUploadItem,
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
import { createInspectionReportPdf } from '../../utils/reportPdf.js';
import {
  ANALYSIS_PROGRESS_INCREMENT,
  ANALYSIS_TICK_INTERVAL_MS,
  AI_PROCESSING_STEPS,
  AI_PROCESSING_MESSAGES,
  AML_DESK_REVIEW_PRESET,
  CASE_TABS,
  CASE_META,
  CODE_AREA_ALIASES,
  CODE_AREA_KEYWORDS,
  CODE_AREA_REQUIREMENT_SAMPLES,
  COMPLIANCE_CODE_AREAS,
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
  REVIEW_REASON_OPTIONS,
  SEVERITY_LABEL_MAP,
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
  createPartyRow,
  deriveLegacyFindingSeverity,
  extractIdleDays,
  findingReferencesDocument,
  formatReferenceText,
  formatRiskLevelLabel,
  formatShortDisplayDate,
  formatSourceDocumentRef,
  formatTimeLabel,
  getFindingBucketId,
  getFindingEffectiveCertainty,
  getFindingPreferredBoxIdForDocument,
  getRequirementSeverity,
  inferRequirementCodeArea,
  isInspectorAddedFinding,
  isLeadFindingByTaxonomy,
  isRequirementExcluded,
  isRequirementMet,
  safeSourceField,
  safeText,
  suggestClassificationFromFilename,
  textOf,
  toDateInputValue,
  toIsoDate,
  viewerSelectionsMatch
} from './helpers.js';
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
import HistoryStage from './components/HistoryStage.jsx';
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

export default function WorkspaceApp({ currentUser, onSignOut }) {
  const currentUserEmail = currentUser?.email ?? '';
  const assetBase = import.meta.env.BASE_URL ?? '/';
  const forcedUserRole =
    DATA_PROVIDER_MODE === 'firestore' ? '' : coerceText(import.meta.env.VITE_FORCE_USER_ROLE).trim();
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
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

  const [docPulse, setDocPulse] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState([]);
  const [severityFilterOpen, setSeverityFilterOpen] = useState(false);
  const [overviewFilterOpen, setOverviewFilterOpen] = useState(false);
  const [viewerTypeFilterOpen, setViewerTypeFilterOpen] = useState(false);
  const [viewerCodeAreaFilterOpen, setViewerCodeAreaFilterOpen] = useState(false);
  const [findingViewFilters, setFindingViewFilters] = useState([]);
  const [viewerCodeAreaFilter, setViewerCodeAreaFilter] = useState('all');
  const [activeDocId, setActiveDocId] = useState('');
  const [activeDocBoxId, setActiveDocBoxId] = useState(null);
  const [showDocBoxes, setShowDocBoxes] = useState(true);
  const [activeFindingId, setActiveFindingId] = useState(null);
  const [viewerOriginStep, setViewerOriginStep] = useState(STEP_OVERVIEW);
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
  const [documentsPhase, setDocumentsPhase] = useState('upload');
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
  const [reggieInput, setReggieInput] = useState('');
  const [reggieMessages, setReggieMessages] = useState([]);
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
  const [reprocessBannerDismissed, setReprocessBannerDismissed] = useState(false);
  const [uploadAreaCollapsed, setUploadAreaCollapsed] = useState(true);
  const [activeClassificationMenu, setActiveClassificationMenu] = useState(null);
  const [confirmAllUploadsGateOpen, setConfirmAllUploadsGateOpen] = useState(false);
  const [hasViewedUploadTableEnd, setHasViewedUploadTableEnd] = useState(false);
  const [expandedUploadSummaryId, setExpandedUploadSummaryId] = useState('');
  const [expandedCodeAreaId, setExpandedCodeAreaId] = useState('aml');
  const [expandedOverviewFindingIds, setExpandedOverviewFindingIds] = useState({});
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
  const [caseSetupPracticeName, setCaseSetupPracticeName] = useState('');
  const [caseSetupLicenceNumber, setCaseSetupLicenceNumber] = useState('');
  const [caseSetupHolp, setCaseSetupHolp] = useState('');
  const [caseSetupHofa, setCaseSetupHofa] = useState('');
  const [caseSetupRiskLevel, setCaseSetupRiskLevel] = useState('not-assessed');
  const [caseSetupTransactionType, setCaseSetupTransactionType] = useState('');
  const [caseSetupActingForLender, setCaseSetupActingForLender] = useState('');
  const [caseSetupAmlTier, setCaseSetupAmlTier] = useState('');
  const [caseSetupPreviousInspection, setCaseSetupPreviousInspection] = useState('');
  const [caseSetupConcerns, setCaseSetupConcerns] = useState('');
  const [caseSetupParties, setCaseSetupParties] = useState(() => [createPartyRow()]);
  const [caseSetupQuestionnaireFile, setCaseSetupQuestionnaireFile] = useState('');
  const [caseSetupQuestionnaireFileBlob, setCaseSetupQuestionnaireFileBlob] = useState(null);
  const [caseSetupPracticeLookup, setCaseSetupPracticeLookup] = useState(null);
  const [isCaseSetupPracticeLookupLoading, setIsCaseSetupPracticeLookupLoading] = useState(false);
  const [caseSetupPracticeLookupError, setCaseSetupPracticeLookupError] = useState('');
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

  useEffect(() => {
    if (appMode !== 'dashboard') return;
    if (isCurrentUserProfileLoading) return;
    if (DATA_PROVIDER_MODE === 'firestore' && currentUser?.uid && !currentUserProfile) {
      setDashboardCases([]);
      setDashboardError('');
      setIsDashboardLoading(false);
      return;
    }
    let cancelled = false;

    const loadCases = async () => {
      setIsDashboardLoading(true);
      setDashboardError('');
      try {
        const rows = await listCases({
          user: currentUser,
          role: currentUserRole
        });
        if (!cancelled) {
          setDashboardCases(rows);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load dashboard cases from data provider', error);
        if (!cancelled) {
          setDashboardError('Cannot read cases from the data provider. Check auth/rules/API connectivity.');
        }
      } finally {
        if (!cancelled) {
          setIsDashboardLoading(false);
        }
      }
    };

    loadCases();
    return () => {
      cancelled = true;
    };
  }, [appMode, currentUser, currentUserProfile, currentUserRole, isCurrentUserProfileLoading]);

  useEffect(() => {
    if (appMode !== 'inspection') return;
    const caseId = currentCaseMeta.caseId?.trim();
    if (!caseId) return;

    let cancelled = false;

    const loadWorkspace = async () => {
      setIsWorkspaceLoading(true);
      try {
        const snapshot = await loadCaseWorkspaceData(caseId);
        if (!snapshot || cancelled) return;

        setCurrentCaseMeta((prev) => ({
          ...prev,
          practiceName: snapshot.caseMetaPatch.practiceName ?? prev.practiceName,
          caseId: snapshot.caseMetaPatch.caseId ?? prev.caseId,
          owner: snapshot.caseMetaPatch.owner ?? prev.owner,
          started: snapshot.caseMetaPatch.started ?? prev.started,
          riskLevel: snapshot.caseMetaPatch.riskLevel ?? prev.riskLevel,
          previousInspection: snapshot.caseMetaPatch.previousInspection ?? prev.previousInspection,
          holp: snapshot.caseMetaPatch.holp ?? prev.holp,
          hofa: snapshot.caseMetaPatch.hofa ?? prev.hofa,
          transactionType: snapshot.caseMetaPatch.transactionType ?? prev.transactionType,
          actingForLender:
            typeof snapshot.caseMetaPatch.actingForLender === 'boolean'
              ? snapshot.caseMetaPatch.actingForLender
              : prev.actingForLender,
          amlTier: snapshot.caseMetaPatch.amlTier ?? prev.amlTier,
          knownParties: Array.isArray(snapshot.caseMetaPatch.knownParties)
            ? snapshot.caseMetaPatch.knownParties
            : prev.knownParties
        }));

        if (Array.isArray(snapshot.caseMetaPatch.focusAreas)) {
          const selectedAreaSet = new Set(snapshot.caseMetaPatch.focusAreas.map((entry) => String(entry || '').trim()));
          setNotAssessedAreas(
            FOCUS_AREA_OPTIONS.filter((area) => !selectedAreaSet.has(area.id)).map((area) => area.label)
          );
        } else {
          setNotAssessedAreas(NOT_ASSESSED_AREAS);
        }

        setIsActiveCasePersisted(Boolean(snapshot.caseExists));

        setFirestoreDocuments(snapshot.documents);
        setFirestoreFindings(snapshot.findings);
        setFirestoreRequirementsByCodeArea(snapshot.requirementsByCodeArea ?? {});
        setFindingDecisions(snapshot.findingDecisions);
        setFindingNotes(snapshot.findingNotes);
        setDocumentNotes(snapshot.documentNotes);
        setCaseContextNotes(snapshot.caseContextNotes);
        setOverviewRequirementFilter({ areaId: '', requirementId: '' });
        setUploadItems((snapshot.uploadItems ?? []).map((item) => prepareUploadDraft(item)));
        setHistoryItems(snapshot.historyItems.length > 0 ? snapshot.historyItems : INITIAL_HISTORY_ITEMS);
        setInspectorObservations(snapshot.inspectorObservations ?? []);
        setReportSectionIdsByCodeArea(snapshot.reportSectionIdsByCodeArea ?? {});
        setReportOriginalSectionNarrativesByCodeArea(snapshot.reportSectionNarrativesByCodeArea ?? {});
        setReportSectionNarrativesByCodeArea(snapshot.reportSectionNarrativesByCodeArea ?? {});
        setReportOriginalExecutiveSummary(snapshot.reportExecutiveSummary ?? '');
        setReportExecutiveSummaryOverride(snapshot.reportExecutiveSummary ?? '');
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
          setReportOriginalSectionNarrativesByCodeArea({});
          setReportSectionNarrativesByCodeArea({});
          setReportOriginalExecutiveSummary('');
          setReportExecutiveSummaryOverride('');
        }
      } finally {
        if (!cancelled) {
          setIsWorkspaceLoading(false);
        }
      }
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [appMode, currentCaseMeta.caseId]);

  useEffect(() => {
    if (appMode !== 'caseSetup') return;

    const cleanLicenceNumber = caseSetupLicenceNumber.trim();
    if (!cleanLicenceNumber) {
      setCaseSetupPracticeLookup(null);
      setCaseSetupPracticeLookupError('');
      setIsCaseSetupPracticeLookupLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsCaseSetupPracticeLookupLoading(true);
      setCaseSetupPracticeLookupError('');
      try {
        const response = await lookupPracticeByLicenceNumber(cleanLicenceNumber);
        if (cancelled) return;
        if (response?.match && response?.practice) {
          setCaseSetupPracticeLookup(response.practice);
        } else {
          setCaseSetupPracticeLookup(null);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to lookup practice by licence number', error);
        if (!cancelled) {
          setCaseSetupPracticeLookup(null);
          setCaseSetupPracticeLookupError(
            'Could not check previous inspection history right now. You can still enter details manually.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsCaseSetupPracticeLookupLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [appMode, caseSetupLicenceNumber]);

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
      setFindingViewFilters([]);
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
  const reportEditableMetaRefs = useRef({
    interviews: [],
    summary: [],
    goodPractice: [],
    attention: []
  });
  const reportSectionPersistTimersRef = useRef({});
  const lastPersistedCaseSummaryRef = useRef({ caseId: '', key: '' });

  useEffect(() => {
    if (!analysisRunning || currentStep !== STEP_PROCESSING) {
      return;
    }

    if (analysisProgress >= 100) {
      const timeout = setTimeout(() => {
        setAnalysisRunning(false);
        setDocumentsPhase('manage');
        setMaxStepUnlocked((prev) => Math.max(prev, STEP_OVERVIEW));
        setCurrentStep(STEP_OVERVIEW);
      }, 500);
      return () => clearTimeout(timeout);
    }

    const timer = setTimeout(() => {
      const jitter = 0.9 + Math.random() * 0.2;
      setAnalysisProgress((prev) =>
        Math.min(100, prev + ANALYSIS_PROGRESS_INCREMENT * jitter)
      );
    }, ANALYSIS_TICK_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [analysisRunning, analysisProgress, currentStep]);

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

  const allFindings = useMemo(() => [...baseFindings, ...inspectorFindings], [baseFindings, inspectorFindings]);

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

    const nextFindingState = {
      ...baseFinding,
      certainty: nextDecision === 'accepted' && certainty === 'lead' ? 'finding' : baseFinding?.certainty,
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

    const findingBoxes = documentBoxes.filter((box) => relevantBoxIds.has(coerceText(box?.id)));
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

  const analysisStageIndex = Math.min(
    AI_PROCESSING_STEPS.length - 1,
    Math.floor((analysisProgress / 100) * AI_PROCESSING_STEPS.length)
  );

  const analysisMessage =
    AI_PROCESSING_MESSAGES[Math.min(AI_PROCESSING_MESSAGES.length - 1, analysisStageIndex)] ??
    AI_PROCESSING_MESSAGES[0];

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
      { id: 'warning', label: 'Leads', count: counts.warning },
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

  const setSingleFindingViewFilter = useCallback((filterKey) => {
    setFindingViewFilters(filterKey === 'all' ? [] : [filterKey]);
  }, []);

  const filteredFindings = availableFindings
    .filter((finding) => (filterSeverity.length === 0 ? true : filterSeverity.includes(getFindingBucketId(finding))))
    .filter((finding) => {
      if (findingViewFilters.length === 0) return true;

      const state = findingDecisions[finding.id] ?? 'unreviewed';
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

  const reviewedCount = availableFindings.filter((finding) => Boolean(findingDecisions[finding.id])).length;
  const pendingReviewCount = Math.max(availableFindings.length - reviewedCount, 0);
  const rejectedCount = useMemo(
    () => availableFindings.filter((finding) => findingDecisions[finding.id] === 'rejected').length,
    [availableFindings, findingDecisions]
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
  const allRequirementsMet =
    caseDocuments.length > 0 &&
    availableFindings.length > 0 &&
    pendingReviewCount === 0 &&
    criticalCount === 0 &&
    leadCount === 0;
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

  const codeAreaDisplayMap = useMemo(() => {
    const base = new Map();
    FOCUS_AREA_OPTIONS.forEach((area) => base.set(area.id, area.label));
    COMPLIANCE_CODE_AREAS.forEach((area) => base.set(area.id, area.name));
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
    if (normalized.includes('complaint')) return 'complaints';
    if (normalized.includes('client care') || normalized.includes('engagement')) return 'client-care';
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
  const reportStale = hasGeneratedReport && reportNeedsRegeneration;
  const summaryCardDetailMap = useMemo(() => {
    return {
      critical:
        criticalCount > 0 || leadCount > 0
          ? `${criticalCount} critical, ${leadCount} guidance`
          : '0 critical, 0 guidance',
      warning: pendingReviewCount > 0 ? `${pendingReviewCount} awaiting judgment` : 'awaiting judgment',
      pass: metRequirementsCount > 0 ? `${metRequirementsCount} requirements confirmed` : 'none confirmed yet',
      best_practice:
        goodPracticeCount > 0
          ? `across ${Math.max(goodPracticeAreaCount, 1)} code area${goodPracticeAreaCount === 1 ? '' : 's'}`
          : 'none highlighted'
    };
  }, [criticalCount, goodPracticeAreaCount, goodPracticeCount, leadCount, metRequirementsCount, pendingReviewCount]);
  const overviewSummaryCards = useMemo(() => {
    const compliantCount = metRequirementsCount;
    const goodPracticeAreas = new Set();
    const unresolvedLeadCount = availableFindings.filter((finding) => {
      if (!isLeadFindingByTaxonomy(finding)) return false;
      return (findingDecisions[finding.id] ?? 'unreviewed') === 'unreviewed';
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
        value: criticalCount + leadCount,
        detail: `${criticalCount} critical, ${leadCount} guidance`,
        tone: 'attention',
        active: findingViewFilters.includes('non_compliant'),
        onClick: () => setSingleFindingViewFilter('non_compliant')
      },
      {
        id: 'review',
        label: 'Leads',
        value: unresolvedLeadCount,
        detail: 'awaiting judgment',
        tone: 'review',
        active: findingViewFilters.includes('leads'),
        onClick: () => setSingleFindingViewFilter('leads')
      },
      {
        id: 'compliant',
        label: 'Compliant',
        value: compliantCount,
        detail: compliantCount > 0 ? 'requirements confirmed' : 'none confirmed yet',
        tone: 'good',
        active: findingViewFilters.includes('compliant'),
        onClick: () => setSingleFindingViewFilter('compliant')
      },
      {
        id: 'good',
        label: 'Good Practice',
        value: goodPracticeCount,
        detail: `across ${goodPracticeAreas.size} code area${goodPracticeAreas.size === 1 ? '' : 's'}`,
        tone: 'good',
        active: findingViewFilters.includes('good_practice'),
        onClick: () => setSingleFindingViewFilter('good_practice')
      }
    ];
  }, [availableFindings, criticalCount, findingDecisions, findingViewFilters, goodPracticeCount, leadCount, metRequirementsCount, normalizeCodeAreaId, setSingleFindingViewFilter]);
  const activeSeverityLabels = filterSeverity.map((key) => SEVERITY_LABEL_MAP[key] ?? key);

  const complianceCodeAreas = useMemo(() => {
    const map = new Map();

    COMPLIANCE_CODE_AREAS.forEach((area) => {
      map.set(area.id, { ...area });
    });

    Object.keys(requirementsByCodeArea).forEach((rawAreaId) => {
      const normalized = normalizeCodeAreaId(rawAreaId) || rawAreaId;
      if (!map.has(normalized)) {
        map.set(normalized, {
          id: normalized,
          name: formatCodeAreaLabel(rawAreaId),
          met: '0/0'
        });
      }
    });

    availableFindings.forEach((finding) => {
      const normalized = normalizeCodeAreaId(textOf(finding.codeArea || finding.code_area, ''));
      if (!normalized) return;
      if (!map.has(normalized)) {
        map.set(normalized, {
          id: normalized,
          name: formatCodeAreaLabel(normalized),
          met: '0/0'
        });
      }
    });

    return Array.from(map.values());
  }, [availableFindings, formatCodeAreaLabel, normalizeCodeAreaId, requirementsByCodeArea]);

  const reportIncludedFindings = useMemo(
    () => availableFindings.filter((finding) => findingDecisions[finding.id] === 'accepted'),
    [availableFindings, findingDecisions]
  );

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

  const reportCanGenerate = availableFindings.length > 0 && pendingReviewCount === 0;
  const reportReviewBlockedReason =
    pendingReviewCount > 0
      ? `Review all findings before generating the report (${pendingReviewCount} awaiting judgment).`
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
        ? `Of ${total} findings across ${codeAreaCount || 1} code area${codeAreaCount === 1 ? '' : 's'}, ${compliantCount} are compliant, ${goodPracticeCount} are good practice, and ${criticalCount + leadCount} require attention.`
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
    const generated = reportAttentionFindings.slice(0, 6).map((finding, index) => ({
      id: `ra-auto-${finding.id}`,
      action: safeText(finding.title, 'Review and resolve finding'),
      codeRef: safeText(finding.reference, ''),
      codeArea: formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General')),
      deadline: 'TBD',
      person: index === 0 ? (currentCaseMeta.owner || '') : ''
    }));
    return generated.length > 0 ? generated : REPORT_ACTION_DEFAULTS.map((item) => ({ ...item }));
  }, [reportAttentionFindings, formatCodeAreaLabel, currentCaseMeta.owner]);

  const reportInspectionType = useMemo(() => {
    if (uploadItems.length > 0) return 'Desk-based review';
    return 'Inspection type pending';
  }, [uploadItems.length]);

  useEffect(() => {
    if (reportActionItems.length === 0) {
      setReportActionItems(reportActionDefaults.map((item) => ({ ...item })));
    }
  }, [reportActionItems.length, reportActionDefaults]);

  useEffect(() => {
    if (appMode !== 'inspection' || !isActiveCasePersisted) return;

    const cleanCaseId = currentCaseMeta.caseId?.trim();
    if (!cleanCaseId) return;

    const criticalCount = severityCounts.find((entry) => entry.id === 'critical')?.count ?? 0;
    const leadCount = severityCounts.find((entry) => entry.id === 'warning')?.count ?? 0;
    const isCompleted =
      currentStep === STEP_REPORT &&
      hasGeneratedReport &&
      !reportNeedsRegeneration &&
      pendingReviewCount === 0;
    const nextOutcome = isCompleted
      ? criticalCount > 0
        ? 'non_compliant'
        : leadCount > 0
          ? 'generally_compliant'
          : 'compliant'
      : 'in_progress';

    const patch = {
      status: isCompleted ? 'completed' : 'active',
      outcome: nextOutcome
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
    isActiveCasePersisted,
    hasGeneratedReport,
    currentCaseMeta.caseId,
    currentStep,
    reportNeedsRegeneration,
    pendingReviewCount,
    severityCounts,
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
        const decision = findingDecisions[finding.id] ?? 'unreviewed';
        return {
          id: finding.id,
          title: textOf(finding.title, 'Finding'),
          codeArea: formatCodeAreaLabel(textOf(finding.codeArea || finding.code_area, 'General')),
          severity: REPORT_SEVERITY_LABEL_MAP[getFindingBucketId(finding)] ?? 'Finding',
          resolution:
            decision === 'accepted'
              ? 'Accepted'
              : decision === 'rejected'
                ? 'Rejected'
                : decision === 'dismissed'
                  ? 'Dismissed'
                  : 'Open',
          recurring: RECURRING_FINDING_IDS.has(finding.id)
        };
      }),
    [reportAttentionFindings, findingDecisions, formatCodeAreaLabel]
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
          setExpandedCodeAreaId(targetCodeAreaId);
        }
        setActiveFindingId(findingId);
      }
      setCurrentStep(STEP_OVERVIEW);
    },
    [allFindings, normalizeCodeAreaId, safeText]
  );

  const activeCaseTabId = useMemo(() => {
    if (currentStep === STEP_VIEWER) {
      return viewerOriginStep === STEP_DOCUMENTS ? 'documents' : 'overview';
    }
    if (currentStep === STEP_OVERVIEW) return 'overview';
    if (currentStep === STEP_REPORT) return 'report';
    if (currentStep === STEP_HISTORY) return 'history';
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
      const unresolvedForDoc = findingsForDoc.filter((finding) => !findingDecisions[finding.id]).length;
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
  }, [allFindings, caseDocuments, findingDecisions, uploadItems]);

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
      .filter((item) => (showCompletedCases ? true : item.progress < 100))
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
      .filter((item) =>
        dashboardDateFilter === 'All'
          ? true
          : dashboardDateFilter === 'This week'
            ? item.lastActivity.includes('hour') || item.lastActivity.includes('minute')
            : true
      );
  }, [
    dashboardScopeCases,
    dashboardSearch,
    showCompletedCases,
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
    () => dashboardScopeCases.filter((item) => item.progress < 100).length,
    [dashboardScopeCases]
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

  const pendingReprocessSummary = useMemo(() => {
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
  }, [queuedUploadCount, findingNoteCount, markedDocsCount, pendingScopeChangeCount]);

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
    if (documentsPhase !== 'upload') return undefined;
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
    if (appMode !== 'inspection' || currentStep !== STEP_DOCUMENTS) return;
    if (!uploadItems.some((item) => item.status === 'queued')) return;

    const timer = setTimeout(() => {
      let changedUploads = [];
      setUploadItems((previousItems) => {
        const nextItems = previousItems.map((item) => {
          if (item.status !== 'queued') return item;
          const nextClassification =
            !isUploadClassificationResolved(item)
              ? suggestClassificationFromFilename(item.name)
              : item.classification;
          const nextItem = prepareUploadDraft({
            ...item,
            status: 'classified',
            classification: nextClassification,
            confidence: item.confidence === 'high' ? 'high' : 'medium',
            summary:
              item.summary ||
              `Auto-classified from filename. Please verify and confirm before generating findings.`
          });
          changedUploads.push(nextItem);
          return nextItem;
        });
        return changedUploads.length > 0 ? nextItems : previousItems;
      });

      if (changedUploads.length === 0) return;

      setProcessingLog((previous) => [
        {
          id: `p${Date.now()}-classified`,
          detail: `${changedUploads.length} document${
            changedUploads.length === 1 ? '' : 's'
          } finished classification and now require confirmation`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...previous
      ]);
      setReportNeedsRegeneration(true);

      if (isActiveCasePersisted) {
        Promise.all(
          changedUploads.map((uploadItem) =>
            persistUploadItem({
              caseId: currentCaseMeta.caseId,
              uploadItem,
              user: currentUser
            })
          )
        ).catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to persist auto-classified uploads', error);
        });
      }
    }, 1400);

    return () => clearTimeout(timer);
  }, [
    appMode,
    currentStep,
    uploadItems,
    currentCaseMeta.caseId,
    currentUser,
    isActiveCasePersisted
  ]);

  useEffect(() => {
    setReprocessBannerDismissed(false);
  }, [pendingReprocessSummary]);

  useEffect(() => {
    if (documentWorkspaceTab !== 'findings') {
      setDocCrossSearchOpen(false);
    }
  }, [documentWorkspaceTab]);

  useEffect(() => {
    if (currentStep === STEP_DOCUMENTS) {
      setDocumentsPhase('upload');
    }
  }, [currentStep]);

  useEffect(() => {
    const assistantAllowed = appMode === 'inspection' && (currentStep === STEP_OVERVIEW || currentStep === STEP_VIEWER);
    if (!assistantAllowed && reggieOpen) {
      setReggieOpen(false);
    }
  }, [appMode, currentStep, reggieOpen]);

  useEffect(() => {
    if (filteredFindings.length === 0) {
      setActiveFindingId(null);
      return;
    }
    if (!filteredFindings.some((finding) => finding.id === activeFindingId)) {
      setActiveFindingId(filteredFindings[0].id);
    }
  }, [filteredFindings, activeFindingId]);

  useEffect(() => {
    if (complianceCodeAreas.length === 0) return;
    if (complianceCodeAreas.some((area) => area.id === expandedCodeAreaId)) return;
    setExpandedCodeAreaId(complianceCodeAreas[0].id);
  }, [complianceCodeAreas, expandedCodeAreaId]);

  const totalSteps = INSPECTION_LINEAR_FINAL_STEP;

  const handleGoHome = useCallback(() => {
    setAppMode('dashboard');
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setDocLevelNoteOpen(false);
    setReportPendingGateOpen(false);
    setReportRegenerateConfirmOpen(false);
    setReggieOpen(false);
  }, []);

  const handleCaseTabNavigate = (targetStep) => {
    if (targetStep <= maxStepUnlocked) {
      setCurrentStep(targetStep);
    }
  };

  const handleOpenCase = (caseItem) => {
    const targetStep = STEP_OVERVIEW;
    setAppMode('inspection');
    setIsActiveCasePersisted(false);
    setCurrentStep(targetStep);
    setMaxStepUnlocked((prev) => Math.max(prev, totalSteps));
    setDocSearchQuery('');
    setDocCrossSearchOpen(false);
    setNoteTargetFindingId(null);
    setDocLevelNoteOpen(false);
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setFindingViewFilters([]);
    setViewerCodeAreaFilter('all');
    setFilterSeverity([]);
    setSeverityFilterOpen(false);
    setExpandedCodeAreaId('aml');
    setReportDraftVersion((prev) => prev + 1);
    setReportPendingChanges(false);
    if (targetStep === STEP_DOCUMENTS) {
      setDocumentsPhase('upload');
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
        riskLevel: caseItem.risk ?? prev.riskLevel
      }));
    }
  };

  const handleOpenCompletedCase = (caseItem) => {
    const targetStep = STEP_REPORT;
    setAppMode('inspection');
    setIsActiveCasePersisted(false);
    setCurrentStep(targetStep);
    setMaxStepUnlocked((prev) => Math.max(prev, totalSteps));
    setDocSearchQuery('');
    setDocCrossSearchOpen(false);
    setNoteTargetFindingId(null);
    setDocLevelNoteOpen(false);
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setFindingViewFilters([]);
    setViewerCodeAreaFilter('all');
    setFilterSeverity([]);
    setSeverityFilterOpen(false);
    setExpandedCodeAreaId('aml');
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
        riskLevel: caseItem.risk ?? prev.riskLevel
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
    const nextKnownParties = caseSetupParties
      .map((party) => ({
        name: String(party?.name || '').trim(),
        role: String(party?.role || '').trim()
      }))
      .filter((party) => party.name);

    if (
      !caseSetupPracticeName.trim() ||
      !caseSetupLicenceNumber.trim() ||
      selectedFocusAreaIds.size === 0
    ) {
      return;
    }
    if (isCreatingCase) return;
    setCaseCreateError('');
    const uncheckedAreas = FOCUS_AREA_OPTIONS.filter((area) => !selectedFocusAreaIds.has(area.id)).map(
      (area) => area.label
    );
    const nextCaseId = caseSetupLicenceNumber.trim();
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
        knownParties: nextKnownParties,
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
    setReportActionItems(reportActionDefaults.map((item) => ({ ...item })));
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
      knownParties: nextKnownParties,
      previousInspection: nextPreviousInspection,
      holp: nextHolp || prev.holp,
      hofa: nextHofa || prev.hofa
    }));
    setDashboardCases((prev) => [
      {
        id: persistedCaseId,
        practice: nextPracticeName,
        started: new Date().toLocaleDateString(),
        progress: 0,
        progressLabel: '0/0 requirements met',
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
    setCaseSetupPracticeName('');
    setCaseSetupLicenceNumber('');
    setCaseSetupHolp('');
    setCaseSetupHofa('');
    setCaseSetupRiskLevel('not-assessed');
    setCaseSetupTransactionType('');
    setCaseSetupActingForLender('');
    setCaseSetupAmlTier('');
    setCaseSetupPreviousInspection('');
    setCaseSetupConcerns('');
    setCaseSetupParties([createPartyRow()]);
    setCaseSetupQuestionnaireFile('');
    setCaseSetupQuestionnaireFileBlob(null);
    setCaseSetupPracticeLookup(null);
    setCaseSetupPracticeLookupError('');
    setIsCaseSetupPracticeLookupLoading(false);
    if (caseSetupFileInputRef.current) {
      caseSetupFileInputRef.current.value = '';
    }
    setSelectedFocusAreaIds(new Set(FOCUS_AREA_OPTIONS.map((area) => area.id)));
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
    setPendingScopeChangeCount(0);
    setReportDraftVersion((prev) => prev + 1);
    setAppMode('inspection');
    setCurrentStep(STEP_DOCUMENTS);
    setMaxStepUnlocked((prev) => Math.max(prev, totalSteps));
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
            ? 'Dismissed as lead'
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
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist finding decision', error);
      });
    }
  };

  const handleRequestFindingDecision = (findingId, nextDecision) => {
    const targetFinding = allFindings.find((finding) => finding.id === findingId) ?? null;
    if (nextDecision === 'accepted' && targetFinding && isLeadFindingByTaxonomy(targetFinding)) {
      setActiveMenuFindingId(null);
      openLeadConfirmModal(
        findingId,
        currentStep === STEP_VIEWER ? STEP_VIEWER : currentStep === STEP_REPORT ? STEP_REPORT : STEP_OVERVIEW
      );
      return;
    }
    if (nextDecision === 'accepted' || nextDecision === null) {
      handleFindingDecision(findingId, nextDecision);
      return;
    }
    if (nextDecision === 'rejected') {
      setNoteTargetFindingId(null);
      setInlineDismissFindingId(null);
      setInlineRejectFindingId(findingId);
      setInlineRejectReason('');
      setInlineRejectNote('');
      setActiveMenuFindingId(null);
      return;
    }
    if (nextDecision === 'dismissed') {
      setNoteTargetFindingId(null);
      setInlineRejectFindingId(null);
      setInlineDismissFindingId(findingId);
      setInlineDismissReason('');
      setInlineDismissNote('');
      setActiveMenuFindingId(null);
      return;
    }
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
        status: 'queued',
        classification: 'Unknown',
        parties: 'Firm',
        interviewees: [],
        confidence: 'low',
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

      if (isActiveCasePersisted) {
        Promise.all(
          newItems.map(async (uploadItem) => {
            const persisted = await persistUploadItem({
              caseId: currentCaseMeta.caseId,
              uploadItem,
              user: currentUser
            });
            return { tempId: uploadItem.id, persisted };
          })
        )
          .then((results) => {
            const replacementMap = new Map();
            results.forEach(({ tempId, persisted }) => {
              if (!persisted || typeof persisted !== 'object') return;
              const serverId = coerceText(persisted.id).trim();
              if (!serverId || serverId === tempId) return;
              replacementMap.set(tempId, {
                id: serverId,
                name: persisted.filename || persisted.name || undefined,
                filename: persisted.filename || undefined,
                classification: persisted.classification || undefined,
                status:
                  persisted.confirmed === true
                    ? 'verified'
                    : persisted.processing_status || persisted.status || undefined,
                confidence: persisted.confidence || undefined
              });
            });

            if (replacementMap.size === 0) return;

            setUploadItems((prev) =>
              prev.map((entry) => {
                const replacement = replacementMap.get(entry.id);
                if (!replacement) return entry;
                return {
                  ...entry,
                  id: replacement.id,
                  name: replacement.name || entry.name,
                  filename: replacement.filename || entry.filename,
                  classification: replacement.classification ?? entry.classification,
                  status: replacement.status || entry.status,
                  confidence: replacement.confidence || entry.confidence,
                  file: null
                };
              })
              .map((entry) => prepareUploadDraft(entry))
            );
          })
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Failed to persist new upload item(s)', error);
          });
      }
    },
    [buildUploadItem, currentCaseMeta.caseId, currentUser, isActiveCasePersisted]
  );

  const handleUploadFileSelection = useCallback(
    (event) => {
      const files = Array.from(event.target.files ?? []).filter((file) =>
        /\.pdf$/i.test(coerceText(file?.name)) || file?.type === 'application/pdf'
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
        /\.pdf$/i.test(coerceText(file?.name)) || file?.type === 'application/pdf'
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

  const handleUploadClassificationSelect = (uploadId, groupLabel, optionLabel) => {
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;

        const nextBase = {
          ...entry,
          classification: optionLabel === DOCUMENT_CLASSIFICATION_OTHER_OPTION ? groupLabel : optionLabel,
          classificationL1: groupLabel,
          classificationL2: optionLabel,
          classificationDetail:
            optionLabel === DOCUMENT_CLASSIFICATION_OTHER_OPTION ? entry.classificationDetail ?? '' : '',
          limitedAnalysis: optionLabel === DOCUMENT_CLASSIFICATION_OTHER_OPTION,
          status: 'classified',
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

        const nextEntry = prepareUploadDraft({
          ...entry,
          classificationDetail: value,
          limitedAnalysis: true,
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
              : isUploadClassificationResolved(entry)
                ? 'classified'
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

  const handleToggleUploadConfirmed = (uploadId) => {
    const target = uploadItems.find((item) => item.id === uploadId);
    if (!target) return;
    if (!isUploadReadyForConfirmation(target)) return;

    const nextStatus = target.status === 'verified' ? 'classified' : 'verified';
    const nextItem = prepareUploadDraft({ ...target, status: nextStatus });
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

  const handleGenerateFindings = () => {
    if (!allUploadsVerified) return;
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
    setAnalysisProgress(8);
    setAnalysisRunning(true);
    setCurrentStep(STEP_PROCESSING);
    setMaxStepUnlocked((prev) => Math.max(prev, STEP_PROCESSING));
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
    const nextReportActions = reportActionDefaults.map((item) => ({ ...item }));
    const nextActionIds = new Set(nextReportActions.map((item) => item.id));
    const removedActionIds = reportActionItems
      .map((item) => item.id)
      .filter((actionId) => !nextActionIds.has(actionId));
    setReportRegenerateConfirmOpen(false);
    setReportPendingAction('generate');
    setHasGeneratedReport(true);
    setEditedReportSections({ interviews: false, summary: false, attention: false, goodPractice: false });
    handleRevertReportSection('summary');
    handleRevertReportSection('goodPractice');
    handleRevertReportSection('attention');
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
            : 'Report generated from reviewed findings',
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
    if (pendingReviewCount > 0) return;
    if (reportPendingChanges) {
      setReportPendingAction('generate');
      setReportPendingGateOpen(true);
      return;
    }
    void runReportGeneration('generate');
  };

  const handleConfirmReportRegenerate = () => {
    if (reportGenerationInProgress) return;
    if (pendingReviewCount > 0) return;
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
        `Leads: ${leadCount}`,
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
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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
    setSelectedFocusAreaIds(new Set(AML_DESK_REVIEW_PRESET));
  };

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

  const handleAddPartyRow = () => {
    setCaseSetupParties((prev) => [...prev, createPartyRow()]);
  };

  const handleRemovePartyRow = (rowId) => {
    setCaseSetupParties((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createPartyRow()];
    });
  };

  const handleUpdatePartyRow = (rowId, field, value) => {
    setCaseSetupParties((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleSendReggie = (manualQuery) => {
    const query = (manualQuery ?? reggieInput).trim();
    if (!query) return;
    const userMessage = { id: `r${Date.now()}-u`, role: 'user', text: query };
    const candidate = filteredCrossDocResults[0];
    const relatedDoc = candidate ? documentsById.get(candidate.documentId) : null;
    const assistantText = candidate
      ? `I found relevant passages. ${relatedDoc?.label ?? 'AML_Policy_2023.pdf'} includes: "${candidate.title}".`
      : 'I found relevant references across this case. Try "source of funds", "training", or "overseas transactions".';
    const assistantMessage = { id: `r${Date.now()}-a`, role: 'assistant', text: assistantText };
    setReggieMessages((prev) => [...prev, userMessage, assistantMessage]);
    setReggieInput('');
  };

  const handleQuickReggiePrompt = (prompt) => {
    handleSendReggie(prompt);
  };

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
      }).catch((error) => {
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
      applyViewerSelection(
        { documentId, boxId, findingId, originStep },
        { pushHistory: currentStep === STEP_VIEWER }
      );
    },
    [applyViewerSelection, currentStep, viewerOriginStep]
  );

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
    },
    [activeDocId, allFindings, createLeadConfirmDocumentAnchor]
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
    if (explicitCodeArea && normalizedArea) {
      if (explicitCodeArea.includes(normalizedArea) || normalizedArea.includes(explicitCodeArea)) {
        return true;
      }
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
      onOpenNewCase={() => setAppMode('caseSetup')}
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
        onBackToDashboard={() => setAppMode('dashboard')}
        caseCreateError={caseCreateError}
        caseSetupPracticeName={caseSetupPracticeName}
        setCaseSetupPracticeName={setCaseSetupPracticeName}
        caseSetupLicenceNumber={caseSetupLicenceNumber}
        setCaseSetupLicenceNumber={setCaseSetupLicenceNumber}
        isCaseSetupPracticeLookupLoading={isCaseSetupPracticeLookupLoading}
        caseSetupPracticeLookupError={caseSetupPracticeLookupError}
        caseSetupPracticeLookup={caseSetupPracticeLookup}
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
        caseSetupParties={caseSetupParties}
        handleUpdatePartyRow={handleUpdatePartyRow}
        handleRemovePartyRow={handleRemovePartyRow}
        handleAddPartyRow={handleAddPartyRow}
        caseSetupFileInputRef={caseSetupFileInputRef}
        setCaseSetupQuestionnaireFile={setCaseSetupQuestionnaireFile}
        setCaseSetupQuestionnaireFileBlob={setCaseSetupQuestionnaireFileBlob}
        caseSetupQuestionnaireFile={caseSetupQuestionnaireFile}
        isCreatingCase={isCreatingCase}
        handleCreateCase={handleCreateCase}
      />
    );
  };

  const renderComplianceByCodeArea = () => (
    <ComplianceByCodeAreaPanel
      openComposerModal={openComposerModal}
      complianceCodeAreas={complianceCodeAreas}
      requirementsByCodeArea={requirementsByCodeArea}
      availableFindings={availableFindings}
      findingMatchesCodeArea={findingMatchesCodeArea}
      getFindingBucketId={getFindingBucketId}
      expandedCodeAreaId={expandedCodeAreaId}
      setExpandedCodeAreaId={setExpandedCodeAreaId}
      filteredFindings={filteredFindings}
      overviewRequirementFilter={overviewRequirementFilter}
      setOverviewRequirementFilter={setOverviewRequirementFilter}
      overviewFilterRef={overviewFilterRef}
      findingViewFilters={findingViewFilters}
      setOverviewFilterOpen={setOverviewFilterOpen}
      overviewFilterOpen={overviewFilterOpen}
      findingFilterLabelMap={FINDING_FILTER_LABEL_MAP}
      toggleFindingViewFilter={toggleFindingViewFilter}
      clearFindingViewFilters={clearFindingViewFilters}
      findingDecisions={findingDecisions}
      expandedOverviewFindingIds={expandedOverviewFindingIds}
      setExpandedOverviewFindingIds={setExpandedOverviewFindingIds}
      findingSeverityBadgeMap={FINDING_SEVERITY_BADGE_MAP}
      findingEvidenceStrengthMap={FINDING_EVIDENCE_STRENGTH_MAP}
      isLeadFindingByTaxonomy={isLeadFindingByTaxonomy}
      isInspectorAddedFinding={isInspectorAddedFinding}
      buildEvidencePassages={buildEvidencePassages}
      findingNotes={findingNotes}
      safeText={safeText}
      formatReferenceText={formatReferenceText}
      activeMenuFindingId={activeMenuFindingId}
      setActiveMenuFindingId={setActiveMenuFindingId}
      findingMenuRef={findingMenuRef}
      handleRequestFindingDecision={handleRequestFindingDecision}
      handleOpenAddNote={handleOpenAddNote}
      handleDeleteFinding={handleDeleteFinding}
      handleViewDocument={handleViewDocument}
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
      noteTargetFindingId={noteTargetFindingId}
      noteDraft={noteDraft}
      setNoteDraft={setNoteDraft}
      setNoteTargetFindingId={setNoteTargetFindingId}
      handleSaveFindingNote={handleSaveFindingNote}
      leadConfirmOpen={leadConfirmModal.open}
      leadConfirmFindingId={leadConfirmModal.findingId}
      leadConfirmOriginStep={leadConfirmModal.originStep}
      closeLeadConfirmModal={closeLeadConfirmModal}
      launchLeadEvidenceHighlighter={launchLeadEvidenceHighlighter}
      notAssessedExpanded={notAssessedExpanded}
      setNotAssessedExpanded={setNotAssessedExpanded}
      notApplicableExpanded={notApplicableExpanded}
      setNotApplicableExpanded={setNotApplicableExpanded}
      notAssessedAreas={notAssessedAreas}
      notApplicableAreas={notApplicableAreas}
      handleRestoreNotAssessedArea={handleRestoreNotAssessedArea}
    />
  );

  const renderFindingsWorkspace = () => (
    <ViewerStage
      caseDocuments={caseDocuments}
      setCurrentStep={setCurrentStep}
      viewerOriginStep={viewerOriginStep}
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
      setDocLevelNoteOpen={setDocLevelNoteOpen}
      docCrossSearchOpen={docCrossSearchOpen}
      setDocCrossSearchOpen={setDocCrossSearchOpen}
      setFeedbackOpen={setFeedbackOpen}
      docLevelNoteOpen={docLevelNoteOpen}
      docLevelNoteDraft={docLevelNoteDraft}
      setDocLevelNoteDraft={setDocLevelNoteDraft}
      handleSaveDocumentNote={handleSaveDocumentNote}
      documentNotes={documentNotes}
      docSearchScope={docSearchScope}
      setDocSearchScope={setDocSearchScope}
      docSearchQuery={docSearchQuery}
      isProviderSearchLoading={isProviderSearchLoading}
      filteredInDocumentResults={filteredInDocumentResults}
      filteredCrossDocResults={filteredCrossDocResults}
      documentsById={documentsById}
      formatSourceDocumentRef={formatSourceDocumentRef}
      handleViewDocument={handleViewDocument}
      handleOpenAddNote={handleOpenAddNote}
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
      findingDecisions={findingDecisions}
      findingNotes={findingNotes}
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
      formatReferenceText={formatReferenceText}
      openLeadConfirmModal={openLeadConfirmModal}
      noteTargetFindingId={noteTargetFindingId}
      noteDraft={noteDraft}
      setNoteDraft={setNoteDraft}
      setNoteTargetFindingId={setNoteTargetFindingId}
      handleSaveFindingNote={handleSaveFindingNote}
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
      handleToggleUploadConfirmed={handleToggleUploadConfirmed}
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
      handleConfirmAllUploads={handleConfirmAllUploads}
      handleGenerateFindings={handleGenerateFindings}
      documentsNotesExpanded={documentsNotesExpanded}
      setDocumentsNotesExpanded={setDocumentsNotesExpanded}
      flattenedDocumentNotes={flattenedDocumentNotes}
      documentsLogExpanded={documentsLogExpanded}
      setDocumentsLogExpanded={setDocumentsLogExpanded}
      processingLog={processingLog}
      setDocumentWorkspaceTab={setDocumentWorkspaceTab}
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
    setAnalysisProgress(8);
    setAnalysisRunning(true);
    setCurrentStep(STEP_PROCESSING);
  };

  const renderCaseHeader = () => {
    if (currentStep === STEP_VIEWER) {
      return null;
    }
    const openFindings = allFindings.filter((finding) => !findingDecisions[finding.id]).length;
    const dataSourceLabel = isActiveCasePersisted ? 'Firestore' : 'Draft';
    const caseTabCounts = {
      overview: pendingReviewCount,
      documents: caseDocuments.length
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
      onGoToDocuments={() => setCurrentStep(STEP_DOCUMENTS)}
      overviewSummaryCards={overviewSummaryCards}
      allRequirementsMet={allRequirementsMet}
      allRequirementsMetDetail={allRequirementsMetDetail}
      showHighRejectionPrompt={showHighRejectionPrompt}
      onOpenContextNote={() => setContextNoteOpen(true)}
      onDismissHighRejectionPrompt={() => setHighRejectionPromptDismissed(true)}
      complianceContent={renderComplianceByCodeArea()}
      onGoToReport={() => setCurrentStep(STEP_REPORT)}
      canGoToReport={Boolean(activeDocId) && caseDocuments.length > 0}
    />
  );

  const renderProcessingWorkspace = () => (
    <ProcessingStage
      analysisMessage={analysisMessage}
      analysisProgress={analysisProgress}
      analysisStageIndex={analysisStageIndex}
    />
  );

  const renderReportWorkspace = () => (
    <ReportStage
      availableFindings={availableFindings}
      onGoToDocumentsTab={() => {
        setCurrentStep(STEP_DOCUMENTS);
        setDocumentWorkspaceTab('lifecycle');
      }}
      hasGeneratedReport={hasGeneratedReport}
      reportGenerationInProgress={reportGenerationInProgress}
      reportGenerationMode={reportGenerationMode}
      reportCanGenerate={reportCanGenerate}
      reportReviewBlockedReason={reportReviewBlockedReason}
      reportPendingChanges={reportPendingChanges}
      onGenerateReport={handleGenerateReport}
      onOpenPendingChangesGate={() => {
        setReportPendingAction('regenerate');
        setReportPendingGateOpen(true);
      }}
      reportStale={reportStale}
      onOpenRegenerateConfirm={() => {
        if (pendingReviewCount > 0) return;
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
      reportActionDefaults={reportActionDefaults}
      reportActionItems={reportActionItems}
      setReportActionItems={setReportActionItems}
      upsertReportActionItem={upsertReportActionItem}
      deleteReportActionItem={deleteReportActionItem}
      reportCodeAreaSummaries={reportCodeAreaSummaries}
      caseContextNotes={caseContextNotes}
      inspectorObservations={inspectorObservations}
      handleUpdateObservation={handleUpdateObservation}
      handleDeleteObservation={handleDeleteObservation}
      notAssessedAreas={notAssessedAreas}
      reportAppendixRows={reportAppendixRows}
    />
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case STEP_DOCUMENTS:
        return renderDocumentsLifecycleWorkspace();
      case STEP_PROCESSING:
        return renderProcessingWorkspace();
      case STEP_OVERVIEW:
        return renderOverviewWorkspace();
      case STEP_VIEWER:
        return (
          <div className="stage-card doc-viewer-stage">
            {renderFindingsWorkspace()}
          </div>
        );
      case STEP_HISTORY:
        return (
          <HistoryStage
            reportPendingChanges={reportPendingChanges}
            pendingReprocessSummary={pendingReprocessSummary}
            onReprocessNow={() => {
              setDocsMarkedForReprocess({});
              setPendingScopeChangeCount(0);
              setReportPendingChanges(false);
              setAnalysisProgress(8);
              setAnalysisRunning(true);
              setCurrentStep(STEP_PROCESSING);
            }}
            onOpenHistoryFinding={handleOpenHistoryFinding}
            currentCaseMeta={currentCaseMeta}
            hasInspectionHistory={hasInspectionHistory}
            historyTrendRows={historyTrendRows}
            historyFindingsRows={historyFindingsRows}
            currentCaseOutcome={currentCaseOutcome}
            formatOutcomeLabel={formatOutcomeLabel}
            reviewedCount={reviewedCount}
            availableFindingsCount={availableFindings.length}
            recurringFindingCount={recurringFindingCount}
            onBackToOverview={() => setCurrentStep(STEP_OVERVIEW)}
            onOpenReport={() => setCurrentStep(STEP_REPORT)}
          />
        );
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
    appMode === 'inspection'
      ? currentCaseMeta.practiceName
      : appMode === 'caseSetup'
        ? 'New Inspection Case'
        : 'Dashboard';
  const shellShowHeaderContext = !(appMode === 'inspection' && currentStep === STEP_VIEWER);
  const shellShowHeaderContextChevron = appMode === 'inspection' && currentStep !== STEP_VIEWER;
  const shellCompactHeader = appMode === 'inspection' && currentStep === STEP_VIEWER;
  const shellShowAssistant =
    appMode === 'inspection' && (currentStep === STEP_OVERVIEW || currentStep === STEP_VIEWER);
  const shellNavigationItems = useMemo(() => {
    if (appMode === 'inspection') {
      const caseTabCounts = {
        overview: pendingReviewCount,
        documents: caseDocuments.length
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
            tab.id === 'overview'
              ? 'Review findings'
              : tab.id === 'documents'
                ? 'Upload and verify evidence'
                : tab.id === 'history'
                  ? 'Timeline and recurring items'
                  : 'Generate and export output',
          count: Object.prototype.hasOwnProperty.call(caseTabCounts, tab.id) ? caseTabCounts[tab.id] : undefined,
          disabled: tab.step > maxStepUnlocked,
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
          onSelect: () => setAppMode('caseSetup')
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
    caseDocuments.length,
    handleCaseTabNavigate,
    handleGoHome,
    maxStepUnlocked,
    pendingReviewCount,
    reportStale
  ]);
  const shellActiveNavigationId =
    appMode === 'inspection'
      ? activeCaseTabId || 'overview'
      : appMode === 'caseSetup'
        ? 'case-setup'
        : 'dashboard';
  const shellNavigationCaption =
    appMode === 'inspection'
      ? `${currentCaseMeta.practiceName || 'Inspection case'}${currentCaseMeta.caseId ? ` · ${currentCaseMeta.caseId}` : ''}`
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
        showHeaderContext
        showHeaderContextChevron={false}
        compactHeader={false}
        showNavigationMenu
        navigationCaption={shellNavigationCaption}
        navigationItems={shellNavigationItems}
        activeNavigationId={shellActiveNavigationId}
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
        showHeaderContext
        showHeaderContextChevron={false}
        compactHeader={false}
        showNavigationMenu
        navigationCaption={shellNavigationCaption}
        navigationItems={shellNavigationItems}
        activeNavigationId={shellActiveNavigationId}
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
        showHeaderContext={shellShowHeaderContext}
        showHeaderContextChevron={shellShowHeaderContextChevron}
        compactHeader={shellCompactHeader}
        showNavigationMenu
        navigationCaption={shellNavigationCaption}
        navigationItems={shellNavigationItems}
        activeNavigationId={shellActiveNavigationId}
        afterMain={
          <>
            <UndoToast undoDecision={undoDecision} onUndo={handleUndoDecision} />
            {renderFeedbackControls()}
          <ReggiePanel
            isOpen={reggieOpen}
            onClose={() => setReggieOpen(false)}
            reggieScope={reggieScope}
            suggestions={REGGIE_SUGGESTIONS}
            reggieMessages={reggieMessages}
            onQuickPrompt={handleQuickReggiePrompt}
            filteredCrossDocResults={filteredCrossDocResults}
            documentsById={documentsById}
            safeText={safeText}
            safeSourceField={safeSourceField}
            onJumpToEvidence={(finding) => {
              handleViewDocument(finding.documentId, finding.boxId, finding.id);
              setReggieOpen(false);
              setDocumentWorkspaceTab('findings');
            }}
            onAddAsFinding={(finding) => {
              setReggieOpen(false);
              openComposerModal('manual');
              setComposerModal((prev) => ({
                ...prev,
                open: true,
                type: 'manual',
                text: safeText(finding.detail, safeText(finding.title, '')),
                evidenceType: 'document',
                evidenceNote: safeText(finding.source?.text, safeText(finding.detail, ''))
              }));
            }}
            reggieInput={reggieInput}
            setReggieInput={setReggieInput}
            onSend={handleSendReggie}
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
              setAnalysisProgress(8);
              setAnalysisRunning(true);
              setCurrentStep(STEP_PROCESSING);
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
        {isWorkspaceLoading ? (
          <div className="alert alert-warning small">Syncing case data from data provider...</div>
        ) : null}
        {!isWorkspaceLoading && appMode === 'inspection' && !isActiveCasePersisted ? (
          <div className="alert alert-warning small">
            Read-only demo mode: this case is not persisted in Firestore yet.
          </div>
        ) : null}
        {renderCaseHeader()}
        {renderStepContent()}
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
