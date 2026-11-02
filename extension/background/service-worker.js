/**
 * PrivacyLens - Background Service Worker (Manifest V3)
 *
 * Manages extension lifecycle events and future background message routing.
 * No automatic page scraping or background network calls are executed.
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.info(`[PrivacyLens] Extension installed/updated (${details.reason}). Foundation v0.1.0 ready.`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'PING_BACKGROUND') {
    sendResponse({
      success: true,
      application: 'PrivacyLens',
      status: 'service_worker_active',
      timestamp: new Date().toISOString()
    });
    return true;
  }
  return false;
});
