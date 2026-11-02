/**
 * PrivacyLens - Popup UI Controller (Foundation Phase)
 *
 * Handles backend health verification and user-invoked page inspection placeholder.
 * Policy AI analysis is intentionally not connected during the initial setup phase.
 */

const API_BASE_URL = 'http://localhost:3000';
const HEALTH_ENDPOINT = `${API_BASE_URL}/api/health`;

const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const analyzeBtn = document.getElementById('analyze-btn');
const testConnBtn = document.getElementById('test-conn-btn');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackMessage = document.getElementById('feedback-message');
const feedbackDetails = document.getElementById('feedback-details');

/**
 * Updates the header connection status indicator.
 * @param {'online' | 'offline' | 'checking' | 'unknown'} state
 * @param {string} label
 */
function setConnectionState(state, label) {
  statusPill.className = `status-pill status-${state}`;
  statusText.textContent = label;
}

/**
 * Updates the feedback panel with clear status messages and optional JSON/details.
 * @param {string} title
 * @param {string} message
 * @param {string|null} details
 */
function updateFeedback(title, message, details = null) {
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
 * Checks the local PrivacyLens Express backend health endpoint.
 */
async function checkServerConnection() {
  setConnectionState('checking', 'Checking...');
  testConnBtn.disabled = true;

  try {
    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    setConnectionState('online', 'Connected');
    updateFeedback(
      'Backend Connected',
      `Successfully reached ${data.application || 'PrivacyLens'} server (${data.status}).`,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    setConnectionState('offline', 'Offline');
    updateFeedback(
      'Backend Unreachable',
      'Could not connect to http://localhost:3000/api/health. Ensure the local backend server is running.',
      error.message
    );
  } finally {
    testConnBtn.disabled = false;
  }
}

/**
 * Placeholder handler for "Analyze This Page".
 * Uses activeTab + scripting permissions only upon explicit user click.
 */
async function handleAnalyzePageClick() {
  analyzeBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      updateFeedback(
        'No Active Tab',
        'Could not identify an active browser tab to inspect.'
      );
      return;
    }

    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      updateFeedback(
        'Unsupported Page Type',
        'PrivacyLens can only inspect standard http:// or https:// webpages. Policy analysis is not connected in this initialization phase.',
        `Current Tab URL: ${tab.url || 'restricted'}`
      );
      return;
    }

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/extractor.js']
    });

    const pageMetadata = injectionResults?.[0]?.result || {
      title: tab.title || 'Untitled',
      url: tab.url
    };

    updateFeedback(
      'Analysis Pipeline Not Connected Yet',
      'Active tab access verified. Full policy text extraction and AI analysis will be connected in the next development phase.',
      JSON.stringify(pageMetadata, null, 2)
    );
  } catch (error) {
    updateFeedback(
      'Analysis Not Available Yet',
      'Policy analysis is not connected in this foundation build, or this page restricts script execution.',
      error.message
    );
  } finally {
    analyzeBtn.disabled = false;
  }
}

testConnBtn.addEventListener('click', checkServerConnection);
analyzeBtn.addEventListener('click', handleAnalyzePageClick);

document.addEventListener('DOMContentLoaded', () => {
  checkServerConnection();
});
