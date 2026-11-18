const { z } = require('zod');

/**
 * PrivacyLens — Zod Output Validation Schemas (Task 1.2)
 *
 * Implements strict runtime validation matching the canonical schemas defined in:
 * - prompts/versions/chained-v2.md (Stage 1, Stage 2, Stage 3)
 * - prompts/versions/verified-v3.md (Stage 4)
 * - prompts/prompt-workflow.md (Unified PrivacyLensUnifiedAnalysis Schema)
 */

const nonEmptyString = z.string().trim().min(1, 'Field must be a non-empty string');

const specifiedStatusEnum = z.enum(['Specified', 'Not specified']);

const clauseCategoryEnum = z.enum([
  'DATA_COLLECTION',
  'DATA_USAGE',
  'THIRD_PARTY_SHARING',
  'USER_RIGHTS',
  'DATA_RETENTION',
  'CONCERNING_OR_BROAD'
]);

const clauseClassificationEnum = z.enum([
  'Explicitly Stated Term',
  'Potentially Concerning / Broad Wording'
]);

const verificationStatusEnum = z.enum([
  'unverified_baseline',
  'unverified_candidate',
  'verified_by_stage4'
]);

/**
 * 1. Stage 1 Output Schema: Verbatim Clause Extraction & Taxonomy Tagging
 */
const stage1ExtractedClauseSchema = z.object({
  clauseId: nonEmptyString,
  sectionHeading: nonEmptyString,
  categories: z.array(clauseCategoryEnum).min(1, 'At least one taxonomy category is required'),
  verbatimExcerpt: nonEmptyString
});

const stage1ExtractionSchema = z.object({
  extractedClauses: z.array(stage1ExtractedClauseSchema),
  unmentionedCategories: z.array(clauseCategoryEnum)
});

/**
 * 2. Stage 2 Output Schema: Structured Privacy & Clause Analysis
 */
const stage2AnalysisSchema = z.object({
  collectedDataAndPurposes: z.object({
    status: specifiedStatusEnum,
    items: z.array(
      z.object({
        clauseId: nonEmptyString,
        category: nonEmptyString,
        dataTypes: z.array(nonEmptyString).min(1, 'At least one dataType entry is required'),
        statedPurpose: nonEmptyString,
        supportingExcerpt: nonEmptyString
      })
    )
  }),
  dataUsagePurposes: z.object({
    status: specifiedStatusEnum,
    purposes: z.array(
      z.object({
        clauseId: nonEmptyString,
        purpose: nonEmptyString,
        details: nonEmptyString,
        supportingExcerpt: nonEmptyString
      })
    )
  }),
  thirdPartySharing: z.object({
    status: specifiedStatusEnum,
    disclosures: z.array(
      z.object({
        clauseId: nonEmptyString,
        recipientCategory: nonEmptyString,
        sharedData: nonEmptyString,
        purpose: nonEmptyString,
        supportingExcerpt: nonEmptyString
      })
    )
  }),
  userRightsAndRetention: z.object({
    userRightsStatus: specifiedStatusEnum,
    dataRetentionStatus: specifiedStatusEnum,
    retentionDetails: nonEmptyString,
    rights: z.array(
      z.object({
        clauseId: nonEmptyString,
        right: nonEmptyString,
        howToExercise: nonEmptyString,
        limitations: nonEmptyString,
        supportingExcerpt: nonEmptyString
      })
    )
  }),
  notableOrConcerningClauses: z.array(
    z.object({
      clauseId: nonEmptyString,
      topic: nonEmptyString,
      classification: clauseClassificationEnum,
      statedPolicyFact: nonEmptyString,
      implicationOrAttentionReason: nonEmptyString,
      supportingExcerpt: nonEmptyString
    })
  ),
  missingTopics: z.array(
    z.object({
      topic: nonEmptyString,
      groundedExplanation: nonEmptyString
    })
  )
});

/**
 * 3. Unified Output Schema: PrivacyLensUnifiedAnalysis (V1 Normalized, V2 Stage 3, V3 Stage 4)
 */
const unifiedAnalysisSchema = z.object({
  promptVersion: z.enum(['v1', 'v2', 'v3']),
  summary: z.object({
    overview: nonEmptyString,
    keyTakeaways: z.array(nonEmptyString).min(1, 'At least one keyTakeaway is required')
  }),
  dataCollection: z.object({
    status: specifiedStatusEnum,
    items: z.array(
      z.object({
        clauseId: nonEmptyString,
        category: nonEmptyString,
        dataTypes: z.array(nonEmptyString).min(1, 'At least one dataType entry is required'),
        purpose: nonEmptyString,
        supportingExcerpt: nonEmptyString
      })
    )
  }),
  dataUsage: z.object({
    status: specifiedStatusEnum,
    purposes: z.array(
      z.object({
        clauseId: nonEmptyString,
        purpose: nonEmptyString,
        plainExplanation: nonEmptyString,
        supportingExcerpt: nonEmptyString
      })
    )
  }),
  thirdPartySharing: z.object({
    status: specifiedStatusEnum,
    disclosures: z.array(
      z.object({
        clauseId: nonEmptyString,
        recipientCategory: nonEmptyString,
        sharedData: nonEmptyString,
        purpose: nonEmptyString,
        plainExplanation: nonEmptyString,
        supportingExcerpt: nonEmptyString
      })
    )
  }),
  userRightsAndRetention: z.object({
    userRightsStatus: specifiedStatusEnum,
    dataRetentionStatus: specifiedStatusEnum,
    retentionSummary: nonEmptyString,
    rights: z.array(
      z.object({
        clauseId: nonEmptyString,
        right: nonEmptyString,
        howToExercise: nonEmptyString,
        limitations: nonEmptyString,
        plainExplanation: nonEmptyString,
        supportingExcerpt: nonEmptyString
      })
    )
  }),
  concerningOrUnclearClauses: z.array(
    z.object({
      clauseId: nonEmptyString,
      topic: nonEmptyString,
      classification: clauseClassificationEnum,
      plainExplanation: nonEmptyString,
      whyItMatters: nonEmptyString,
      supportingExcerpt: nonEmptyString
    })
  ),
  missingInformation: z.array(
    z.object({
      topic: nonEmptyString,
      status: z.literal('Not specified'),
      explanation: nonEmptyString
    })
  ),
  verificationAudit: z.object({
    verificationStatus: verificationStatusEnum,
    verified: z.boolean(),
    unsupportedClaimsRemoved: z.number().int().min(0),
    auditNotes: z.array(nonEmptyString)
  })
});

/**
 * 3a. V1 Normalized Baseline Schema Refinement
 */
const v1NormalizedSchema = unifiedAnalysisSchema.superRefine((data, ctx) => {
  if (data.promptVersion !== 'v1') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['promptVersion'],
      message: 'V1 normalized output must have promptVersion="v1"'
    });
  }
  if (data.verificationAudit.verificationStatus !== 'unverified_baseline') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verificationAudit', 'verificationStatus'],
      message: 'V1 normalized output must have verificationStatus="unverified_baseline"'
    });
  }
  if (data.verificationAudit.verified !== false) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verificationAudit', 'verified'],
      message: 'V1 normalized output must have verified=false'
    });
  }
});

/**
 * 3b. Stage 3 Output Schema (Prompt V2 Unverified Candidate Refinement)
 */
const stage3CandidateSchema = unifiedAnalysisSchema.superRefine((data, ctx) => {
  if (data.promptVersion !== 'v2') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['promptVersion'],
      message: 'Stage 3 candidate output must have promptVersion="v2"'
    });
  }
  if (data.verificationAudit.verificationStatus !== 'unverified_candidate') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verificationAudit', 'verificationStatus'],
      message: 'Stage 3 candidate output must have verificationStatus="unverified_candidate"'
    });
  }
  if (data.verificationAudit.verified !== false) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verificationAudit', 'verified'],
      message: 'Stage 3 candidate output must have verified=false'
    });
  }
});

/**
 * 4. Stage 4 Output Schema (Prompt V3 Independently Verified Output Refinement)
 */
const stage4VerifiedSchema = unifiedAnalysisSchema.superRefine((data, ctx) => {
  if (data.promptVersion !== 'v3') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['promptVersion'],
      message: 'Stage 4 verified output must have promptVersion="v3"'
    });
  }
  if (data.verificationAudit.verificationStatus !== 'verified_by_stage4') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verificationAudit', 'verificationStatus'],
      message: 'Stage 4 verified output must have verificationStatus="verified_by_stage4"'
    });
  }
  if (data.verificationAudit.verified !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verificationAudit', 'verified'],
      message: 'Stage 4 verified output must have verified=true'
    });
  }
});

/**
 * Formats Zod validation issues into a safe, concise diagnostic list without exposing
 * raw policy content or input values.
 *
 * @param {import('zod').ZodError} zodError
 * @returns {Array<{ path: string, code: string, message: string }>}
 */
function formatSafeValidationIssues(zodError) {
  if (!zodError || !Array.isArray(zodError.issues)) {
    return [];
  }
  return zodError.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
    code: issue.code,
    message: issue.message
  }));
}

/**
 * JSON Schema equivalents of Stage 1, Stage 2, Stage 3 (V2), and Stage 4 (V3)
 * used by Ollama's native structured output grammar sampler (`format: jsonSchema`),
 * while all outputs remain strictly validated by the Zod schemas above.
 */
const nonEmptyStrJson = { type: 'string', minLength: 1 };
const specifiedEnumJson = { type: 'string', enum: ['Specified', 'Not specified'] };
const categoryEnumJson = {
  type: 'string',
  enum: [
    'DATA_COLLECTION',
    'DATA_USAGE',
    'THIRD_PARTY_SHARING',
    'USER_RIGHTS',
    'DATA_RETENTION',
    'CONCERNING_OR_BROAD'
  ]
};
const classificationEnumJson = {
  type: 'string',
  enum: ['Explicitly Stated Term', 'Potentially Concerning / Broad Wording']
};

const STAGE1_JSON_SCHEMA = {
  type: 'object',
  required: ['extractedClauses', 'unmentionedCategories'],
  additionalProperties: false,
  properties: {
    extractedClauses: {
      type: 'array',
      items: {
        type: 'object',
        required: ['clauseId', 'sectionHeading', 'categories', 'verbatimExcerpt'],
        additionalProperties: false,
        properties: {
          clauseId: nonEmptyStrJson,
          sectionHeading: nonEmptyStrJson,
          categories: {
            type: 'array',
            minItems: 1,
            items: categoryEnumJson
          },
          verbatimExcerpt: nonEmptyStrJson
        }
      }
    },
    unmentionedCategories: {
      type: 'array',
      items: categoryEnumJson
    }
  }
};

const STAGE2_JSON_SCHEMA = {
  type: 'object',
  required: [
    'collectedDataAndPurposes',
    'dataUsagePurposes',
    'thirdPartySharing',
    'userRightsAndRetention',
    'notableOrConcerningClauses',
    'missingTopics'
  ],
  additionalProperties: false,
  properties: {
    collectedDataAndPurposes: {
      type: 'object',
      required: ['status', 'items'],
      additionalProperties: false,
      properties: {
        status: specifiedEnumJson,
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['clauseId', 'category', 'dataTypes', 'statedPurpose', 'supportingExcerpt'],
            additionalProperties: false,
            properties: {
              clauseId: nonEmptyStrJson,
              category: nonEmptyStrJson,
              dataTypes: { type: 'array', minItems: 1, items: nonEmptyStrJson },
              statedPurpose: nonEmptyStrJson,
              supportingExcerpt: nonEmptyStrJson
            }
          }
        }
      }
    },
    dataUsagePurposes: {
      type: 'object',
      required: ['status', 'purposes'],
      additionalProperties: false,
      properties: {
        status: specifiedEnumJson,
        purposes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['clauseId', 'purpose', 'details', 'supportingExcerpt'],
            additionalProperties: false,
            properties: {
              clauseId: nonEmptyStrJson,
              purpose: nonEmptyStrJson,
              details: nonEmptyStrJson,
              supportingExcerpt: nonEmptyStrJson
            }
          }
        }
      }
    },
    thirdPartySharing: {
      type: 'object',
      required: ['status', 'disclosures'],
      additionalProperties: false,
      properties: {
        status: specifiedEnumJson,
        disclosures: {
          type: 'array',
          items: {
            type: 'object',
            required: ['clauseId', 'recipientCategory', 'sharedData', 'purpose', 'supportingExcerpt'],
            additionalProperties: false,
            properties: {
              clauseId: nonEmptyStrJson,
              recipientCategory: nonEmptyStrJson,
              sharedData: nonEmptyStrJson,
              purpose: nonEmptyStrJson,
              supportingExcerpt: nonEmptyStrJson
            }
          }
        }
      }
    },
    userRightsAndRetention: {
      type: 'object',
      required: ['userRightsStatus', 'dataRetentionStatus', 'retentionDetails', 'rights'],
      additionalProperties: false,
      properties: {
        userRightsStatus: specifiedEnumJson,
        dataRetentionStatus: specifiedEnumJson,
        retentionDetails: nonEmptyStrJson,
        rights: {
          type: 'array',
          items: {
            type: 'object',
            required: ['clauseId', 'right', 'howToExercise', 'limitations', 'supportingExcerpt'],
            additionalProperties: false,
            properties: {
              clauseId: nonEmptyStrJson,
              right: nonEmptyStrJson,
              howToExercise: nonEmptyStrJson,
              limitations: nonEmptyStrJson,
              supportingExcerpt: nonEmptyStrJson
            }
          }
        }
      }
    },
    notableOrConcerningClauses: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'clauseId',
          'topic',
          'classification',
          'statedPolicyFact',
          'implicationOrAttentionReason',
          'supportingExcerpt'
        ],
        additionalProperties: false,
        properties: {
          clauseId: nonEmptyStrJson,
          topic: nonEmptyStrJson,
          classification: classificationEnumJson,
          statedPolicyFact: nonEmptyStrJson,
          implicationOrAttentionReason: nonEmptyStrJson,
          supportingExcerpt: nonEmptyStrJson
        }
      }
    },
    missingTopics: {
      type: 'array',
      items: {
        type: 'object',
        required: ['topic', 'groundedExplanation'],
        additionalProperties: false,
        properties: {
          topic: nonEmptyStrJson,
          groundedExplanation: nonEmptyStrJson
        }
      }
    }
  }
};

function buildUnifiedJsonSchema(versionLiteral, statusLiteral, verifiedBoolean) {
  return {
    type: 'object',
    required: [
      'promptVersion',
      'summary',
      'dataCollection',
      'dataUsage',
      'thirdPartySharing',
      'userRightsAndRetention',
      'concerningOrUnclearClauses',
      'missingInformation',
      'verificationAudit'
    ],
    additionalProperties: false,
    properties: {
      promptVersion: { type: 'string', enum: [versionLiteral] },
      summary: {
        type: 'object',
        required: ['overview', 'keyTakeaways'],
        additionalProperties: false,
        properties: {
          overview: nonEmptyStrJson,
          keyTakeaways: { type: 'array', minItems: 1, items: nonEmptyStrJson }
        }
      },
      dataCollection: {
        type: 'object',
        required: ['status', 'items'],
        additionalProperties: false,
        properties: {
          status: specifiedEnumJson,
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['clauseId', 'category', 'dataTypes', 'purpose', 'supportingExcerpt'],
              additionalProperties: false,
              properties: {
                clauseId: nonEmptyStrJson,
                category: nonEmptyStrJson,
                dataTypes: { type: 'array', minItems: 1, items: nonEmptyStrJson },
                purpose: nonEmptyStrJson,
                supportingExcerpt: nonEmptyStrJson
              }
            }
          }
        }
      },
      dataUsage: {
        type: 'object',
        required: ['status', 'purposes'],
        additionalProperties: false,
        properties: {
          status: specifiedEnumJson,
          purposes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['clauseId', 'purpose', 'plainExplanation', 'supportingExcerpt'],
              additionalProperties: false,
              properties: {
                clauseId: nonEmptyStrJson,
                purpose: nonEmptyStrJson,
                plainExplanation: nonEmptyStrJson,
                supportingExcerpt: nonEmptyStrJson
              }
            }
          }
        }
      },
      thirdPartySharing: {
        type: 'object',
        required: ['status', 'disclosures'],
        additionalProperties: false,
        properties: {
          status: specifiedEnumJson,
          disclosures: {
            type: 'array',
            items: {
              type: 'object',
              required: [
                'clauseId',
                'recipientCategory',
                'sharedData',
                'purpose',
                'plainExplanation',
                'supportingExcerpt'
              ],
              additionalProperties: false,
              properties: {
                clauseId: nonEmptyStrJson,
                recipientCategory: nonEmptyStrJson,
                sharedData: nonEmptyStrJson,
                purpose: nonEmptyStrJson,
                plainExplanation: nonEmptyStrJson,
                supportingExcerpt: nonEmptyStrJson
              }
            }
          }
        }
      },
      userRightsAndRetention: {
        type: 'object',
        required: ['userRightsStatus', 'dataRetentionStatus', 'retentionSummary', 'rights'],
        additionalProperties: false,
        properties: {
          userRightsStatus: specifiedEnumJson,
          dataRetentionStatus: specifiedEnumJson,
          retentionSummary: nonEmptyStrJson,
          rights: {
            type: 'array',
            items: {
              type: 'object',
              required: [
                'clauseId',
                'right',
                'howToExercise',
                'limitations',
                'plainExplanation',
                'supportingExcerpt'
              ],
              additionalProperties: false,
              properties: {
                clauseId: nonEmptyStrJson,
                right: nonEmptyStrJson,
                howToExercise: nonEmptyStrJson,
                limitations: nonEmptyStrJson,
                plainExplanation: nonEmptyStrJson,
                supportingExcerpt: nonEmptyStrJson
              }
            }
          }
        }
      },
      concerningOrUnclearClauses: {
        type: 'array',
        items: {
          type: 'object',
          required: [
            'clauseId',
            'topic',
            'classification',
            'plainExplanation',
            'whyItMatters',
            'supportingExcerpt'
          ],
          additionalProperties: false,
          properties: {
            clauseId: nonEmptyStrJson,
            topic: nonEmptyStrJson,
            classification: classificationEnumJson,
            plainExplanation: nonEmptyStrJson,
            whyItMatters: nonEmptyStrJson,
            supportingExcerpt: nonEmptyStrJson
          }
        }
      },
      missingInformation: {
        type: 'array',
        items: {
          type: 'object',
          required: ['topic', 'status', 'explanation'],
          additionalProperties: false,
          properties: {
            topic: nonEmptyStrJson,
            status: { type: 'string', enum: ['Not specified'] },
            explanation: nonEmptyStrJson
          }
        }
      },
      verificationAudit: {
        type: 'object',
        required: ['verificationStatus', 'verified', 'unsupportedClaimsRemoved', 'auditNotes'],
        additionalProperties: false,
        properties: {
          verificationStatus: { type: 'string', enum: [statusLiteral] },
          verified: { type: 'boolean', enum: [verifiedBoolean] },
          unsupportedClaimsRemoved: { type: 'integer', minimum: 0 },
          auditNotes: { type: 'array', minItems: 1, items: nonEmptyStrJson }
        }
      }
    }
  };
}

const STAGE3_CANDIDATE_JSON_SCHEMA = buildUnifiedJsonSchema('v2', 'unverified_candidate', false);
const STAGE4_VERIFIED_JSON_SCHEMA = buildUnifiedJsonSchema('v3', 'verified_by_stage4', true);

module.exports = {
  clauseCategoryEnum,
  clauseClassificationEnum,
  specifiedStatusEnum,
  verificationStatusEnum,
  stage1ExtractionSchema,
  stage2AnalysisSchema,
  unifiedAnalysisSchema,
  v1NormalizedSchema,
  stage3CandidateSchema,
  stage4VerifiedSchema,
  STAGE1_JSON_SCHEMA,
  STAGE2_JSON_SCHEMA,
  STAGE3_CANDIDATE_JSON_SCHEMA,
  STAGE4_VERIFIED_JSON_SCHEMA,
  formatSafeValidationIssues
};
