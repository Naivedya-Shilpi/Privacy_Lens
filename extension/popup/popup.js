/**
 * PrivacyLens — Popup UI Controller (Phase 6: Persistent Local Results & History)
 *
 * Connects the Chrome Manifest V3 popup to:
 * 1. `content/extractor.js` for on-demand DOM privacy policy extraction.
 * 2. `popup/storage-manager.js` (`chrome.storage.local`) for website-keyed persistent
 *    results, automatic popup restoration, and 20-entry local analysis history.
 * 3. `GET http://localhost:3000/api/health` for server & local Ollama readiness checks.
 * 4. `POST http://localhost:3000/api/analyze` for V1, V2, and V3 analysis (Ollama default).
 * 5. `background/service-worker.js` for interrupted-request state tracking.
 *
 * Security & Privacy Guarantees:
 * - Zero API keys in frontend code.
 * - Zero automatic cloud fallback from Ollama to Gemini.
 * - Zero unsafe `innerHTML` rendering; all dynamic content uses `createElement` + `textContent`.
 * - Restoring saved results never triggers an AI request.
 */

const API_BASE_URL = 'http://localhost:3000';
const HEALTH_ENDPOINT = `${API_BASE_URL}/api/health`;
const ANALYZE_ENDPOINT = `${API_BASE_URL}/api/analyze`;

const MIN_POLICY_CHARS = 40;
const MAX_POLICY_CHARS = 60000;
const CLIENT_TIMEOUT_MS = 240000; // 4 minutes to match backend multi-stage socket timeout

const storage =
  typeof window !== 'undefined' && window.PrivacyLensStorage
    ? window.PrivacyLensStorage
    : require('./storage-manager');

// DOM Elements — Header & Page Card
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const pageTitleEl = document.getElementById('page-title');
const pageDomainEl = document.getElementById('page-domain');
const extractionBadgeEl = document.getElementById('extraction-badge');
const extractionDetailEl = document.getElementById('extraction-detail');

// DOM Elements — Provider & Version Selector & Controls
const providerSelect = document.getElementById('provider-select');
const activeProviderPill = document.getElementById('active-provider-pill');
const privacyModeNote = document.getElementById('privacy-mode-note');
const versionRadios = document.querySelectorAll('input[name="promptVersion"]');
const versionLabels = document.querySelectorAll('.version-option');
const analyzeBtn = document.getElementById('analyze-btn');
const analyzeBtnLabel = document.getElementById('analyze-btn-label');
const toggleManualBtn = document.getElementById('toggle-manual-btn');
const toggleManualLabel = document.getElementById('toggle-manual-label');
const toggleHistoryBtn = document.getElementById('toggle-history-btn');
const toggleHistoryLabel = document.getElementById('toggle-history-label');
const resetBtn = document.getElementById('reset-btn');

// DOM Elements — Manual Input Panel
const manualPanel = document.getElementById('manual-panel');
const manualTextarea = document.getElementById('manual-policy-input');
const manualCharCount = document.getElementById('manual-char-count');
const analyzeManualBtn = document.getElementById('analyze-manual-btn');
const clearManualBtn = document.getElementById('clear-manual-btn');

// DOM Elements — Local Analysis History Panel
const historyPanel = document.getElementById('history-panel');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const clearConfirmBar = document.getElementById('clear-confirm-bar');
const confirmClearBtn = document.getElementById('confirm-clear-btn');
const cancelClearBtn = document.getElementById('cancel-clear-btn');
const historyEmptyMsg = document.getElementById('history-empty-msg');
const historyListEl = document.getElementById('history-list');

// DOM Elements — Feedback & Results
const feedbackPanel = document.getElementById('feedback-panel');
const loadingSpinner = document.getElementById('loading-spinner');
const feedbackTitle = document.getElementById('feedback-title');
const elapsedTimerEl = document.getElementById('elapsed-timer');
const feedbackMessage = document.getElementById('feedback-message');
const stageTimelineEl = document.getElementById('stage-timeline');
const feedbackDetails = document.getElementById('feedback-details');
const resultsContainer = document.getElementById('results-container');

// Runtime State
let isAnalyzing = false;
let elapsedInterval = null;
let cachedExtraction = null;
let currentTabUrl = '';
let activeRenderedEntry = null;

/**
 * Helper to create a DOM element with optional className and textContent safely.
 */
function createEl(tag, className = '', text = null) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== null && text !== undefined) {
    el.textContent = String(text);
  }
  return el;
}

/**
 * Formats an ISO timestamp string into a concise, human-readable local date/time.
 */
function formatTimestamp(isoString) {
  if (!isoString) {
    return 'Unknown time';
  }
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) {
      return String(isoString);
    }
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (_err) {
    return String(isoString);
  }
}

/**
 * Updates runtime session state in `chrome.storage.local` and notifies the service worker.
 */
async function updateRuntimeSessionState(status, promptVersion = null, pageMetadata = {}) {
  const patch = {
    status,
    promptVersion,
    provider: getSelectedProvider(),
    pageTitle: pageMetadata.title || null,
    pageUrl: pageMetadata.url || currentTabUrl || null
  };

  await storage.setRuntimeState(patch);

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SET_ANALYSIS_STATE',
        ...patch
      });
    }
  } catch (_err) {
    // Ignore outside extension context
  }
}

/**
 * Checks whether a previous popup session was closed while an analysis request was in flight.
 * Resets the stale `in_progress` marker and returns an interruption descriptor if detected.
 *
 * @returns {Promise<Object|null>}
 */
async function detectAndClearInterruptedSession() {
  const state = await storage.getRuntimeState();
  if (state && state.status === 'in_progress') {
    await updateRuntimeSessionState('idle');
    return state;
  }
  return null;
}

/**
 * Updates the header connection status indicator.
 */
function setConnectionState(state, label) {
  statusPill.className = `status-pill status-${state}`;
  statusText.textContent = label;
}

/**
 * Updates the Page Information card badge and description.
 */
function setExtractionStatus(badgeText, badgeStyle, detailText) {
  extractionBadgeEl.className = `pill-badge pill-${badgeStyle}`;
  extractionBadgeEl.textContent = badgeText;
  extractionDetailEl.textContent = detailText;
}

/**
 * Updates the status / feedback panel.
 * @param {string} title
 * @param {string} message
 * @param {'info' | 'success' | 'warning' | 'error'} [tone='info']
 * @param {string|null} [details=null]
 */
function setFeedback(title, message, tone = 'info', details = null) {
  feedbackPanel.className = 'card feedback-card';
  if (tone === 'error') {
    feedbackPanel.classList.add('feedback-error');
  } else if (tone === 'warning') {
    feedbackPanel.classList.add('feedback-warning');
  } else if (tone === 'success') {
    feedbackPanel.classList.add('feedback-success');
  }

  feedbackTitle.textContent = title;
  feedbackMessage.textContent = message;

  if (details) {
    feedbackDetails.textContent = details;
    feedbackDetails.classList.remove('hidden');
  } else {
    feedbackDetails.textContent = '';
    feedbackDetails.classList.add('hidden');
  }
}

/**
 * Starts or stops the loading spinner and elapsed seconds counter.
 */
function setLoadingState(active) {
  isAnalyzing = active;
  analyzeBtn.disabled =
    active || !cachedExtraction || cachedExtraction.extractorStatus !== 'success';
  analyzeManualBtn.disabled = active;
  resetBtn.disabled = active;
  toggleManualBtn.disabled = active;
  if (toggleHistoryBtn) {
    toggleHistoryBtn.disabled = active;
  }
  clearManualBtn.disabled = active;
  if (providerSelect) {
    providerSelect.disabled = active;
  }
  for (const radio of versionRadios) {
    radio.disabled = active;
  }

  if (active) {
    loadingSpinner.classList.remove('hidden');
    elapsedTimerEl.classList.remove('hidden');
    stageTimelineEl.classList.add('hidden');
    stageTimelineEl.textContent = '';
    const started = Date.now();
    elapsedTimerEl.textContent = '0s';
    if (elapsedInterval) {
      clearInterval(elapsedInterval);
    }
    elapsedInterval = setInterval(() => {
      const secs = Math.floor((Date.now() - started) / 1000);
      elapsedTimerEl.textContent = `${secs}s`;
    }, 1000);
  } else {
    loadingSpinner.classList.add('hidden');
    if (elapsedInterval) {
      clearInterval(elapsedInterval);
      elapsedInterval = null;
    }
  }
}

/**
 * Returns the currently selected AI provider ('ollama' | 'gemini').
 * Defaults strictly to 'ollama' (Local-First architecture).
 */
function getSelectedProvider() {
  if (providerSelect && providerSelect.value) {
    return providerSelect.value.trim().toLowerCase();
  }
  return 'ollama';
}

/**
 * Sets the selected prompt version radio button in the UI.
 */
function setSelectedPromptVersionUI(versionStr) {
  const normalized = (versionStr || 'v3').toLowerCase();
  for (const radio of versionRadios) {
    radio.checked = radio.value === normalized;
  }
  for (const label of versionLabels) {
    const input = label.querySelector('input[type="radio"]');
    if (input && input.checked) {
      label.classList.add('version-option-selected');
    } else {
      label.classList.remove('version-option-selected');
    }
  }
}

/**
 * Updates the provider badge and privacy mode notice when the user changes provider selection.
 */
function updateProviderBannerUI() {
  const selected = getSelectedProvider();
  if (!activeProviderPill || !privacyModeNote) {
    return;
  }

  if (selected === 'gemini') {
    activeProviderPill.className = 'provider-pill';
    activeProviderPill.textContent = 'Cloud AI: Gemini 2.5 Flash';
    privacyModeNote.className = 'privacy-mode-note privacy-mode-cloud';
    privacyModeNote.textContent =
      "Manual Cloud Fallback Selected: Policy text will be sent to Google's Gemini API because you explicitly selected Gemini.";
  } else {
    activeProviderPill.className = 'provider-pill provider-pill-local';
    activeProviderPill.textContent = 'Local AI: Ollama • Qwen2.5 3B';
    privacyModeNote.className = 'privacy-mode-note';
    privacyModeNote.textContent =
      'Local-First Mode: Policy text is processed entirely on your computer via Ollama (Qwen2.5 3B) and is never sent to any external server.';
  }
}

/**
 * Returns the currently selected prompt version ('v1' | 'v2' | 'v3').
 */
function getSelectedPromptVersion() {
  for (const radio of versionRadios) {
    if (radio.checked) {
      return radio.value;
    }
  }
  return 'v3';
}

/**
 * Renders the backend-verified stage breakdown timeline after completion or restoration.
 */
function renderCompletedStagesTimeline(stages = []) {
  stageTimelineEl.textContent = '';
  if (!Array.isArray(stages) || stages.length === 0) {
    stageTimelineEl.classList.add('hidden');
    return;
  }

  const friendlyLabels = {
    v1_single_pass_baseline: 'Single-Pass Baseline + Post-Hoc Normalizer',
    stage1_clause_extraction: 'Stage 1: Extracting policy clauses',
    stage2_structured_analysis: 'Stage 2: Analyzing privacy implications',
    stage3_plain_language_synthesis: 'Stage 3: Preparing plain-language explanation',
    stage4_independent_verification: 'Stage 4: Verifying claims against source policy'
  };

  for (const st of stages) {
    const li = createEl('li');
    const labelSpan = createEl(
      'span',
      '',
      `✓ ${friendlyLabels[st.stageName] || st.stageName}`
    );
    const durSec =
      typeof st.durationMs === 'number' ? `${(st.durationMs / 1000).toFixed(1)}s` : '';
    const durSpan = createEl('span', 'stage-duration', durSec);
    li.appendChild(labelSpan);
    li.appendChild(durSpan);
    stageTimelineEl.appendChild(li);
  }

  stageTimelineEl.classList.remove('hidden');
}

/**
 * Checks `GET http://localhost:3000/api/health`.
 */
async function checkServerConnection() {
  setConnectionState('checking', 'Checking...');
  try {
    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const selectedProvider = getSelectedProvider();
    const pConfig = data.providersConfigured || {};

    if (selectedProvider === 'ollama') {
      if (pConfig.ollamaReachable === false) {
        setConnectionState('offline', 'Ollama Offline');
      } else if (pConfig.ollamaModelInstalled === false) {
        setConnectionState('offline', 'Model Missing');
      } else {
        setConnectionState('online', 'Connected (Local)');
      }
    } else {
      const geminiReady = Boolean(pConfig.geminiConfigured);
      setConnectionState('online', geminiReady ? 'Connected (Cloud)' : 'No Gemini Key');
    }
    return true;
  } catch (_error) {
    setConnectionState('offline', 'Offline');
    return false;
  }
}

/**
 * Inspects the active browser tab and runs `content/extractor.js` to extract policy text.
 */
async function inspectAndExtractActiveTab() {
  cachedExtraction = null;
  currentTabUrl = '';
  analyzeBtn.disabled = true;

  try {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
      pageTitleEl.textContent = 'Manual / Standalone Mode';
      pageDomainEl.textContent = 'localhost';
      setExtractionStatus(
        'Manual Mode',
        'neutral',
        'Browser tab API unavailable in standalone view. Use Manual Paste below.'
      );
      openManualPanel(true);
      return null;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      pageTitleEl.textContent = 'No Active Tab Found';
      pageDomainEl.textContent = '—';
      setExtractionStatus(
        'No Active Tab',
        'warning',
        'Could not detect an active browser tab. Use Manual Paste or Local History below.'
      );
      openManualPanel(true);
      return null;
    }

    const rawUrl = tab.url || '';
    currentTabUrl = rawUrl;
    pageTitleEl.textContent = tab.title || 'Untitled Webpage';

    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      pageDomainEl.textContent = rawUrl ? rawUrl.split('/')[0] : 'Restricted Chrome Page';
      setExtractionStatus(
        'Restricted Page',
        'warning',
        'Chrome restricts content scripts on browser/internal pages (e.g., chrome:// or Web Store). Open a standard http:// or https:// privacy policy page, or use Manual Paste / History below.'
      );
      openManualPanel(true);
      return null;
    }

    let parsedDomain = 'webpage';
    try {
      parsedDomain = new URL(rawUrl).hostname;
    } catch (_e) {
      parsedDomain = rawUrl;
    }
    pageDomainEl.textContent = parsedDomain;

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/extractor.js']
    });

    const result = injectionResults && injectionResults[0] ? injectionResults[0].result : null;

    if (!result) {
      setExtractionStatus(
        'Extraction Failed',
        'danger',
        'Could not extract readable text from this tab. Please use Manual Paste below.'
      );
      openManualPanel(true);
      return null;
    }

    cachedExtraction = result;
    currentTabUrl = result.pageUrl || rawUrl;
    pageTitleEl.textContent = result.pageTitle || tab.title || 'Untitled Webpage';
    pageDomainEl.textContent = result.domain || parsedDomain;

    if (result.extractorStatus === 'success') {
      const charLabel = `${result.characterCount.toLocaleString()} chars`;
      setExtractionStatus(
        result.wasTruncated ? `Extracted (${charLabel}, truncated)` : `Extracted (${charLabel})`,
        'success',
        result.message
      );
      analyzeBtn.disabled = isAnalyzing;
      return result;
    }

    // Insufficient text or empty body
    setExtractionStatus(
      `Insufficient Text (${result.characterCount || 0} chars)`,
      'warning',
      result.message || 'Not enough policy text on this page. Use Manual Paste below.'
    );
    openManualPanel(true);
    return result;
  } catch (err) {
    setExtractionStatus(
      'Tab Access Restricted',
      'warning',
      `Cannot run content script on this page (${err.message || 'restricted tab'}). Use Manual Paste below.`
    );
    openManualPanel(true);
    return null;
  }
}

/**
 * Opens or closes the Manual Policy Input panel.
 */
function openManualPanel(forceOpen = null) {
  const isCurrentlyHidden = manualPanel.classList.contains('hidden');
  const shouldOpen = forceOpen !== null ? forceOpen : isCurrentlyHidden;

  if (shouldOpen) {
    manualPanel.classList.remove('hidden');
    toggleManualBtn.setAttribute('aria-expanded', 'true');
    toggleManualLabel.textContent = 'Hide Manual Paste';
  } else {
    manualPanel.classList.add('hidden');
    toggleManualBtn.setAttribute('aria-expanded', 'false');
    toggleManualLabel.textContent = 'Manual Paste';
  }
}

/**
 * Opens or closes the Local Analysis History panel.
 */
function openHistoryPanel(forceOpen = null) {
  if (!historyPanel || !toggleHistoryBtn) {
    return;
  }
  const isCurrentlyHidden = historyPanel.classList.contains('hidden');
  const shouldOpen = forceOpen !== null ? forceOpen : isCurrentlyHidden;

  if (shouldOpen) {
    historyPanel.classList.remove('hidden');
    toggleHistoryBtn.setAttribute('aria-expanded', 'true');
    if (clearConfirmBar) {
      clearConfirmBar.classList.add('hidden');
    }
  } else {
    historyPanel.classList.add('hidden');
    toggleHistoryBtn.setAttribute('aria-expanded', 'false');
    if (clearConfirmBar) {
      clearConfirmBar.classList.add('hidden');
    }
  }
}

/**
 * Updates the live character counter and validation indicator for the manual textarea.
 */
function updateManualCharCount() {
  const rawVal = manualTextarea.value || '';
  const trimmedLen = rawVal.trim().length;
  const rawLen = rawVal.length;

  manualCharCount.textContent = `${rawLen.toLocaleString()} / ${MAX_POLICY_CHARS.toLocaleString()} chars (min ${MIN_POLICY_CHARS})`;

  if (rawLen === 0) {
    manualCharCount.className = 'char-counter';
  } else if (trimmedLen < MIN_POLICY_CHARS || rawLen > MAX_POLICY_CHARS) {
    manualCharCount.className = 'char-counter counter-invalid';
  } else {
    manualCharCount.className = 'char-counter counter-valid';
  }
}

/**
 * Helper to create a verbatim supporting excerpt box safely.
 */
function createExcerptElement(excerptText) {
  if (!excerptText || typeof excerptText !== 'string') {
    return null;
  }
  const box = createEl('blockquote', 'excerpt-box');
  const label = createEl('span', 'excerpt-label', 'Supporting Policy Excerpt');
  const quote = createEl('span', '', `"${excerptText}"`);
  box.appendChild(label);
  box.appendChild(quote);
  return box;
}

/**
 * Helper to create a status pill badge (`Specified` vs `Not specified`).
 */
function createStatusBadge(statusText) {
  const isSpecified = statusText === 'Specified';
  return createEl(
    'span',
    `pill-badge ${isSpecified ? 'pill-success' : 'pill-warning'}`,
    statusText || 'Not specified'
  );
}

/**
 * Renders the complete validated `PrivacyLensUnifiedAnalysis` object into `#results-container`.
 * Uses ONLY safe DOM creation (`createElement` + `textContent`).
 *
 * @param {Object} responseData - Live response data or saved history entry
 * @param {Object} [renderOptions={}]
 * @param {boolean} [renderOptions.isRestored=false] - Whether this is a restored historical result
 * @param {boolean} [renderOptions.isFromHistorySelection=false] - Whether selected from History list
 */
function renderAnalysisResults(responseData, renderOptions = {}) {
  resultsContainer.textContent = '';

  const analysis = responseData && responseData.analysis ? responseData.analysis : null;
  if (!analysis || typeof analysis !== 'object') {
    activeRenderedEntry = null;
    resultsContainer.classList.add('hidden');
    return;
  }

  activeRenderedEntry = responseData;
  const { isRestored = false, isFromHistorySelection = false } = renderOptions;

  const version = (responseData.promptVersion || analysis.promptVersion || 'v3').toUpperCase();
  const verAudit = analysis.verificationAudit || {};
  const verStatus =
    responseData.verificationStatus || verAudit.verificationStatus || 'unverified_baseline';
  const isVerified = Boolean(
    responseData.verified === true && verStatus === 'verified_by_stage4'
  );

  // ---------------------------------------------------------------------------
  // 1. Verification Status & Provenance Banner
  // ---------------------------------------------------------------------------
  let bannerClass = 'banner-baseline';
  let badgeClass = 'badge-baseline';
  let statusLabel = 'V1: Unverified Baseline';

  if (isVerified) {
    bannerClass = 'banner-verified';
    badgeClass = 'badge-verified';
    statusLabel = 'V3: Verified by Stage 4';
  } else if (verStatus === 'unverified_candidate' || version === 'V2') {
    bannerClass = 'banner-candidate';
    badgeClass = 'badge-candidate';
    statusLabel = 'V2: Unverified Candidate';
  }

  const banner = createEl('section', `verification-banner ${bannerClass}`);
  const bannerTop = createEl('div', 'banner-top-row');
  const badgeEl = createEl('span', `verification-status-badge ${badgeClass}`, statusLabel);
  const versionMetaEl = createEl(
    'span',
    'banner-meta-line',
    `Prompt ${version} • ${responseData.stageCount || 1} Call(s) • ${(
      (responseData.durationMs || 0) / 1000
    ).toFixed(1)}s`
  );
  bannerTop.appendChild(badgeEl);
  bannerTop.appendChild(versionMetaEl);
  banner.appendChild(bannerTop);

  const providerName = (responseData.provider || 'ollama').toLowerCase();
  const rawModelName =
    responseData.model || (providerName === 'ollama' ? 'qwen2.5:3b' : 'gemini-2.5-flash');
  const providerDisplay =
    providerName === 'ollama'
      ? `Local AI: Ollama • Model: Qwen2.5 3B (${rawModelName})`
      : `Cloud Fallback: Google Gemini • Model: ${rawModelName}`;

  const modelMetaLine = createEl(
    'div',
    'banner-meta-line',
    `${providerDisplay} • Total Tokens: ${
      responseData.tokenUsage && typeof responseData.tokenUsage.totalTokens === 'number'
        ? responseData.tokenUsage.totalTokens.toLocaleString()
        : 'N/A'
    }${
      typeof verAudit.unsupportedClaimsRemoved === 'number' && isVerified
        ? ` • Unsupported Claims Removed: ${verAudit.unsupportedClaimsRemoved}`
        : ''
    }`
  );
  banner.appendChild(modelMetaLine);

  // Display associated website title, URL, and saved timestamp (especially for restored results)
  const associatedTitle =
    responseData.pageTitle ||
    (responseData.pageMetadata && responseData.pageMetadata.title) ||
    'Privacy Policy';
  const associatedUrl =
    responseData.pageUrl ||
    (responseData.pageMetadata && responseData.pageMetadata.url) ||
    '';
  const savedTimeText = responseData.savedAt ? formatTimestamp(responseData.savedAt) : 'Just now';

  const sourceBox = createEl('div', 'restored-source-box');
  const provenanceLabel = isRestored
    ? isFromHistorySelection
      ? `Previously Completed Analysis (Selected from Local History • Saved ${savedTimeText})`
      : `Previously Completed Analysis (Restored Automatically • Saved ${savedTimeText})`
    : `Completed & Saved Locally (${savedTimeText})`;
  sourceBox.appendChild(createEl('strong', '', provenanceLabel));
  sourceBox.appendChild(
    createEl(
      'span',
      '',
      `Website: ${associatedTitle}${associatedUrl ? ` (${associatedUrl})` : ''}`
    )
  );
  banner.appendChild(sourceBox);

  if (Array.isArray(verAudit.auditNotes) && verAudit.auditNotes.length > 0) {
    const notesList = createEl('ul', 'audit-notes-list');
    for (const note of verAudit.auditNotes) {
      notesList.appendChild(createEl('li', '', note));
    }
    banner.appendChild(notesList);
  }

  resultsContainer.appendChild(banner);

  // ---------------------------------------------------------------------------
  // 2. Plain-Language Summary Section
  // ---------------------------------------------------------------------------
  if (analysis.summary) {
    const sumCard = createEl('section', 'result-section-card');
    const sumHeader = createEl('div', 'result-section-header');
    sumHeader.appendChild(createEl('h3', 'result-section-title', '1. Plain-Language Summary'));
    sumHeader.appendChild(createEl('span', 'pill-badge pill-neutral', `Prompt ${version}`));
    sumCard.appendChild(sumHeader);

    if (analysis.summary.overview) {
      sumCard.appendChild(createEl('p', 'summary-overview', analysis.summary.overview));
    }

    if (Array.isArray(analysis.summary.keyTakeaways) && analysis.summary.keyTakeaways.length > 0) {
      const ul = createEl('ul', 'takeaways-list');
      for (const point of analysis.summary.keyTakeaways) {
        ul.appendChild(createEl('li', '', point));
      }
      sumCard.appendChild(ul);
    }

    // If V1 rawText is present, allow inspecting the original unedited V1 bullets
    if (typeof responseData.rawText === 'string' && responseData.rawText.trim().length > 0) {
      const detailsEl = createEl('details', 'raw-v1-details');
      detailsEl.appendChild(
        createEl('summary', '', 'View Original Prompt V1 Raw Bullet Response')
      );
      detailsEl.appendChild(createEl('pre', 'raw-v1-pre', responseData.rawText));
      sumCard.appendChild(detailsEl);
    }

    resultsContainer.appendChild(sumCard);
  }

  // ---------------------------------------------------------------------------
  // 3. Data Categories Collected (`dataCollection`)
  // ---------------------------------------------------------------------------
  if (analysis.dataCollection) {
    const dcCard = createEl('section', 'result-section-card');
    const dcHeader = createEl('div', 'result-section-header');
    dcHeader.appendChild(createEl('h3', 'result-section-title', '2. Data Categories Collected'));
    dcHeader.appendChild(createStatusBadge(analysis.dataCollection.status));
    dcCard.appendChild(dcHeader);

    const items = Array.isArray(analysis.dataCollection.items) ? analysis.dataCollection.items : [];
    if (items.length === 0) {
      dcCard.appendChild(
        createEl(
          'p',
          'finding-field',
          'No specific data collection categories are specified in the provided policy text.'
        )
      );
    } else {
      for (const item of items) {
        const box = createEl('div', 'finding-item');
        const topRow = createEl('div', 'finding-item-header');
        topRow.appendChild(createEl('span', 'finding-title', item.category || 'Collected Data'));
        if (item.clauseId) {
          topRow.appendChild(createEl('span', 'clause-id-tag', item.clauseId));
        }
        box.appendChild(topRow);

        if (Array.isArray(item.dataTypes) && item.dataTypes.length > 0) {
          const chipsWrap = createEl('div', 'data-types-wrap');
          for (const dt of item.dataTypes) {
            chipsWrap.appendChild(createEl('span', 'data-type-chip', dt));
          }
          box.appendChild(chipsWrap);
        }

        if (item.purpose) {
          const pField = createEl('p', 'finding-field');
          pField.appendChild(createEl('span', 'finding-field-label', 'Stated Purpose: '));
          pField.appendChild(document.createTextNode(item.purpose));
          box.appendChild(pField);
        }

        const excerptEl = createExcerptElement(item.supportingExcerpt);
        if (excerptEl) {
          box.appendChild(excerptEl);
        }
        dcCard.appendChild(box);
      }
    }
    resultsContainer.appendChild(dcCard);
  }

  // ---------------------------------------------------------------------------
  // 4. Purposes of Data Processing (`dataUsage`)
  // ---------------------------------------------------------------------------
  if (analysis.dataUsage) {
    const duCard = createEl('section', 'result-section-card');
    const duHeader = createEl('div', 'result-section-header');
    duHeader.appendChild(createEl('h3', 'result-section-title', '3. Purposes of Data Processing'));
    duHeader.appendChild(createStatusBadge(analysis.dataUsage.status));
    duCard.appendChild(duHeader);

    const purposes = Array.isArray(analysis.dataUsage.purposes) ? analysis.dataUsage.purposes : [];
    if (purposes.length === 0) {
      duCard.appendChild(
        createEl(
          'p',
          'finding-field',
          'No specific data usage purposes are specified in the provided policy text.'
        )
      );
    } else {
      for (const pItem of purposes) {
        const box = createEl('div', 'finding-item');
        const topRow = createEl('div', 'finding-item-header');
        topRow.appendChild(createEl('span', 'finding-title', pItem.purpose || 'Data Usage'));
        if (pItem.clauseId) {
          topRow.appendChild(createEl('span', 'clause-id-tag', pItem.clauseId));
        }
        box.appendChild(topRow);

        if (pItem.plainExplanation) {
          box.appendChild(createEl('p', 'finding-field', pItem.plainExplanation));
        }

        const excerptEl = createExcerptElement(pItem.supportingExcerpt);
        if (excerptEl) {
          box.appendChild(excerptEl);
        }
        duCard.appendChild(box);
      }
    }
    resultsContainer.appendChild(duCard);
  }

  // ---------------------------------------------------------------------------
  // 5. Sharing & Third-Party Disclosures (`thirdPartySharing`)
  // ---------------------------------------------------------------------------
  if (analysis.thirdPartySharing) {
    const tpCard = createEl('section', 'result-section-card');
    const tpHeader = createEl('div', 'result-section-header');
    tpHeader.appendChild(
      createEl('h3', 'result-section-title', '4. Sharing & Third-Party Disclosures')
    );
    tpHeader.appendChild(createStatusBadge(analysis.thirdPartySharing.status));
    tpCard.appendChild(tpHeader);

    const disclosures = Array.isArray(analysis.thirdPartySharing.disclosures)
      ? analysis.thirdPartySharing.disclosures
      : [];

    if (disclosures.length === 0) {
      tpCard.appendChild(
        createEl(
          'p',
          'finding-field',
          'Third-party data sharing is not specified in the provided policy text.'
        )
      );
    } else {
      for (const dItem of disclosures) {
        const box = createEl('div', 'finding-item');
        const topRow = createEl('div', 'finding-item-header');
        topRow.appendChild(
          createEl('span', 'finding-title', dItem.recipientCategory || 'Third-Party Recipient')
        );
        if (dItem.clauseId) {
          topRow.appendChild(createEl('span', 'clause-id-tag', dItem.clauseId));
        }
        box.appendChild(topRow);

        if (dItem.sharedData) {
          const sd = createEl('p', 'finding-field');
          sd.appendChild(createEl('span', 'finding-field-label', 'Shared Data: '));
          sd.appendChild(document.createTextNode(dItem.sharedData));
          box.appendChild(sd);
        }

        if (dItem.purpose) {
          const sp = createEl('p', 'finding-field');
          sp.appendChild(createEl('span', 'finding-field-label', 'Stated Purpose: '));
          sp.appendChild(document.createTextNode(dItem.purpose));
          box.appendChild(sp);
        }

        if (dItem.plainExplanation) {
          box.appendChild(createEl('p', 'finding-field', dItem.plainExplanation));
        }

        const excerptEl = createExcerptElement(dItem.supportingExcerpt);
        if (excerptEl) {
          box.appendChild(excerptEl);
        }
        tpCard.appendChild(box);
      }
    }
    resultsContainer.appendChild(tpCard);
  }

  // ---------------------------------------------------------------------------
  // 6. User Rights, Controls & Data Retention (`userRightsAndRetention`)
  // ---------------------------------------------------------------------------
  if (analysis.userRightsAndRetention) {
    const ur = analysis.userRightsAndRetention;
    const urCard = createEl('section', 'result-section-card');
    const urHeader = createEl('div', 'result-section-header');
    urHeader.appendChild(
      createEl('h3', 'result-section-title', '5. User Rights, Retention & Deletion')
    );
    urHeader.appendChild(createStatusBadge(ur.userRightsStatus));
    urCard.appendChild(urHeader);

    // Data Retention Summary Box
    const retBox = createEl('div', 'finding-item');
    const retHeader = createEl('div', 'finding-item-header');
    retHeader.appendChild(createEl('span', 'finding-title', 'Data Retention Period'));
    retHeader.appendChild(createStatusBadge(ur.dataRetentionStatus));
    retBox.appendChild(retHeader);
    retBox.appendChild(
      createEl(
        'p',
        'finding-field',
        ur.retentionSummary && ur.retentionSummary !== 'Not specified'
          ? ur.retentionSummary
          : 'Not specified in the provided policy text.'
      )
    );
    urCard.appendChild(retBox);

    const rights = Array.isArray(ur.rights) ? ur.rights : [];
    for (const rItem of rights) {
      const box = createEl('div', 'finding-item');
      const topRow = createEl('div', 'finding-item-header');
      topRow.appendChild(createEl('span', 'finding-title', rItem.right || 'User Right'));
      if (rItem.clauseId) {
        topRow.appendChild(createEl('span', 'clause-id-tag', rItem.clauseId));
      }
      box.appendChild(topRow);

      if (rItem.howToExercise) {
        const howEl = createEl('p', 'finding-field');
        howEl.appendChild(createEl('span', 'finding-field-label', 'How to Exercise: '));
        howEl.appendChild(document.createTextNode(rItem.howToExercise));
        box.appendChild(howEl);
      }

      if (rItem.limitations) {
        const limEl = createEl('p', 'finding-field');
        limEl.appendChild(createEl('span', 'finding-field-label', 'Stated Limitations: '));
        limEl.appendChild(document.createTextNode(rItem.limitations));
        box.appendChild(limEl);
      }

      if (rItem.plainExplanation) {
        box.appendChild(createEl('p', 'finding-field', rItem.plainExplanation));
      }

      const excerptEl = createExcerptElement(rItem.supportingExcerpt);
      if (excerptEl) {
        box.appendChild(excerptEl);
      }
      urCard.appendChild(box);
    }

    resultsContainer.appendChild(urCard);
  }

  // ---------------------------------------------------------------------------
  // 7. Potentially Concerning or Notable Clauses (`concerningOrUnclearClauses`)
  // ---------------------------------------------------------------------------
  if (Array.isArray(analysis.concerningOrUnclearClauses)) {
    const ccCard = createEl('section', 'result-section-card');
    const ccHeader = createEl('div', 'result-section-header');
    ccHeader.appendChild(
      createEl('h3', 'result-section-title', '6. Notable or Potentially Concerning Clauses')
    );
    ccHeader.appendChild(
      createEl(
        'span',
        'pill-badge pill-warning',
        `${analysis.concerningOrUnclearClauses.length} Flagged`
      )
    );
    ccCard.appendChild(ccHeader);

    if (analysis.concerningOrUnclearClauses.length === 0) {
      ccCard.appendChild(
        createEl(
          'p',
          'finding-field',
          'No vague, broad, or unusually restrictive clauses were flagged in the provided text.'
        )
      );
    } else {
      for (const cItem of analysis.concerningOrUnclearClauses) {
        const box = createEl('div', 'finding-item');
        const topRow = createEl('div', 'finding-item-header');
        topRow.appendChild(createEl('span', 'finding-title', cItem.topic || 'Notable Clause'));
        if (cItem.clauseId) {
          topRow.appendChild(createEl('span', 'clause-id-tag', cItem.clauseId));
        }
        box.appendChild(topRow);

        const isExplicit = cItem.classification === 'Explicitly Stated Term';
        const classBadge = createEl(
          'span',
          `classification-badge ${isExplicit ? 'class-explicit' : 'class-broad'}`,
          cItem.classification || 'Potentially Concerning / Broad Wording'
        );
        box.appendChild(classBadge);

        if (cItem.plainExplanation) {
          const expP = createEl('p', 'finding-field');
          expP.appendChild(
            createEl('span', 'finding-field-label', 'What the Policy States: ')
          );
          expP.appendChild(document.createTextNode(cItem.plainExplanation));
          box.appendChild(expP);
        }

        if (cItem.whyItMatters) {
          const whyP = createEl('p', 'finding-field');
          whyP.appendChild(
            createEl('span', 'finding-field-label', 'Why It Matters (Conditional Implication): ')
          );
          whyP.appendChild(document.createTextNode(cItem.whyItMatters));
          box.appendChild(whyP);
        }

        const excerptEl = createExcerptElement(cItem.supportingExcerpt);
        if (excerptEl) {
          box.appendChild(excerptEl);
        }
        ccCard.appendChild(box);
      }
    }
    resultsContainer.appendChild(ccCard);
  }

  // ---------------------------------------------------------------------------
  // 8. Missing or Unspecified Information (`missingInformation`)
  // ---------------------------------------------------------------------------
  if (Array.isArray(analysis.missingInformation) && analysis.missingInformation.length > 0) {
    const miCard = createEl('section', 'result-section-card');
    const miHeader = createEl('div', 'result-section-header');
    miHeader.appendChild(
      createEl('h3', 'result-section-title', '7. Missing or Unspecified Information')
    );
    miHeader.appendChild(createEl('span', 'pill-badge pill-neutral', 'Not specified'));
    miCard.appendChild(miHeader);

    for (const mItem of analysis.missingInformation) {
      const box = createEl('div', 'finding-item');
      const topRow = createEl('div', 'finding-item-header');
      topRow.appendChild(createEl('span', 'finding-title', mItem.topic || 'Unspecified Topic'));
      topRow.appendChild(
        createEl('span', 'pill-badge pill-warning', mItem.status || 'Not specified')
      );
      box.appendChild(topRow);

      if (mItem.explanation) {
        box.appendChild(createEl('p', 'finding-field', mItem.explanation));
      }
      miCard.appendChild(box);
    }

    resultsContainer.appendChild(miCard);
  }

  resultsContainer.classList.remove('hidden');
}

/**
 * Refreshes the Local Analysis History list UI from `chrome.storage.local`.
 * Never uses `innerHTML`.
 */
async function refreshHistoryUI() {
  const history = await storage.getAnalysisHistory();
  if (toggleHistoryLabel) {
    toggleHistoryLabel.textContent = `History (${history.length})`;
  }
  if (!historyListEl || !historyEmptyMsg) {
    return history;
  }

  historyListEl.textContent = '';

  if (history.length === 0) {
    historyEmptyMsg.classList.remove('hidden');
    if (clearHistoryBtn) {
      clearHistoryBtn.disabled = true;
    }
    return history;
  }

  historyEmptyMsg.classList.add('hidden');
  if (clearHistoryBtn) {
    clearHistoryBtn.disabled = false;
  }

  const currentUrlKey = currentTabUrl ? storage.normalizeUrlKey(currentTabUrl) : '';

  for (const entry of history) {
    const isCurrentView =
      activeRenderedEntry && activeRenderedEntry.entryId === entry.entryId;
    const isCurrentTabMatch =
      Boolean(currentUrlKey && entry.normalizedUrlKey === currentUrlKey);

    const itemEl = createEl(
      'div',
      `history-item${isCurrentView ? ' history-item-active' : ''}`
    );

    const topRow = createEl('div', 'history-item-top');
    topRow.appendChild(
      createEl('span', 'history-item-title', entry.pageTitle || 'Privacy Policy')
    );

    const vUpper = (entry.promptVersion || 'v3').toUpperCase();
    const tagClass =
      entry.verified
        ? 'tag-verified'
        : vUpper === 'V2'
          ? 'tag-candidate'
          : 'tag-baseline';
    topRow.appendChild(
      createEl(
        'span',
        `version-meta-tag ${tagClass}`,
        `${vUpper} • ${entry.verified ? 'Verified' : vUpper === 'V2' ? 'Candidate' : 'Baseline'}`
      )
    );
    itemEl.appendChild(topRow);

    if (entry.pageUrl) {
      itemEl.appendChild(createEl('div', 'history-item-url', entry.pageUrl));
    }

    const metaRow = createEl('div', 'history-item-meta');
    const provText =
      entry.provider === 'ollama'
        ? `Local AI: Ollama (${entry.model || 'qwen2.5:3b'})`
        : `Gemini (${entry.model || 'gemini-2.5-flash'})`;
    metaRow.appendChild(createEl('span', '', provText));
    metaRow.appendChild(createEl('span', '', `• ${formatTimestamp(entry.savedAt)}`));
    if (isCurrentTabMatch) {
      metaRow.appendChild(createEl('span', 'pill-badge pill-success', 'Current Tab'));
    }
    itemEl.appendChild(metaRow);

    const actionsRow = createEl('div', 'history-item-actions');
    const viewBtn = createEl(
      'button',
      'btn-history-view',
      isCurrentView ? 'Viewing' : 'View Result'
    );
    viewBtn.type = 'button';
    viewBtn.addEventListener('click', () => handleViewHistoryEntry(entry.entryId));

    const delBtn = createEl('button', 'btn-history-delete', 'Delete');
    delBtn.type = 'button';
    delBtn.addEventListener('click', () => handleDeleteHistoryEntry(entry.entryId));

    actionsRow.appendChild(viewBtn);
    actionsRow.appendChild(delBtn);
    itemEl.appendChild(actionsRow);

    historyListEl.appendChild(itemEl);
  }

  return history;
}

/**
 * Loads and displays a selected history entry without calling the AI backend.
 *
 * @param {string} entryId
 */
async function handleViewHistoryEntry(entryId) {
  if (isAnalyzing) {
    return;
  }

  const entry = await storage.getAnalysisById(entryId);
  if (!entry) {
    setFeedback(
      'History Entry Not Found',
      'The selected analysis entry is no longer in local storage.',
      'warning'
    );
    await refreshHistoryUI();
    return;
  }

  setSelectedPromptVersionUI(entry.promptVersion);
  renderCompletedStagesTimeline(entry.stages);
  renderAnalysisResults(entry, { isRestored: true, isFromHistorySelection: true });

  const vUpper = (entry.promptVersion || 'v3').toUpperCase();
  const engineLabel =
    entry.provider === 'ollama'
      ? `Local AI: Ollama (${entry.model || 'qwen2.5:3b'})`
      : `Google Gemini (${entry.model || 'gemini-2.5-flash'})`;

  setFeedback(
    `Restored Saved Analysis (Prompt ${vUpper})`,
    `Showing saved analysis for "${entry.pageTitle}" (${entry.pageUrl || 'local'}) performed on ${formatTimestamp(entry.savedAt)} using ${engineLabel}. No AI request was made.`,
    'info'
  );

  await refreshHistoryUI();
}

/**
 * Deletes an individual history entry by `entryId`.
 *
 * @param {string} entryId
 */
async function handleDeleteHistoryEntry(entryId) {
  if (isAnalyzing) {
    return;
  }

  const wasActive = activeRenderedEntry && activeRenderedEntry.entryId === entryId;
  await storage.deleteHistoryEntry(entryId);

  if (wasActive) {
    activeRenderedEntry = null;
    resultsContainer.textContent = '';
    resultsContainer.classList.add('hidden');
    stageTimelineEl.textContent = '';
    stageTimelineEl.classList.add('hidden');
    setFeedback(
      'Saved Analysis Deleted',
      'The selected analysis was removed from local history.',
      'info'
    );
  }

  await refreshHistoryUI();
}

/**
 * Clears all saved analysis history after user confirmation.
 */
async function handleConfirmClearAllHistory() {
  if (isAnalyzing) {
    return;
  }

  await storage.clearAllHistory();
  activeRenderedEntry = null;
  resultsContainer.textContent = '';
  resultsContainer.classList.add('hidden');
  stageTimelineEl.textContent = '';
  stageTimelineEl.classList.add('hidden');

  if (clearConfirmBar) {
    clearConfirmBar.classList.add('hidden');
  }

  await refreshHistoryUI();
  setFeedback(
    'Local History Cleared',
    'All saved policy analyses have been removed from local storage on this computer.',
    'info'
  );
}

/**
 * Restores the appropriate saved analysis when the popup opens or switches tabs.
 * - If the current tab URL has a previously completed analysis, restores it automatically.
 * - If the current tab is a different, unanalyzed website, does NOT show another website's
 *   result as if it belonged to the current tab.
 * - Never makes any AI request during restoration.
 */
async function restoreContextForCurrentTab(interruptedSession = null) {
  const history = await refreshHistoryUI();
  const matchedEntry = currentTabUrl
    ? await storage.getLatestAnalysisForUrl(currentTabUrl)
    : null;

  if (matchedEntry) {
    setSelectedPromptVersionUI(matchedEntry.promptVersion);
    renderCompletedStagesTimeline(matchedEntry.stages);
    renderAnalysisResults(matchedEntry, { isRestored: true, isFromHistorySelection: false });
    await refreshHistoryUI();

    const vUpper = (matchedEntry.promptVersion || 'v3').toUpperCase();
    const engineLabel =
      matchedEntry.provider === 'ollama'
        ? `Local AI: Ollama (${matchedEntry.model || 'qwen2.5:3b'})`
        : `Google Gemini (${matchedEntry.model || 'gemini-2.5-flash'})`;

    if (interruptedSession) {
      setFeedback(
        'Previous Analysis Interrupted — Restored Last Saved Result',
        `A newer analysis was interrupted when the popup closed. Showing your last completed analysis for "${matchedEntry.pageTitle}" (Prompt ${vUpper} • ${engineLabel} • saved ${formatTimestamp(matchedEntry.savedAt)}).`,
        'warning'
      );
    } else {
      setFeedback(
        `Saved Analysis Restored (Prompt ${vUpper})`,
        `Restored previously completed analysis for "${matchedEntry.pageTitle}" (${engineLabel} • saved ${formatTimestamp(matchedEntry.savedAt)}). Click "Analyze Current Page" to run a fresh analysis.`,
        'success'
      );
    }
    return matchedEntry;
  }

  // Current tab has not been analyzed yet: do not display another website's result
  activeRenderedEntry = null;
  resultsContainer.textContent = '';
  resultsContainer.classList.add('hidden');
  stageTimelineEl.textContent = '';
  stageTimelineEl.classList.add('hidden');

  if (interruptedSession) {
    setFeedback(
      'Previous Analysis Interrupted',
      `The previous analysis request (${(interruptedSession.promptVersion || 'v3').toUpperCase()} on "${interruptedSession.pageTitle || 'webpage'}") was interrupted because the popup closed before completion. Click "Analyze" to start a new run.`,
      'warning'
    );
    return null;
  }

  if (history.length > 0) {
    setFeedback(
      'Ready — No Saved Analysis for This Webpage Yet',
      `This webpage has not been analyzed yet. Click "Analyze Current Page", or open "History (${history.length})" to view saved results from other websites.`,
      'info'
    );
  } else {
    setFeedback(
      'Ready',
      'Select a prompt version (V1, V2, or V3) and click "Analyze Current Page" or "Manual Paste".',
      'info'
    );
  }

  return null;
}

/**
 * Formats an HTTP error response from `/api/analyze` into a user-friendly title and message.
 */
function formatBackendError(httpStatus, errorObj) {
  const code = errorObj && errorObj.code ? errorObj.code : `HTTP_${httpStatus}`;
  const msg =
    errorObj && errorObj.message
      ? errorObj.message
      : `The server returned HTTP ${httpStatus}.`;
  const stageSuffix = errorObj && errorObj.stage ? ` (Failed at ${errorObj.stage})` : '';

  if (code === 'OLLAMA_UNAVAILABLE') {
    return {
      title: `Local Ollama Not Running (${code})`,
      message: `${msg} PrivacyLens did NOT automatically fall back to cloud AI.`
    };
  }
  if (code === 'OLLAMA_MODEL_NOT_FOUND' || httpStatus === 404) {
    return {
      title: `Local Model Not Installed (${code})`,
      message: msg
    };
  }
  if (code === 'CONTEXT_LENGTH_EXCEEDED') {
    return {
      title: `Local Context Window Exceeded (${code})${stageSuffix}`,
      message: msg
    };
  }
  if (httpStatus === 400) {
    return {
      title: `Invalid Request (${code})`,
      message: msg
    };
  }
  if (httpStatus === 413) {
    return {
      title: 'Policy Text Too Large (HTTP 413)',
      message:
        msg ||
        'The submitted text exceeds the maximum allowed payload size. Please submit a shorter policy excerpt.'
    };
  }
  if (httpStatus === 429) {
    return {
      title: 'Rate Limit Reached (HTTP 429)',
      message: msg
    };
  }
  if (httpStatus === 503) {
    return {
      title: `Service Unavailable (${code})`,
      message: msg
    };
  }
  if (httpStatus === 504) {
    return {
      title: `Analysis Timed Out (HTTP 504)${stageSuffix}`,
      message: `${msg} Please wait a few seconds or try a shorter policy excerpt.`
    };
  }
  return {
    title: `Analysis Error (${code})${stageSuffix}`,
    message: msg
  };
}

/**
 * Executes the policy analysis request against `POST http://localhost:3000/api/analyze`.
 * - Preserves previous results in `chrome.storage.local` while a new analysis runs.
 * - If the new analysis fails, retains and re-displays the last successfully completed result.
 *
 * @param {string} policyText
 * @param {{ title: string, url: string, domain?: string }} pageMetadata
 * @param {'extracted' | 'manual'} sourceType
 */
async function executePolicyAnalysis(policyText, pageMetadata, sourceType) {
  if (isAnalyzing) {
    return;
  }

  const trimmed = typeof policyText === 'string' ? policyText.trim() : '';
  if (trimmed.length < MIN_POLICY_CHARS) {
    setFeedback(
      'Insufficient Policy Text',
      `Policy text must be at least ${MIN_POLICY_CHARS} characters long (received ${trimmed.length} characters). Please use a full policy page or paste the complete policy text.`,
      'warning'
    );
    return;
  }

  if (policyText.length > MAX_POLICY_CHARS) {
    setFeedback(
      'Policy Text Exceeds 60,000 Characters',
      `The submitted text is ${policyText.length.toLocaleString()} characters, exceeding the 60,000-character limit. Please trim the text before submitting.`,
      'warning'
    );
    return;
  }

  const previousRenderedBeforeRun = activeRenderedEntry;
  const promptVersion = getSelectedPromptVersion();
  const versionUpper = promptVersion.toUpperCase();
  const selectedProvider = getSelectedProvider();
  const providerBadgeLabel =
    selectedProvider === 'ollama'
      ? 'Local AI: Ollama (Qwen2.5 3B)'
      : 'Cloud Fallback: Gemini 2.5 Flash';

  let progressMsg = `Running Prompt V1 single-pass baseline on ${providerBadgeLabel}...`;
  if (promptVersion === 'v2') {
    progressMsg = `Running Prompt V2 3-stage chained analysis on ${providerBadgeLabel} (Extract → Analyze → Synthesize)...`;
  } else if (promptVersion === 'v3') {
    progressMsg = `Running Prompt V3 4-stage verified analysis on ${providerBadgeLabel} (Stages 1–3 + Stage 4 Verification Pass)...`;
  }

  setLoadingState(true);
  setFeedback(
    `Analyzing with Prompt ${versionUpper} (${
      selectedProvider === 'ollama' ? 'Local AI' : 'Cloud'
    })...`,
    progressMsg,
    'info'
  );
  await updateRuntimeSessionState('in_progress', promptVersion, pageMetadata);

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(ANALYZE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        policyText,
        promptVersion,
        provider: selectedProvider,
        pageMetadata: {
          title: pageMetadata.title || 'Privacy Policy',
          url: pageMetadata.url || 'https://localhost/manual-input'
        }
      }),
      signal: abortController.signal
    });

    const payload = await response.json();

    if (!response.ok || !payload.success) {
      const formattedErr = formatBackendError(response.status, payload.error);
      await updateRuntimeSessionState('idle');

      // Retain previous completed result in the UI if one existed before this failed attempt
      if (previousRenderedBeforeRun) {
        renderCompletedStagesTimeline(previousRenderedBeforeRun.stages);
        renderAnalysisResults(previousRenderedBeforeRun, { isRestored: true });
      }

      setFeedback(
        formattedErr.title,
        `${formattedErr.message}${
          previousRenderedBeforeRun ? ' (Previous saved analysis retained below.)' : ''
        }`,
        'error'
      );
      return;
    }

    const data = payload.data;
    setConnectionState(
      'online',
      data.provider === 'ollama' ? 'Connected (Local)' : 'Connected (Cloud)'
    );

    // Persist completed analysis to chrome.storage.local
    const saveResult = await storage.saveCompletedAnalysis({
      responseData: data,
      pageMetadata,
      sourceType
    });

    await updateRuntimeSessionState('completed', promptVersion, pageMetadata);
    await refreshHistoryUI();

    const totalSec = ((data.durationMs || 0) / 1000).toFixed(1);
    const engineLabel =
      data.provider === 'ollama'
        ? `Local AI: Ollama (${data.model || 'qwen2.5:3b'})`
        : `Google Gemini (${data.model || 'gemini-2.5-flash'})`;

    if (saveResult.saved && saveResult.entry) {
      setFeedback(
        `Analysis Completed (Prompt ${versionUpper})`,
        `Completed ${data.stageCount || 1} ${engineLabel} model call(s) in ${totalSec}s (${
          sourceType === 'manual' ? 'Manual Paste' : 'Extracted Webpage'
        }) • Analysis saved locally.`,
        'success'
      );
      renderCompletedStagesTimeline(saveResult.entry.stages);
      renderAnalysisResults(saveResult.entry, { isRestored: false });
    } else {
      setFeedback(
        `Analysis Completed — Storage Warning (Prompt ${versionUpper})`,
        `Completed ${data.stageCount || 1} ${engineLabel} model call(s) in ${totalSec}s, but result could not be persisted to local storage (${
          saveResult.error || 'Quota exceeded'
        }).`,
        'warning'
      );
      renderCompletedStagesTimeline(data.stages);
      renderAnalysisResults(data, { isRestored: false });
    }
  } catch (err) {
    await updateRuntimeSessionState('idle');
    if (previousRenderedBeforeRun) {
      renderCompletedStagesTimeline(previousRenderedBeforeRun.stages);
      renderAnalysisResults(previousRenderedBeforeRun, { isRestored: true });
    }

    if (abortController.signal.aborted || err.name === 'AbortError') {
      setFeedback(
        'Client Request Timed Out',
        'The analysis request took longer than 4 minutes and was cancelled. Please try again.',
        'error'
      );
    } else {
      setConnectionState('offline', 'Offline');
      setFeedback(
        'Backend Server Unreachable',
        'Could not connect to http://localhost:3000/api/analyze. Ensure the local Express backend is running (`cd server && npm start`).',
        'error',
        err.message
      );
    }
  } finally {
    clearTimeout(timeoutId);
    setLoadingState(false);
  }
}

/**
 * Handler for "Analyze Current Page" button.
 */
async function handleAnalyzeCurrentPage() {
  if (isAnalyzing) {
    return;
  }

  setFeedback(
    'Extracting Privacy Policy...',
    'Extracting readable policy text from the current webpage...',
    'info'
  );
  const extraction = await inspectAndExtractActiveTab();

  if (!extraction || extraction.extractorStatus !== 'success') {
    setFeedback(
      'Cannot Analyze Current Page Automatically',
      extraction && extraction.message
        ? extraction.message
        : 'Automatic extraction could not find sufficient policy text on this tab. Please paste the policy text into the Manual Paste box above.',
      'warning'
    );
    openManualPanel(true);
    return;
  }

  await executePolicyAnalysis(
    extraction.extractedText,
    {
      title: extraction.pageTitle || 'Webpage Privacy Policy',
      url: extraction.pageUrl || 'https://example.com',
      domain: extraction.domain || 'example.com'
    },
    'extracted'
  );
}

/**
 * Handler for "Analyze Pasted Policy" button.
 */
async function handleAnalyzeManualInput() {
  if (isAnalyzing) {
    return;
  }

  const rawText = manualTextarea.value || '';
  const activeUrl =
    currentTabUrl && (currentTabUrl.startsWith('http://') || currentTabUrl.startsWith('https://'))
      ? currentTabUrl
      : 'https://localhost/manual-paste';
  const activeTitle =
    cachedExtraction && cachedExtraction.pageTitle
      ? `${cachedExtraction.pageTitle} (Manual Paste)`
      : 'Manually Pasted Privacy Policy';

  await executePolicyAnalysis(
    rawText,
    {
      title: activeTitle,
      url: activeUrl
    },
    'manual'
  );
}

/**
 * Clears the current active view in the popup (without wiping saved local storage history)
 * and re-inspects the active tab.
 */
async function handleReset() {
  if (isAnalyzing) {
    return;
  }

  activeRenderedEntry = null;
  resultsContainer.textContent = '';
  resultsContainer.classList.add('hidden');
  stageTimelineEl.textContent = '';
  stageTimelineEl.classList.add('hidden');
  elapsedTimerEl.classList.add('hidden');
  await updateRuntimeSessionState('idle');

  setFeedback(
    'Ready',
    'View cleared. Select a prompt version (V1, V2, or V3) and click "Analyze Current Page", "Manual Paste", or "History".',
    'info'
  );
  await inspectAndExtractActiveTab();
  await refreshHistoryUI();
}

// Event Listeners — Version Radio Visual Selection
for (const radio of versionRadios) {
  radio.addEventListener('change', () => {
    for (const label of versionLabels) {
      const input = label.querySelector('input[type="radio"]');
      if (input && input.checked) {
        label.classList.add('version-option-selected');
      } else {
        label.classList.remove('version-option-selected');
      }
    }
  });
}

if (providerSelect) {
  providerSelect.addEventListener('change', async () => {
    updateProviderBannerUI();
    await checkServerConnection();
  });
}

statusPill.addEventListener('click', checkServerConnection);
analyzeBtn.addEventListener('click', handleAnalyzeCurrentPage);
toggleManualBtn.addEventListener('click', () => openManualPanel());
if (toggleHistoryBtn) {
  toggleHistoryBtn.addEventListener('click', () => openHistoryPanel());
}
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', () => {
    if (clearConfirmBar) {
      clearConfirmBar.classList.remove('hidden');
    }
  });
}
if (confirmClearBtn) {
  confirmClearBtn.addEventListener('click', handleConfirmClearAllHistory);
}
if (cancelClearBtn) {
  cancelClearBtn.addEventListener('click', () => {
    if (clearConfirmBar) {
      clearConfirmBar.classList.add('hidden');
    }
  });
}
resetBtn.addEventListener('click', handleReset);
manualTextarea.addEventListener('input', updateManualCharCount);
analyzeManualBtn.addEventListener('click', handleAnalyzeManualInput);
clearManualBtn.addEventListener('click', () => {
  manualTextarea.value = '';
  updateManualCharCount();
});

document.addEventListener('DOMContentLoaded', async () => {
  updateProviderBannerUI();
  updateManualCharCount();
  const interruptedSession = await detectAndClearInterruptedSession();
  await checkServerConnection();
  await inspectAndExtractActiveTab();
  await restoreContextForCurrentTab(interruptedSession);
});
