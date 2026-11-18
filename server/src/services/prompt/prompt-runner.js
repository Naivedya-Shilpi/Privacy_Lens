const fs = require('fs');
const path = require('path');
const OllamaProvider = require('../ai/ollama.provider');
const GeminiProvider = require('../ai/gemini.provider');
const {
  stage1ExtractionSchema,
  stage2AnalysisSchema,
  v1NormalizedSchema,
  stage3CandidateSchema,
  stage4VerifiedSchema,
  STAGE1_JSON_SCHEMA,
  STAGE2_JSON_SCHEMA,
  STAGE3_CANDIDATE_JSON_SCHEMA,
  STAGE4_VERIFIED_JSON_SCHEMA,
  formatSafeValidationIssues
} = require('./schemas');

const PROMPTS_DIR = path.resolve(__dirname, '../../../../prompts/versions');
const SUPPORTED_VERSIONS = ['v1', 'v2', 'v3'];

let cachedTemplates = null;

/**
 * Extracts all ```markdown ... ``` fenced blocks from a prompt specification file.
 *
 * @param {string} markdownContent
 * @param {string} fileName
 * @returns {Array<{ systemPrompt: string, userPromptTemplate: string }>}
 */
function extractMarkdownStageBlocks(markdownContent, fileName) {
  const fenceRegex = /```markdown\r?\n([\s\S]*?)```/g;
  const stages = [];
  let match;

  while ((match = fenceRegex.exec(markdownContent)) !== null) {
    const block = match[1];
    const sysMarker = '### SYSTEM INSTRUCTION';
    const userMarker = '### USER INPUT';

    const sysIdx = block.indexOf(sysMarker);
    const userIdx = block.indexOf(userMarker);

    if (sysIdx === -1 || userIdx === -1 || userIdx <= sysIdx) {
      throw new Error(
        `[PromptLoader] Failed to locate '${sysMarker}' and '${userMarker}' markers in ${fileName}.`
      );
    }

    const systemPrompt = block
      .slice(sysIdx + sysMarker.length, userIdx)
      .trim();
    const userPromptTemplate = block
      .slice(userIdx + userMarker.length)
      .trim();

    if (!systemPrompt || !userPromptTemplate) {
      throw new Error(`[PromptLoader] Extracted empty system or user prompt in ${fileName}.`);
    }

    stages.push({ systemPrompt, userPromptTemplate });
  }

  return stages;
}

/**
 * Loads and caches the exact prompt instructions from:
 * - prompts/versions/baseline-v1.md
 * - prompts/versions/chained-v2.md
 * - prompts/versions/verified-v3.md
 *
 * Ensures zero narrative documentation or ASCII diagrams outside the prompt blocks
 * are sent to the model.
 */
function loadPromptTemplates() {
  if (cachedTemplates) {
    return cachedTemplates;
  }

  const v1Path = path.join(PROMPTS_DIR, 'baseline-v1.md');
  const v2Path = path.join(PROMPTS_DIR, 'chained-v2.md');
  const v3Path = path.join(PROMPTS_DIR, 'verified-v3.md');

  const v1Raw = fs.readFileSync(v1Path, 'utf8');
  const v2Raw = fs.readFileSync(v2Path, 'utf8');
  const v3Raw = fs.readFileSync(v3Path, 'utf8');

  // Extract exact V1 prompt text under "## Exact Prompt Text"
  const v1HeaderIdx = v1Raw.indexOf('## Exact Prompt Text');
  if (v1HeaderIdx === -1) {
    throw new Error('[PromptLoader] Could not find "## Exact Prompt Text" in baseline-v1.md');
  }
  let v1PromptText = v1Raw
    .slice(v1HeaderIdx + '## Exact Prompt Text'.length)
    .trim();
  if (v1PromptText.startsWith('"') && v1PromptText.endsWith('"')) {
    v1PromptText = v1PromptText.slice(1, -1).trim();
  }

  if (!v1PromptText.startsWith('You are PrivacyLens, a privacy policy assistant.')) {
    throw new Error('[PromptLoader] Unexpected V1 prompt text in baseline-v1.md');
  }

  // Extract Stages 1, 2, 3 from chained-v2.md
  const v2Stages = extractMarkdownStageBlocks(v2Raw, 'chained-v2.md');
  if (v2Stages.length !== 3) {
    throw new Error(
      `[PromptLoader] Expected exactly 3 stage blocks in chained-v2.md, found ${v2Stages.length}.`
    );
  }

  // Extract Stage 4 from verified-v3.md
  const v3Stages = extractMarkdownStageBlocks(v3Raw, 'verified-v3.md');
  if (v3Stages.length !== 1) {
    throw new Error(
      `[PromptLoader] Expected exactly 1 Stage 4 block in verified-v3.md, found ${v3Stages.length}.`
    );
  }

  cachedTemplates = {
    v1: {
      exactPrompt: v1PromptText
    },
    v2: {
      stage1: v2Stages[0],
      stage2: v2Stages[1],
      stage3: v2Stages[2]
    },
    v3: {
      stage1: v2Stages[0],
      stage2: v2Stages[1],
      stage3: v2Stages[2],
      stage4: v3Stages[0]
    }
  };

  return cachedTemplates;
}

/**
 * Extracts any literal double-quoted substring ("...") from a V1 bullet if the model
 * happened to quote the policy; otherwise returns a transparent placeholder string
 * without adding or looking up quotes from the source text.
 *
 * @param {string} bulletText
 * @returns {string}
 */
function extractExistingQuoteOrPlaceholder(bulletText) {
  const quoteMatch = bulletText.match(/"([^"]{6,})"/);
  if (quoteMatch && quoteMatch[1].trim().length > 0) {
    return quoteMatch[1].trim();
  }
  return 'No verbatim excerpt cited in V1 baseline output';
}

/**
 * Classifies a heading or bullet into one of the canonical PrivacyLens sections
 * based solely on topic keywords.
 *
 * @param {string} text
 * @returns {'summary' | 'collection' | 'usage' | 'sharing' | 'rights' | 'retention' | 'risks' | 'missing' | null}
 */
function classifyHeadingOrBullet(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes('missing') ||
    lower.includes('not mention') ||
    lower.includes('not specif') ||
    lower.includes('omitted') ||
    lower.includes('does not state') ||
    lower.includes("what's missing") ||
    lower.includes('unmentioned')
  ) {
    return 'missing';
  }
  if (
    lower.includes('risky') ||
    lower.includes('unclear') ||
    lower.includes('concern') ||
    lower.includes('vague') ||
    lower.includes('watch out') ||
    lower.includes('notable clause') ||
    lower.includes('arbitration') ||
    lower.includes('class-action') ||
    lower.includes('sole discretion')
  ) {
    return 'risks';
  }
  if (
    lower.includes('third part') ||
    lower.includes('third-part') ||
    lower.includes('shar') ||
    lower.includes('disclos') ||
    lower.includes('partner') ||
    lower.includes('affiliat')
  ) {
    return 'sharing';
  }
  if (
    lower.includes('retain') ||
    lower.includes('retention') ||
    lower.includes('how long')
  ) {
    return 'retention';
  }
  if (
    lower.includes('right') ||
    lower.includes('choice') ||
    lower.includes('delete') ||
    lower.includes('deletion') ||
    lower.includes('opt-out') ||
    lower.includes('opt out') ||
    lower.includes('access your') ||
    lower.includes('request a copy')
  ) {
    return 'rights';
  }
  if (
    lower.includes('what data') ||
    lower.includes('data collect') ||
    lower.includes('information collect') ||
    lower.includes('information we collect') ||
    lower.includes('company collects') ||
    lower.includes('types of data')
  ) {
    return 'collection';
  }
  if (
    lower.includes('how data is used') ||
    lower.includes('how it uses') ||
    lower.includes('uses your data') ||
    lower.includes('use your data') ||
    lower.includes('uses your information') ||
    lower.includes('use your information') ||
    lower.includes('how information is used') ||
    lower.includes('data usage') ||
    lower.includes('use of data') ||
    lower.includes('uses the data') ||
    lower.includes('why data is') ||
    lower.includes('purpose') ||
    /how\s+.+\s+uses/i.test(lower)
  ) {
    return 'usage';
  }
  if (
    lower.includes('summary') ||
    lower.includes('overview') ||
    lower.includes('in simple language') ||
    lower.includes('key takeaway')
  ) {
    return 'summary';
  }
  return null;
}

/**
 * Deterministic Post-Hoc Normalizer for Prompt V1 (`baseline-v1.md`)
 *
 * Implements the exact two-stage non-invasive normalization pipeline defined in
 * `evaluation/protocol.md` (Section 5):
 * - Segments V1's native bullet points by section headings / topic keywords into
 *   canonical evaluation slots.
 * - Does NOT make any LLM call.
 * - Does NOT rewrite, improve, fact-check, or add source quotes to V1's text.
 * - Marks `promptVersion: "v1"`, `verificationStatus: "unverified_baseline"`, `verified: false`.
 *
 * @param {string} rawText - Raw bullet-point response returned by V1
 * @returns {Object} Validated `PrivacyLensUnifiedAnalysis` object
 */
function normalizeV1Output(rawText) {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    const err = new Error('[PromptRunner] Cannot normalize empty V1 response text.');
    err.code = 'EMPTY_V1_RESPONSE';
    throw err;
  }

  const buckets = {
    summary: [],
    collection: [],
    usage: [],
    sharing: [],
    rights: [],
    retention: [],
    risks: [],
    missing: []
  };

  const allBullets = [];
  const lines = rawText.split(/\r?\n/);
  let currentSection = 'summary';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const isHeadingLine =
      /^#{1,6}\s+/.test(line) ||
      (/^\*\*[^*]+\*\*:?\s*$/.test(line) && !/^[-*•]/.test(line)) ||
      (/^[A-Z][A-Za-z0-9\s,&/-]{2,50}:$/.test(line) && !/^[-*•]/.test(line));

    if (isHeadingLine) {
      const cleanHeading = line.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').replace(/:$/, '').trim();
      const detected = classifyHeadingOrBullet(cleanHeading);
      if (detected) {
        currentSection = detected;
      }
      continue;
    }

    const isBullet = /^([-*•]|\d+\.)\s+/.test(line);
    const cleanText = line.replace(/^([-*•]|\d+\.)\s+/, '').trim();
    if (!cleanText) {
      continue;
    }

    // Check if the bullet starts with a bold category label like "**Data Collected:** ..."
    const boldPrefixMatch = cleanText.match(/^\*\*([^*:]+):?\*\*:?\s*(.*)$/);
    if (boldPrefixMatch) {
      const prefixLabel = boldPrefixMatch[1].trim();
      const remainder = boldPrefixMatch[2].trim();
      const prefixCategory = classifyHeadingOrBullet(prefixLabel);

      if (prefixCategory && !remainder) {
        // Sub-header formatted as a bullet with no inline text
        currentSection = prefixCategory;
        continue;
      }

      if (currentSection === 'summary' && prefixCategory && remainder) {
        buckets[prefixCategory].push(cleanText);
        allBullets.push(cleanText);
        continue;
      }
    }

    // Also check plain "Label: text" bullets such as "- Data Collected: ..." when not already inside a section
    const colonPrefixMatch = cleanText.match(/^([A-Za-z\s/-]{3,35}):\s+(.+)$/);
    if (currentSection === 'summary' && colonPrefixMatch) {
      const prefixCategory = classifyHeadingOrBullet(colonPrefixMatch[1]);
      if (prefixCategory) {
        buckets[prefixCategory].push(cleanText);
        allBullets.push(cleanText);
        continue;
      }
    }

    if (isBullet) {
      allBullets.push(cleanText);
      if (currentSection !== 'summary') {
        buckets[currentSection].push(cleanText);
      } else {
        const inferred = classifyHeadingOrBullet(cleanText) || 'summary';
        buckets[inferred].push(cleanText);
      }
    } else {
      buckets[currentSection].push(cleanText);
    }
  }

  const overviewText =
    buckets.summary.length > 0
      ? buckets.summary.slice(0, 2).join(' ')
      : allBullets.length > 0
        ? allBullets.slice(0, 2).join(' ')
        : rawText.trim().slice(0, 400);

  const keyTakeaways =
    allBullets.length > 0
      ? allBullets.slice(0, 6)
      : [overviewText];

  const dataCollectionItems = buckets.collection.map((text, idx) => ({
    clauseId: `V1-DC-${String(idx + 1).padStart(2, '0')}`,
    category: 'V1 Baseline Data Collection Point',
    dataTypes: [text],
    purpose:
      buckets.usage.length > 0
        ? 'See V1 dataUsage section for stated usage bullets'
        : 'Not separately linked in V1 baseline output',
    supportingExcerpt: extractExistingQuoteOrPlaceholder(text)
  }));

  const dataUsagePurposes = buckets.usage.map((text, idx) => ({
    clauseId: `V1-DU-${String(idx + 1).padStart(2, '0')}`,
    purpose: `V1 Baseline Data Usage Point ${idx + 1}`,
    plainExplanation: text,
    supportingExcerpt: extractExistingQuoteOrPlaceholder(text)
  }));

  const thirdPartyDisclosures = buckets.sharing.map((text, idx) => ({
    clauseId: `V1-TP-${String(idx + 1).padStart(2, '0')}`,
    recipientCategory: 'Third parties mentioned in V1 baseline bullet',
    sharedData: 'See plainExplanation',
    purpose: 'See plainExplanation',
    plainExplanation: text,
    supportingExcerpt: extractExistingQuoteOrPlaceholder(text)
  }));

  const userRightsList = buckets.rights.map((text, idx) => ({
    clauseId: `V1-UR-${String(idx + 1).padStart(2, '0')}`,
    right: `V1 Baseline User Right Point ${idx + 1}`,
    howToExercise: 'See plainExplanation',
    limitations: 'See plainExplanation',
    plainExplanation: text,
    supportingExcerpt: extractExistingQuoteOrPlaceholder(text)
  }));

  const concerningClauses = buckets.risks.map((text, idx) => ({
    clauseId: `V1-CC-${String(idx + 1).padStart(2, '0')}`,
    topic: `V1 Baseline Flagged Clause ${idx + 1}`,
    classification: 'Potentially Concerning / Broad Wording',
    plainExplanation: text,
    whyItMatters: text,
    supportingExcerpt: extractExistingQuoteOrPlaceholder(text)
  }));

  const missingInfoList =
    buckets.missing.length > 0
      ? buckets.missing.map((text, idx) => ({
          topic: `V1 Baseline Missing Information Point ${idx + 1}`,
          status: 'Not specified',
          explanation: text
        }))
      : [
          {
            topic: 'Not explicitly separated in V1 output',
            status: 'Not specified',
            explanation:
              'Prompt V1 baseline output did not list separate missing-information bullets.'
          }
        ];

  const retentionBullets = buckets.retention;
  const retentionStatus = retentionBullets.length > 0 ? 'Specified' : 'Not specified';
  const retentionSummary =
    retentionBullets.length > 0 ? retentionBullets.join(' ') : 'Not specified';

  const normalized = {
    promptVersion: 'v1',
    summary: {
      overview: overviewText,
      keyTakeaways
    },
    dataCollection: {
      status: dataCollectionItems.length > 0 ? 'Specified' : 'Not specified',
      items: dataCollectionItems
    },
    dataUsage: {
      status: dataUsagePurposes.length > 0 ? 'Specified' : 'Not specified',
      purposes: dataUsagePurposes
    },
    thirdPartySharing: {
      status: thirdPartyDisclosures.length > 0 ? 'Specified' : 'Not specified',
      disclosures: thirdPartyDisclosures
    },
    userRightsAndRetention: {
      userRightsStatus: userRightsList.length > 0 ? 'Specified' : 'Not specified',
      dataRetentionStatus: retentionStatus,
      retentionSummary,
      rights: userRightsList
    },
    concerningOrUnclearClauses: concerningClauses,
    missingInformation: missingInfoList,
    verificationAudit: {
      verificationStatus: 'unverified_baseline',
      verified: false,
      unsupportedClaimsRemoved: 0,
      auditNotes: [
        'Deterministic post-hoc structural mapping of Prompt V1 native bulleted prose (evaluation/protocol.md Section 5).',
        'Zero additional LLM calls made; no facts rewritten and no source quotes added.'
      ]
    }
  };

  const parsed = v1NormalizedSchema.safeParse(normalized);
  if (!parsed.success) {
    const err = new Error('[PromptRunner] V1 deterministic normalizer output failed schema validation.');
    err.code = 'STAGE_SCHEMA_VALIDATION_ERROR';
    err.stage = 'v1_post_hoc_normalization';
    err.validationIssues = formatSafeValidationIssues(parsed.error);
    throw err;
  }

  return parsed.data;
}

/**
 * Parses and validates a JSON stage response against its Zod schema.
 * Never silently alters or fabricates fields.
 *
 * @param {string} rawJsonText
 * @param {import('zod').ZodSchema} zodSchema
 * @param {string} stageName
 * @returns {Object}
 */
function parseAndValidateStageJson(rawJsonText, zodSchema, stageName) {
  if (typeof rawJsonText !== 'string' || rawJsonText.trim().length === 0) {
    const err = new Error(`[PromptRunner] Stage '${stageName}' returned empty response text.`);
    err.code = 'EMPTY_STAGE_RESPONSE';
    err.stage = stageName;
    err.statusCode = 502;
    throw err;
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawJsonText);
  } catch (parseErr) {
    const err = new Error(
      `[PromptRunner] Stage '${stageName}' returned invalid JSON: ${parseErr.message}`
    );
    err.code = 'STAGE_JSON_PARSE_ERROR';
    err.stage = stageName;
    err.statusCode = 502;
    throw err;
  }

  const validation = zodSchema.safeParse(parsedJson);
  if (!validation.success) {
    const issues = formatSafeValidationIssues(validation.error);
    const issueSummary = issues
      .slice(0, 5)
      .map((i) => `${i.path}: ${i.message}`)
      .join('; ');
    const err = new Error(
      `[PromptRunner] Stage '${stageName}' failed Zod schema validation (${issues.length} issue(s): ${issueSummary}).`
    );
    err.code = 'STAGE_SCHEMA_VALIDATION_ERROR';
    err.stage = stageName;
    err.validationIssues = issues;
    err.statusCode = 502;
    throw err;
  }

  return validation.data;
}

/**
 * Accumulates token usage across multiple sequential stages.
 *
 * @param {Array<Object>} stageMetadataList
 * @returns {{ promptTokens: number, completionTokens: number, thoughtsTokens: number, totalTokens: number }}
 */
function aggregateTokenUsage(stageMetadataList) {
  return stageMetadataList.reduce(
    (acc, stage) => {
      const u = stage.usage || {};
      acc.promptTokens += typeof u.promptTokens === 'number' ? u.promptTokens : 0;
      acc.completionTokens += typeof u.completionTokens === 'number' ? u.completionTokens : 0;
      acc.thoughtsTokens += typeof u.thoughtsTokens === 'number' ? u.thoughtsTokens : 0;
      acc.totalTokens += typeof u.totalTokens === 'number' ? u.totalTokens : 0;
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, thoughtsTokens: 0, totalTokens: 0 }
  );
}

/**
 * Resolves the provider instance to use for prompt execution.
 * - Defaults to `new OllamaProvider()` (Local-First architecture).
 * - Only instantiates `GeminiProvider` when `'gemini'` is explicitly passed.
 * - Never falls back automatically from Ollama to Gemini.
 *
 * @param {Object|string|undefined} providerInput
 * @returns {Object}
 */
function resolveProvider(providerInput) {
  if (providerInput && typeof providerInput.complete === 'function') {
    return providerInput;
  }
  if (typeof providerInput === 'string') {
    const normalized = providerInput.trim().toLowerCase();
    if (normalized === 'ollama') {
      return new OllamaProvider();
    }
    if (normalized === 'gemini') {
      return new GeminiProvider();
    }
    const err = new Error(
      `[PromptRunner] Provider '${providerInput}' is not enabled. Supported active providers are 'ollama' (default) and 'gemini'.`
    );
    err.code = 'UNSUPPORTED_PROVIDER';
    err.statusCode = 400;
    throw err;
  }
  return new OllamaProvider();
}

/**
 * Executes a single stage call via `providerInstance.complete()` and wraps any provider error
 * with stage attribution.
 *
 * @param {Object} providerInstance
 * @param {string} stageName
 * @param {Object} completeParams
 * @returns {Promise<Object>}
 */
async function executeStageCall(providerInstance, stageName, completeParams) {
  try {
    return await providerInstance.complete(completeParams);
  } catch (err) {
    if (!err.stage) {
      err.stage = stageName;
    }
    throw err;
  }
}

/**
 * Runs the PrivacyLens Prompt Analysis Pipeline for V1, V2, or V3.
 *
 * @param {Object} params
 * @param {string} params.policyText - Untrusted privacy policy text to analyze
 * @param {'v1' | 'v2' | 'v3'} [params.promptVersion='v3'] - Which prompt architecture to execute
 * @param {Object|string} [params.provider] - Provider instance (with `.complete()`) or `'gemini'`
 * @param {Object} [params.options={}] - Optional overrides (`temperature`, `model`, `timeoutMs`)
 * @returns {Promise<{
 *   promptVersion: 'v1' | 'v2' | 'v3',
 *   provider: string,
 *   model: string,
 *   modelCallCount: number,
 *   totalDurationMs: number,
 *   totalUsage: {
 *     promptTokens: number,
 *     completionTokens: number,
 *     thoughtsTokens: number,
 *     totalTokens: number
 *   },
 *   rawText: string | null,
 *   analysis: Object,
 *   stages: Array<Object>,
 *   intermediateOutputs: Object
 * }>}
 */
async function runPromptAnalysis(params = {}) {
  const { policyText, promptVersion = 'v3', provider, options = {} } = params;

  if (typeof promptVersion !== 'string' || !SUPPORTED_VERSIONS.includes(promptVersion.toLowerCase())) {
    const err = new Error(
      `[PromptRunner] Invalid promptVersion '${promptVersion}'. Supported versions are: ${SUPPORTED_VERSIONS.join(', ')}.`
    );
    err.code = 'INVALID_PROMPT_VERSION';
    err.statusCode = 400;
    throw err;
  }

  const normalizedVersion = promptVersion.toLowerCase();

  if (typeof policyText !== 'string' || policyText.trim().length === 0) {
    const err = new Error('[PromptRunner] A non-empty policyText string is required for analysis.');
    err.code = 'EMPTY_POLICY_TEXT';
    err.statusCode = 400;
    throw err;
  }

  const cleanPolicyText = policyText.trim();
  const providerInstance = resolveProvider(provider);
  const templates = loadPromptTemplates();
  const temperature = typeof options.temperature === 'number' ? options.temperature : 0;
  const pipelineStartTime = Date.now();
  const stagesMetadata = [];

  // =========================================================================
  // V1: Baseline Single-Pass Prompt Execution (1 Model Call + Deterministic Normalization)
  // =========================================================================
  if (normalizedVersion === 'v1') {
    const v1UserPrompt = `${templates.v1.exactPrompt}\n\nPrivacy Policy:\n${cleanPolicyText}`;

    const stageRes = await executeStageCall(providerInstance, 'v1_single_pass_baseline', {
      systemPrompt: '',
      userPrompt: v1UserPrompt,
      jsonMode: false,
      temperature,
      model: options.model,
      timeoutMs: options.timeoutMs
    });

    const normalizedAnalysis = normalizeV1Output(stageRes.text);

    stagesMetadata.push({
      stageNumber: 1,
      stageName: 'v1_single_pass_baseline',
      model: stageRes.model,
      durationMs: stageRes.durationMs,
      usage: stageRes.usage,
      jsonMode: false,
      validationPassed: true
    });

    return {
      promptVersion: 'v1',
      provider: stageRes.provider || providerInstance.providerName || 'gemini',
      model: stageRes.model,
      modelCallCount: stagesMetadata.length,
      totalDurationMs: Date.now() - pipelineStartTime,
      totalUsage: aggregateTokenUsage(stagesMetadata),
      rawText: stageRes.text,
      analysis: normalizedAnalysis,
      stages: stagesMetadata,
      intermediateOutputs: {
        v1RawBulletTextLength: stageRes.text.length,
        v1NormalizationMethod: 'deterministic_post_hoc_mapper'
      }
    };
  }

  // =========================================================================
  // V2 & V3 Shared Stages 1, 2, and 3 (3 Sequential Model Calls)
  // =========================================================================

  // --- STAGE 1: Verbatim Clause Extraction & Taxonomy Tagging ---
  const stage1Template = templates.v2.stage1;
  const stage1UserPrompt = stage1Template.userPromptTemplate.replace(
    '{{POLICY_TEXT}}',
    () => cleanPolicyText
  );

  const stage1Res = await executeStageCall(providerInstance, 'stage1_clause_extraction', {
    systemPrompt: stage1Template.systemPrompt,
    userPrompt: stage1UserPrompt,
    jsonMode: true,
    jsonSchema: STAGE1_JSON_SCHEMA,
    temperature,
    model: options.model,
    timeoutMs: options.timeoutMs
  });

  const stage1Validated = parseAndValidateStageJson(
    stage1Res.text,
    stage1ExtractionSchema,
    'stage1_clause_extraction'
  );

  stagesMetadata.push({
    stageNumber: 1,
    stageName: 'stage1_clause_extraction',
    model: stage1Res.model,
    durationMs: stage1Res.durationMs,
    usage: stage1Res.usage,
    jsonMode: true,
    validationPassed: true,
    extractedClauseCount: stage1Validated.extractedClauses.length,
    unmentionedCategories: stage1Validated.unmentionedCategories
  });

  // --- STAGE 2: Structured Privacy & Clause Analysis ---
  const stage2Template = templates.v2.stage2;
  const stage1JsonString = JSON.stringify(stage1Validated, null, 2);
  const stage2UserPrompt = stage2Template.userPromptTemplate.replace(
    '{{STAGE_1_JSON}}',
    () => stage1JsonString
  );

  const stage2Res = await executeStageCall(providerInstance, 'stage2_structured_analysis', {
    systemPrompt: stage2Template.systemPrompt,
    userPrompt: stage2UserPrompt,
    jsonMode: true,
    jsonSchema: STAGE2_JSON_SCHEMA,
    temperature,
    model: options.model,
    timeoutMs: options.timeoutMs
  });

  const stage2Validated = parseAndValidateStageJson(
    stage2Res.text,
    stage2AnalysisSchema,
    'stage2_structured_analysis'
  );

  stagesMetadata.push({
    stageNumber: 2,
    stageName: 'stage2_structured_analysis',
    model: stage2Res.model,
    durationMs: stage2Res.durationMs,
    usage: stage2Res.usage,
    jsonMode: true,
    validationPassed: true
  });

  // --- STAGE 3: Plain-Language Synthesis (Unverified Candidate Output) ---
  const stage3Template = templates.v2.stage3;
  const stage2JsonString = JSON.stringify(stage2Validated, null, 2);
  const stage3UserPrompt = stage3Template.userPromptTemplate.replace(
    '{{STAGE_2_JSON}}',
    () => stage2JsonString
  );

  const stage3Res = await executeStageCall(providerInstance, 'stage3_plain_language_synthesis', {
    systemPrompt: stage3Template.systemPrompt,
    userPrompt: stage3UserPrompt,
    jsonMode: true,
    jsonSchema: STAGE3_CANDIDATE_JSON_SCHEMA,
    temperature,
    model: options.model,
    timeoutMs: options.timeoutMs
  });

  const stage3CandidateValidated = parseAndValidateStageJson(
    stage3Res.text,
    stage3CandidateSchema,
    'stage3_plain_language_synthesis'
  );

  stagesMetadata.push({
    stageNumber: 3,
    stageName: 'stage3_plain_language_synthesis',
    model: stage3Res.model,
    durationMs: stage3Res.durationMs,
    usage: stage3Res.usage,
    jsonMode: true,
    validationPassed: true
  });

  // If Prompt V2 was requested, return the unverified Stage 3 candidate output (3 calls total)
  if (normalizedVersion === 'v2') {
    return {
      promptVersion: 'v2',
      provider: stage3Res.provider || providerInstance.providerName || 'gemini',
      model: stage3Res.model,
      modelCallCount: stagesMetadata.length,
      totalDurationMs: Date.now() - pipelineStartTime,
      totalUsage: aggregateTokenUsage(stagesMetadata),
      rawText: null,
      analysis: stage3CandidateValidated,
      stages: stagesMetadata,
      intermediateOutputs: {
        stage1Extraction: stage1Validated,
        stage2Analysis: stage2Validated
      }
    };
  }

  // =========================================================================
  // V3 Only — STAGE 4: Independent Accuracy & Grounding Auditor (4th Model Call)
  // Receives BOTH the original policy text (<UNTRUSTED_POLICY_TEXT>) AND
  // Stage 3's complete unverified candidate JSON (<CANDIDATE_ANALYSIS_JSON>)
  // =========================================================================
  const stage4Template = templates.v3.stage4;
  const stage3CandidateJsonString = JSON.stringify(stage3CandidateValidated, null, 2);

  const stage4UserPrompt = stage4Template.userPromptTemplate
    .replace('{{POLICY_TEXT}}', () => cleanPolicyText)
    .replace('{{STAGE_3_CANDIDATE_JSON}}', () => stage3CandidateJsonString);

  const stage4InputVerification = {
    receivedOriginalPolicyText:
      stage4UserPrompt.includes('<UNTRUSTED_POLICY_TEXT>') &&
      stage4UserPrompt.includes(cleanPolicyText),
    originalPolicyCharLength: cleanPolicyText.length,
    receivedStage3CandidateJson:
      stage4UserPrompt.includes('<CANDIDATE_ANALYSIS_JSON>') &&
      stage4UserPrompt.includes(stage3CandidateJsonString),
    stage3CandidateJsonCharLength: stage3CandidateJsonString.length,
    stage3CandidateVerificationStatus:
      stage3CandidateValidated.verificationAudit.verificationStatus
  };

  const stage4Res = await executeStageCall(providerInstance, 'stage4_independent_verification', {
    systemPrompt: stage4Template.systemPrompt,
    userPrompt: stage4UserPrompt,
    jsonMode: true,
    jsonSchema: STAGE4_VERIFIED_JSON_SCHEMA,
    temperature,
    model: options.model,
    timeoutMs: options.timeoutMs
  });

  const stage4Verified = parseAndValidateStageJson(
    stage4Res.text,
    stage4VerifiedSchema,
    'stage4_independent_verification'
  );

  stagesMetadata.push({
    stageNumber: 4,
    stageName: 'stage4_independent_verification',
    model: stage4Res.model,
    durationMs: stage4Res.durationMs,
    usage: stage4Res.usage,
    jsonMode: true,
    validationPassed: true,
    unsupportedClaimsRemoved: stage4Verified.verificationAudit.unsupportedClaimsRemoved,
    stage4InputVerification
  });

  return {
    promptVersion: 'v3',
    provider: stage4Res.provider || providerInstance.providerName || 'gemini',
    model: stage4Res.model,
    modelCallCount: stagesMetadata.length,
    totalDurationMs: Date.now() - pipelineStartTime,
    totalUsage: aggregateTokenUsage(stagesMetadata),
    rawText: null,
    analysis: stage4Verified,
    stages: stagesMetadata,
    intermediateOutputs: {
      stage1Extraction: stage1Validated,
      stage2Analysis: stage2Validated,
      stage3UnverifiedCandidate: stage3CandidateValidated,
      stage4InputVerification
    }
  };
}

module.exports = {
  runPromptAnalysis,
  loadPromptTemplates,
  normalizeV1Output,
  parseAndValidateStageJson
};
