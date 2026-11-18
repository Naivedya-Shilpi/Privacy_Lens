/**
 * PrivacyLens — Webpage Privacy Policy Content Extractor (Task 1.4)
 *
 * Executed on-demand inside the active tab via `chrome.scripting.executeScript`
 * when the user opens the popup on a standard webpage or clicks "Analyze Current Page".
 *
 * Responsibilities:
 * 1. Identify the primary policy/article content container on the page.
 * 2. Strip navigation menus, headers, footers, cookie banners, ads, scripts, and styles.
 * 3. Preserve headings, list items, and paragraph boundaries as readable plain text.
 * 4. Enforce a safe character ceiling (58,000 chars) compatible with the backend's
 *    60,000-character limit, and detect when extracted text is insufficient (< 80 chars).
 */

(() => {
  const MIN_USABLE_LENGTH = 80;
  const MAX_EXTRACTION_LENGTH = 58000;

  const CANDIDATE_CONTAINER_SELECTORS = [
    '[data-testid*="privacy"]',
    '[data-testid*="policy"]',
    '#privacy-policy',
    '.privacy-policy',
    '#terms-of-service',
    '.terms-of-service',
    '.legal-content',
    '.policy-content',
    '.terms-content',
    'article',
    'main',
    '[role="main"]',
    '#main-content',
    '.main-content',
    '#content',
    '.content'
  ];

  const CLUTTER_SELECTORS = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'canvas',
    'audio',
    'video',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    'button',
    'input',
    'select',
    'textarea',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    '[role="search"]',
    '[aria-hidden="true"]',
    '[hidden]',
    '.cookie-banner',
    '#cookie-banner',
    '.cookie-consent',
    '#cookie-consent',
    '.nav',
    '.navbar',
    '.navigation',
    '.menu',
    '.sidebar',
    '.footer',
    '.site-footer',
    '.site-header',
    '.ads',
    '.advertisement',
    '.promo',
    '.social-share',
    '.breadcrumb',
    '.breadcrumbs'
  ].join(', ');

  const POLICY_SIGNAL_REGEX =
    /\b(privacy|policy|terms|conditions|personal data|personal information|collect|third[- ]party|cookies?|retention|data protection|gdpr|ccpa|your rights|arbitration)\b/i;

  /**
   * Converts a cleaned DOM subtree into structured, paragraph-preserved plain text.
   *
   * @param {Element} rootClone
   * @returns {string}
   */
  function extractReadableTextFromClone(rootClone) {
    // Ensure block-level elements and list items retain line breaks even on detached clones
    const blockTags = new Set([
      'P',
      'DIV',
      'SECTION',
      'ARTICLE',
      'MAIN',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'UL',
      'OL',
      'LI',
      'BLOCKQUOTE',
      'PRE',
      'TABLE',
      'TR',
      'DT',
      'DD',
      'HR',
      'BR'
    ]);

    const chunks = [];

    function walk(node) {
      if (!node) {
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue ? node.nodeValue.replace(/[ \t\f\v]+/g, ' ') : '';
        if (text) {
          chunks.push(text);
        }
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const tag = node.tagName;
      if (tag === 'BR') {
        chunks.push('\n');
        return;
      }

      const isHeading = /^H[1-6]$/.test(tag);
      const isListItem = tag === 'LI';
      const isBlock = blockTags.has(tag);

      if (isHeading) {
        chunks.push('\n\n');
      } else if (isListItem) {
        chunks.push('\n- ');
      } else if (isBlock) {
        chunks.push('\n');
      }

      for (const child of node.childNodes) {
        walk(child);
      }

      if (isHeading || tag === 'P' || tag === 'BLOCKQUOTE' || tag === 'SECTION' || tag === 'TABLE') {
        chunks.push('\n\n');
      } else if (isBlock) {
        chunks.push('\n');
      }
    }

    walk(rootClone);

    return chunks
      .join('')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Cleans a candidate element by cloning it and removing clutter nodes.
   *
   * @param {Element} element
   * @returns {string}
   */
  function getCleanedText(element) {
    if (!element) {
      return '';
    }
    const clone = element.cloneNode(true);
    const clutterNodes = clone.querySelectorAll(CLUTTER_SELECTORS);
    for (const node of clutterNodes) {
      node.remove();
    }
    return extractReadableTextFromClone(clone);
  }

  const pageTitle = (document.title || 'Untitled Page').trim();
  const pageUrl = window.location.href || '';
  const domain = window.location.hostname || 'unknown';

  if (!document.body) {
    return {
      extractorStatus: 'empty_page',
      pageTitle,
      pageUrl,
      domain,
      containerUsed: 'none',
      hasPolicyKeywords: false,
      originalCharCount: 0,
      characterCount: 0,
      wasTruncated: false,
      extractedText: '',
      message: 'This page does not contain a readable document body. Use Manual Paste instead.'
    };
  }

  let bestText = '';
  let bestSelector = 'document.body';

  for (const selector of CANDIDATE_CONTAINER_SELECTORS) {
    const candidates = document.querySelectorAll(selector);
    for (const candidate of candidates) {
      const candidateText = getCleanedText(candidate);
      if (candidateText.length >= 200 && candidateText.length > bestText.length) {
        bestText = candidateText;
        bestSelector = selector;
      }
    }
    if (bestText.length >= 600) {
      break;
    }
  }

  if (bestText.length < 200) {
    bestText = getCleanedText(document.body);
    bestSelector = 'document.body';
  }

  const originalCharCount = bestText.length;
  let finalText = bestText;
  let wasTruncated = false;

  if (finalText.length > MAX_EXTRACTION_LENGTH) {
    const sliceCandidate = finalText.slice(0, MAX_EXTRACTION_LENGTH);
    const lastParagraphBreak = sliceCandidate.lastIndexOf('\n\n');
    const lastSentenceBreak = sliceCandidate.lastIndexOf('. ');

    if (lastParagraphBreak > MAX_EXTRACTION_LENGTH * 0.8) {
      finalText = sliceCandidate.slice(0, lastParagraphBreak).trim();
    } else if (lastSentenceBreak > MAX_EXTRACTION_LENGTH * 0.8) {
      finalText = sliceCandidate.slice(0, lastSentenceBreak + 1).trim();
    } else {
      finalText = sliceCandidate.trim();
    }
    wasTruncated = true;
  }

  const combinedSignalSample = `${pageTitle} ${pageUrl} ${finalText.slice(0, 4000)}`;
  const hasPolicyKeywords = POLICY_SIGNAL_REGEX.test(combinedSignalSample);

  if (finalText.length < MIN_USABLE_LENGTH) {
    return {
      extractorStatus: 'insufficient_text',
      pageTitle,
      pageUrl,
      domain,
      containerUsed: bestSelector,
      hasPolicyKeywords,
      originalCharCount,
      characterCount: finalText.length,
      wasTruncated: false,
      extractedText: finalText,
      message: `Insufficient readable policy text extracted from this page (${finalText.length} characters; minimum ${MIN_USABLE_LENGTH} required). Please navigate directly to the website's Privacy Policy page or use Manual Paste.`
    };
  }

  return {
    extractorStatus: 'success',
    pageTitle,
    pageUrl,
    domain,
    containerUsed: bestSelector,
    hasPolicyKeywords,
    originalCharCount,
    characterCount: finalText.length,
    wasTruncated,
    extractedText: finalText,
    message: wasTruncated
      ? `Extracted ${finalText.length.toLocaleString()} characters from ${bestSelector} (truncated from ${originalCharCount.toLocaleString()} characters to fit the 60,000-character limit).`
      : `Extracted ${finalText.length.toLocaleString()} characters of readable text from ${bestSelector}.`
  };
})();
