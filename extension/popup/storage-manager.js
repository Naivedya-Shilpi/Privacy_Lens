/**
 * PrivacyLens — Persistent Local Result Storage & History Manager (Phase 6)
 *
 * Manages completed analysis persistence and runtime state in `chrome.storage.local`.
 *
 * Key Guarantees:
 * - Stores all history strictly on the user's machine (`chrome.storage.local`).
 * - Associates each result with a normalized webpage URL key so different websites
 *   never overwrite each other's results.
 * - Maintains up to `MAX_HISTORY_ENTRIES` (20) completed analyses, pruning oldest
 *   entries automatically when the limit is exceeded.
 * - Deduplicates repeated saves for the same `(normalizedUrlKey, promptVersion, provider)`.
 * - Handles `QUOTA_BYTES` errors gracefully by pruning older entries and retrying
 *   so the most recent completed analysis is never silently discarded.
 * - Never saves incomplete, interrupted, or failed analyses as completed results.
 */

(function (globalScope) {
  const STORAGE_RUNTIME_STATE_KEY = 'privacylens_runtime_state';
  const STORAGE_HISTORY_KEY = 'privacylens_analysis_history';
  const MAX_HISTORY_ENTRIES = 20;

  const TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'msclkid',
    'ref',
    '_ga',
    '_gl'
  ]);

  /**
   * Computes a deterministic short alphanumeric hash for manual input deduplication.
   *
   * @param {string} input
   * @returns {string}
   */
  function computeShortHash(input) {
    const str = String(input || '');
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  /**
   * Normalizes a webpage URL into a stable storage key without merging distinct pages.
   * - Preserves protocol, hostname, pathname, and non-tracking query parameters.
   * - Strips URL fragments (`#...`) and known ad-tracking parameters (`utm_*`, `fbclid`, etc.).
   * - Normalizes trailing slashes on non-root paths.
   *
   * @param {string} rawUrl
   * @param {string} [fallbackIdentifier='']
   * @returns {string}
   */
  function normalizeUrlKey(rawUrl, fallbackIdentifier = '') {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return fallbackIdentifier
        ? `manual://pasted-policy/${computeShortHash(fallbackIdentifier)}`
        : 'manual://pasted-policy/default';
    }

    const trimmed = rawUrl.trim();
    if (
      trimmed.startsWith('https://localhost/manual-') ||
      trimmed.startsWith('manual://') ||
      (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))
    ) {
      const seed = fallbackIdentifier || trimmed;
      return `manual://pasted-policy/${computeShortHash(seed)}`;
    }

    try {
      const parsed = new URL(trimmed);
      parsed.hash = '';

      // Remove only known tracking query parameters while keeping functional parameters
      const keysToDelete = [];
      for (const key of parsed.searchParams.keys()) {
        if (TRACKING_PARAMS.has(key.toLowerCase())) {
          keysToDelete.push(key);
        }
      }
      for (const k of keysToDelete) {
        parsed.searchParams.delete(k);
      }
      parsed.searchParams.sort();

      let cleanPath = parsed.pathname || '/';
      if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.replace(/\/+$/, '');
      }

      const queryStr = parsed.searchParams.toString();
      return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${cleanPath}${
        queryStr ? `?${queryStr}` : ''
      }`;
    } catch (_err) {
      return trimmed.toLowerCase();
    }
  }

  /**
   * Promisified wrapper around `chrome.storage.local.get`.
   *
   * @param {string[]} keys
   * @returns {Promise<Object>}
   */
  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === 'undefined' ||
        !chrome.storage ||
        !chrome.storage.local
      ) {
        reject(new Error('chrome.storage.local is not available in this context.'));
        return;
      }

      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Storage read error.'));
          return;
        }
        resolve(result || {});
      });
    });
  }

  /**
   * Promisified wrapper around `chrome.storage.local.set`.
   *
   * @param {Object} items
   * @returns {Promise<void>}
   */
  function storageSet(items) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === 'undefined' ||
        !chrome.storage ||
        !chrome.storage.local
      ) {
        reject(new Error('chrome.storage.local is not available in this context.'));
        return;
      }

      chrome.storage.local.set(items, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          const err = new Error(chrome.runtime.lastError.message || 'Storage write error.');
          err.isQuotaError = /QUOTA_BYTES|quota/i.test(err.message);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Validates that an analysis payload is complete and schema-compliant before saving.
   *
   * @param {Object} responseData
   * @returns {boolean}
   */
  function isCompleteAnalysisPayload(responseData) {
    if (!responseData || typeof responseData !== 'object') {
      return false;
    }
    const analysis = responseData.analysis;
    if (!analysis || typeof analysis !== 'object') {
      return false;
    }
    if (!analysis.summary || typeof analysis.summary.overview !== 'string') {
      return false;
    }
    if (!analysis.verificationAudit || typeof analysis.verificationAudit.verificationStatus !== 'string') {
      return false;
    }
    return true;
  }

  /**
   * Loads the full saved analysis history array (newest first).
   *
   * @returns {Promise<Array<Object>>}
   */
  async function getAnalysisHistory() {
    try {
      const data = await storageGet([STORAGE_HISTORY_KEY]);
      const list = data[STORAGE_HISTORY_KEY];
      return Array.isArray(list) ? list : [];
    } catch (_err) {
      return [];
    }
  }

  /**
   * Saves a completed analysis result to `chrome.storage.local`, enforcing deduplication,
   * the 20-entry limit, and quota recovery.
   *
   * @param {Object} params
   * @param {Object} params.responseData - Validated `data` object returned by `POST /api/analyze`
   * @param {{ title: string, url: string, domain?: string }} params.pageMetadata
   * @param {'extracted' | 'manual'} [params.sourceType='extracted']
   * @returns {Promise<{ saved: boolean, entry: Object | null, historyCount: number, error?: string, quotaRecovered?: boolean }>}
   */
  async function saveCompletedAnalysis(params = {}) {
    const { responseData, pageMetadata = {}, sourceType = 'extracted' } = params;

    if (!isCompleteAnalysisPayload(responseData)) {
      return {
        saved: false,
        entry: null,
        historyCount: 0,
        error: 'Refused to save incomplete or invalid analysis payload.'
      };
    }

    const rawUrl =
      (pageMetadata && pageMetadata.url) ||
      (responseData.pageMetadata && responseData.pageMetadata.url) ||
      'https://localhost/manual-input';
    const rawTitle =
      (pageMetadata && pageMetadata.title) ||
      (responseData.pageMetadata && responseData.pageMetadata.title) ||
      'Privacy Policy Analysis';

    const overviewSeed = `${rawTitle}|${responseData.analysis.summary.overview.slice(0, 160)}`;
    const normalizedUrlKey = normalizeUrlKey(
      sourceType === 'manual' && rawUrl.includes('localhost/manual') ? '' : rawUrl,
      overviewSeed
    );

    let domain = pageMetadata.domain || 'manual-input';
    try {
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        domain = new URL(rawUrl).hostname;
      }
    } catch (_e) {
      domain = 'manual-input';
    }

    const promptVersion = (
      responseData.promptVersion ||
      responseData.analysis.promptVersion ||
      'v3'
    ).toLowerCase();
    const provider = (responseData.provider || 'ollama').toLowerCase();
    const model =
      responseData.model || (provider === 'ollama' ? 'qwen2.5:3b' : 'gemini-2.5-flash');
    const verAudit = responseData.analysis.verificationAudit;
    const savedAt = new Date().toISOString();

    const newEntry = {
      entryId: `pl-hist-${Date.now()}-${computeShortHash(`${normalizedUrlKey}|${promptVersion}|${provider}`)}`,
      normalizedUrlKey,
      pageUrl: rawUrl,
      pageTitle: rawTitle,
      domain,
      sourceType,
      promptVersion,
      provider,
      model,
      verificationStatus:
        responseData.verificationStatus || verAudit.verificationStatus || 'unverified_baseline',
      verified: Boolean(
        responseData.verified === true &&
          (responseData.verificationStatus === 'verified_by_stage4' ||
            verAudit.verificationStatus === 'verified_by_stage4')
      ),
      savedAt,
      durationMs: typeof responseData.durationMs === 'number' ? responseData.durationMs : 0,
      stageCount: typeof responseData.stageCount === 'number' ? responseData.stageCount : 1,
      tokenUsage: responseData.tokenUsage || {
        promptTokens: null,
        completionTokens: null,
        thoughtsTokens: null,
        totalTokens: null
      },
      stages: Array.isArray(responseData.stages) ? responseData.stages : [],
      rawText: typeof responseData.rawText === 'string' ? responseData.rawText : null,
      analysis: responseData.analysis
    };

    const existingHistory = await getAnalysisHistory();

    // Remove existing entry with identical (normalizedUrlKey, promptVersion, provider)
    // to prevent duplicate entries from repeated clicks or re-runs
    const filtered = existingHistory.filter(
      (item) =>
        !(
          item &&
          item.normalizedUrlKey === normalizedUrlKey &&
          item.promptVersion === promptVersion &&
          item.provider === provider
        )
    );

    const updatedHistory = [newEntry, ...filtered].slice(0, MAX_HISTORY_ENTRIES);

    try {
      await storageSet({ [STORAGE_HISTORY_KEY]: updatedHistory });
      return {
        saved: true,
        entry: newEntry,
        historyCount: updatedHistory.length
      };
    } catch (err) {
      // Handle storage quota exceeded by pruning older entries while preserving the newest result
      if (err && (err.isQuotaError || /QUOTA|quota/i.test(err.message))) {
        try {
          const emergencyTrimmed = [newEntry, ...filtered.slice(0, 4)];
          await storageSet({ [STORAGE_HISTORY_KEY]: emergencyTrimmed });
          return {
            saved: true,
            entry: newEntry,
            historyCount: emergencyTrimmed.length,
            quotaRecovered: true
          };
        } catch (retryErr) {
          return {
            saved: false,
            entry: newEntry,
            historyCount: existingHistory.length,
            error: retryErr.message || 'Local storage quota exceeded.'
          };
        }
      }

      return {
        saved: false,
        entry: newEntry,
        historyCount: existingHistory.length,
        error: err.message || 'Failed to persist analysis to chrome.storage.local.'
      };
    }
  }

  /**
   * Finds the most recent saved analysis matching a given webpage URL.
   * Never returns an analysis belonging to a different website.
   *
   * @param {string} rawUrl
   * @returns {Promise<Object|null>}
   */
  async function getLatestAnalysisForUrl(rawUrl) {
    if (!rawUrl || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) {
      return null;
    }
    const targetKey = normalizeUrlKey(rawUrl);
    const history = await getAnalysisHistory();
    return history.find((entry) => entry && entry.normalizedUrlKey === targetKey) || null;
  }

  /**
   * Finds a specific history entry by its `entryId`.
   *
   * @param {string} entryId
   * @returns {Promise<Object|null>}
   */
  async function getAnalysisById(entryId) {
    if (!entryId) {
      return null;
    }
    const history = await getAnalysisHistory();
    return history.find((entry) => entry && entry.entryId === entryId) || null;
  }

  /**
   * Deletes a single history entry by `entryId`.
   *
   * @param {string} entryId
   * @returns {Promise<{ deleted: boolean, history: Array<Object> }>}
   */
  async function deleteHistoryEntry(entryId) {
    const history = await getAnalysisHistory();
    const nextHistory = history.filter((entry) => entry && entry.entryId !== entryId);
    const deleted = nextHistory.length !== history.length;
    await storageSet({ [STORAGE_HISTORY_KEY]: nextHistory });
    return { deleted, history: nextHistory };
  }

  /**
   * Clears all saved analysis history entries from `chrome.storage.local`.
   *
   * @returns {Promise<void>}
   */
  async function clearAllHistory() {
    await storageSet({ [STORAGE_HISTORY_KEY]: [] });
  }

  /**
   * Reads the runtime session state (`privacylens_runtime_state`).
   *
   * @returns {Promise<Object>}
   */
  async function getRuntimeState() {
    try {
      const data = await storageGet([STORAGE_RUNTIME_STATE_KEY]);
      return data[STORAGE_RUNTIME_STATE_KEY] || { status: 'idle' };
    } catch (_err) {
      return { status: 'idle' };
    }
  }

  /**
   * Writes the runtime session state (`privacylens_runtime_state`).
   *
   * @param {Object} statePatch
   * @returns {Promise<Object>}
   */
  async function setRuntimeState(statePatch = {}) {
    const nextState = {
      status: statePatch.status || 'idle',
      promptVersion: statePatch.promptVersion || null,
      provider: statePatch.provider || null,
      pageTitle: statePatch.pageTitle || null,
      pageUrl: statePatch.pageUrl || null,
      normalizedUrlKey: statePatch.pageUrl ? normalizeUrlKey(statePatch.pageUrl) : null,
      startedAt: statePatch.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      await storageSet({ [STORAGE_RUNTIME_STATE_KEY]: nextState });
    } catch (_err) {
      // Ignore storage error on transient state marker
    }
    return nextState;
  }

  const exportedApi = {
    STORAGE_RUNTIME_STATE_KEY,
    STORAGE_HISTORY_KEY,
    MAX_HISTORY_ENTRIES,
    normalizeUrlKey,
    isCompleteAnalysisPayload,
    getAnalysisHistory,
    saveCompletedAnalysis,
    getLatestAnalysisForUrl,
    getAnalysisById,
    deleteHistoryEntry,
    clearAllHistory,
    getRuntimeState,
    setRuntimeState
  };

  globalScope.PrivacyLensStorage = exportedApi;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportedApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
