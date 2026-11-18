/**
 * PrivacyLens — Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * 1. Manage extension lifecycle events while preserving saved local analysis history
 *    in `chrome.storage.local` across extension updates and browser restarts.
 * 2. Track active/interrupted analysis state (`privacylens_runtime_state`) so that if
 *    the popup is closed while a request is in flight, reopening the popup detects
 *    the interruption gracefully without overwriting any previously saved analysis.
 */

const STORAGE_STATE_KEY = 'privacylens_runtime_state';
const STORAGE_HISTORY_KEY = 'privacylens_analysis_history';

chrome.runtime.onInstalled.addListener((details) => {
  console.info(`[PrivacyLens] Extension installed/updated (${details.reason}). v0.2.0 ready.`);
  chrome.storage.local.get([STORAGE_HISTORY_KEY], (existing) => {
    const patch = {
      [STORAGE_STATE_KEY]: {
        status: 'idle',
        updatedAt: new Date().toISOString()
      }
    };
    if (!existing || !Array.isArray(existing[STORAGE_HISTORY_KEY])) {
      patch[STORAGE_HISTORY_KEY] = [];
    }
    chrome.storage.local.set(patch);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'PING_BACKGROUND') {
    sendResponse({
      success: true,
      application: 'PrivacyLens',
      status: 'service_worker_active',
      timestamp: new Date().toISOString()
    });
    return true;
  }

  if (message.type === 'SET_ANALYSIS_STATE') {
    const nextState = {
      status: message.status || 'idle',
      promptVersion: message.promptVersion || null,
      provider: message.provider || null,
      pageTitle: message.pageTitle || null,
      pageUrl: message.pageUrl || null,
      startedAt: message.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    chrome.storage.local.set({ [STORAGE_STATE_KEY]: nextState }, () => {
      sendResponse({ success: true, state: nextState });
    });
    return true;
  }

  if (message.type === 'GET_ANALYSIS_STATE') {
    chrome.storage.local.get([STORAGE_STATE_KEY], (result) => {
      sendResponse({
        success: true,
        state: result[STORAGE_STATE_KEY] || { status: 'idle' }
      });
    });
    return true;
  }

  return false;
});
