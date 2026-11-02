# PrivacyLens — Prompt Engineering Workflow & Schema Specification

**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Problem Statement:** C18 — Terms and Conditions in Plain Language  
**Team:** ladybug

---

## 1. Overview of the Three Prompt Versions

PrivacyLens investigates how progressive prompt engineering architectures improve accuracy, completeness, evidence grounding, and hallucination control when analyzing website privacy policies.

| Feature / Dimension | Prompt V1 (`baseline-v1.md`) | Prompt V2 (`chained-v2.md`) | Prompt V3 (`verified-v3.md`) |
| :--- | :--- | :--- | :--- |
| **Architecture Type** | Single-Pass Zero-Shot Prompt | 3-Stage Sequential Prompt Chain | 4-Stage Chained + Independent Verification Pipeline |
| **Number of LLM Stages** | 1 Stage | 3 Stages (Extract $\rightarrow$ Analyze $\rightarrow$ Simplify) | 4 Stages (Extract $\rightarrow$ Analyze $\rightarrow$ Simplify $\rightarrow$ Verify) |
| **Verification Status** | Unverified Baseline (`verificationStatus: "unverified_baseline"`, `verified: false`) | **Unverified Candidate Output** (`verificationStatus: "unverified_candidate"`, `verified: false`) | **Independently Verified Output** (`verificationStatus: "verified_by_stage4"`, `verified: true`) |
| **Clause & Excerpt Grounding** | Implicit instruction (*"Base your answer only on the provided policy"*) | Stage 1 extracts verbatim quotes (`verbatimExcerpt`) with `clauseId`s propagated through Stages 2 & 3 | Stage 4 independently verifies every factual claim and checks every `supportingExcerpt` verbatim against `<UNTRUSTED_POLICY_TEXT>` |
| **Missing Info Handling** | Asks model to *"mention if any information is missing"* | Detects `unmentionedCategories` in Stage 1 and converts them to `missingInformation` in Stage 3 | Enforces `"Not specified"` across all omitted fields and audits `missingInformation` explanations so no unmentioned data categories are introduced |
| **Epistemic Framing** | General bullet points for *"clauses that may be risky or unclear"* | Classifies clauses into `Explicitly Stated Term` vs. `Potentially Concerning / Broad Wording` | Independently audits the 4-way distinction: (1) Explicitly stated terms, (2) Potentially concerning/broad wording, (3) `"Not specified"` info, and (4) Conditional implications never presented as confirmed facts |
| **Prompt Versioning File** | [`versions/baseline-v1.md`](./versions/baseline-v1.md) *(preserved verbatim)* | [`versions/chained-v2.md`](./versions/chained-v2.md) | [`versions/verified-v3.md`](./versions/verified-v3.md) |

---

## 2. Four-Way Epistemic & Analytical Distinction

To prevent overclaiming, hallucination, or legal advice, the PrivacyLens prompt workflow strictly separates four distinct categories of statements:

1. **Explicitly Stated Policy Terms (`"Explicitly Stated Term"`):**
   - Facts, obligations, waivers, or restrictions that are written directly in the policy text (e.g., *"you waive the right to participate in any class-action lawsuit"* or *"copies of notes that have already been incorporated into our aggregated machine-learning training sets cannot be retroactively removed after deletion"*).
   - Reported factually in `plainExplanation` with an exact `supportingExcerpt`.
2. **Potentially Concerning or Broad Wording (`"Potentially Concerning / Broad Wording"`):**
   - Open-ended, vague, or permissive phrasing (e.g., *"we may also transfer user account data... in the event of a merger, reorganization, or asset sale"* or *"modify this Privacy Policy at any time at our sole discretion"*).
   - Flagged because the wording grants broad future latitude or creates uncertainty for the user, **not** as proof that harmful misuse has already occurred.
3. **Information That Is Not Specified (`"Not specified"`):**
   - Privacy topics or sub-details completely omitted from the provided policy text (for example, when a policy states what data is collected and how to request deletion, but omits how long account profile data is retained prior to deletion).
   - Must be marked explicitly as `"Not specified"`, and its `missingInformation` explanation must reference **only** the omitted dimension or data categories explicitly named in the source policy—never inventing or mentioning external data categories.
4. **Interpretations or Implications (Must Not Be Presented as Confirmed Facts):**
   - While `plainExplanation` states *only* what the clause says, `whyItMatters` explains why a user may care about the clause. Any downstream implication in `whyItMatters` must be framed conditionally (e.g., *"Because the policy allows changes without prior individual notice, users could become subject to updated terms without receiving a direct alert"*), and must **never** be stated as a confirmed fact or guaranteed company action.

---

## 3. Unified Structured JSON Output Schema

All three prompt versions map to a single **Unified PrivacyLens JSON Output Schema** (`PrivacyLensUnifiedAnalysis`) wherever structured output is used:

- **Prompt V1 (`promptVersion: "v1"`):** Preserves the exact prompt text in [`versions/baseline-v1.md`](./versions/baseline-v1.md). When structured JSON output is requested for cross-version evaluation, the schema contract is appended as an output formatting wrapper with `verificationAudit.verificationStatus: "unverified_baseline"` and `verificationAudit.verified: false`.
- **Prompt V2 (`promptVersion: "v2"`):** Stage 3 outputs the unified JSON schema as an **unverified candidate** (`verificationAudit.verificationStatus: "unverified_candidate"`, `verificationAudit.verified: false`). V2 never claims that independent verification has occurred.
- **Prompt V3 (`promptVersion: "v3"`):** Stage 4 audits V2's unverified candidate against the raw policy text and outputs the **verified report** (`verificationAudit.verificationStatus: "verified_by_stage4"`, `verificationAudit.verified: true`).

### Canonical JSON Schema Definition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PrivacyLensUnifiedAnalysis",
  "type": "object",
  "required": [
    "promptVersion",
    "summary",
    "dataCollection",
    "dataUsage",
    "thirdPartySharing",
    "userRightsAndRetention",
    "concerningOrUnclearClauses",
    "missingInformation",
    "verificationAudit"
  ],
  "properties": {
    "promptVersion": {
      "type": "string",
      "enum": ["v1", "v2", "v3"]
    },
    "summary": {
      "type": "object",
      "required": ["overview", "keyTakeaways"],
      "properties": {
        "overview": { "type": "string" },
        "keyTakeaways": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "dataCollection": {
      "type": "object",
      "required": ["status", "items"],
      "properties": {
        "status": { "type": "string", "enum": ["Specified", "Not specified"] },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["clauseId", "category", "dataTypes", "purpose", "supportingExcerpt"],
            "properties": {
              "clauseId": { "type": "string" },
              "category": { "type": "string" },
              "dataTypes": { "type": "array", "items": { "type": "string" } },
              "purpose": { "type": "string" },
              "supportingExcerpt": { "type": "string" }
            }
          }
        }
      }
    },
    "dataUsage": {
      "type": "object",
      "required": ["status", "purposes"],
      "properties": {
        "status": { "type": "string", "enum": ["Specified", "Not specified"] },
        "purposes": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["clauseId", "purpose", "plainExplanation", "supportingExcerpt"],
            "properties": {
              "clauseId": { "type": "string" },
              "purpose": { "type": "string" },
              "plainExplanation": { "type": "string" },
              "supportingExcerpt": { "type": "string" }
            }
          }
        }
      }
    },
    "thirdPartySharing": {
      "type": "object",
      "required": ["status", "disclosures"],
      "properties": {
        "status": { "type": "string", "enum": ["Specified", "Not specified"] },
        "disclosures": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "clauseId",
              "recipientCategory",
              "sharedData",
              "purpose",
              "plainExplanation",
              "supportingExcerpt"
            ],
            "properties": {
              "clauseId": { "type": "string" },
              "recipientCategory": { "type": "string" },
              "sharedData": { "type": "string" },
              "purpose": { "type": "string" },
              "plainExplanation": { "type": "string" },
              "supportingExcerpt": { "type": "string" }
            }
          }
        }
      }
    },
    "userRightsAndRetention": {
      "type": "object",
      "required": ["userRightsStatus", "dataRetentionStatus", "retentionSummary", "rights"],
      "properties": {
        "userRightsStatus": { "type": "string", "enum": ["Specified", "Not specified"] },
        "dataRetentionStatus": { "type": "string", "enum": ["Specified", "Not specified"] },
        "retentionSummary": { "type": "string" },
        "rights": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "clauseId",
              "right",
              "howToExercise",
              "limitations",
              "plainExplanation",
              "supportingExcerpt"
            ],
            "properties": {
              "clauseId": { "type": "string" },
              "right": { "type": "string" },
              "howToExercise": { "type": "string" },
              "limitations": { "type": "string" },
              "plainExplanation": { "type": "string" },
              "supportingExcerpt": { "type": "string" }
            }
          }
        }
      }
    },
    "concerningOrUnclearClauses": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "clauseId",
          "topic",
          "classification",
          "plainExplanation",
          "whyItMatters",
          "supportingExcerpt"
        ],
        "properties": {
          "clauseId": { "type": "string" },
          "topic": { "type": "string" },
          "classification": {
            "type": "string",
            "enum": [
              "Explicitly Stated Term",
              "Potentially Concerning / Broad Wording"
            ]
          },
          "plainExplanation": { "type": "string" },
          "whyItMatters": { "type": "string" },
          "supportingExcerpt": { "type": "string" }
        }
      }
    },
    "missingInformation": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["topic", "status", "explanation"],
        "properties": {
          "topic": { "type": "string" },
          "status": { "type": "string", "enum": ["Not specified"] },
          "explanation": { "type": "string" }
        }
      }
    },
    "verificationAudit": {
      "type": "object",
      "required": ["verificationStatus", "verified", "unsupportedClaimsRemoved", "auditNotes"],
      "properties": {
        "verificationStatus": {
          "type": "string",
          "enum": ["unverified_baseline", "unverified_candidate", "verified_by_stage4"]
        },
        "verified": { "type": "boolean" },
        "unsupportedClaimsRemoved": { "type": "integer", "minimum": 0 },
        "auditNotes": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

---

## 4. Stage-by-Stage Data Flow Contract

| Stage | Applicable Versions | Input | Processing Task | Output |
| :--- | :---: | :--- | :--- | :--- |
| **Stage 1: Clause Extraction** | V2, V3 | Raw policy text inside `<UNTRUSTED_POLICY_TEXT>` | Extracts verbatim sentences (`verbatimExcerpt`), assigns `clauseId` & taxonomy tags, lists `unmentionedCategories`. | `Stage1_ExtractedClauses` JSON |
| **Stage 2: Structured Analysis** | V2, V3 | `Stage1_ExtractedClauses` JSON | Maps data types to purposes, structures third-party sharing & user rights, classifies `Explicitly Stated Term` vs. `Potentially Concerning / Broad Wording`, records grounded `missingTopics`. | `Stage2_StructuredAnalysis` JSON |
| **Stage 3: Plain-Language Synthesis** | V2, V3 | `Stage2_StructuredAnalysis` JSON | Translates structured findings into plain language and outputs an **unverified candidate** in the Unified Schema (`verificationStatus: "unverified_candidate"`, `verified: false`). | Unverified Candidate Unified JSON (`promptVersion: "v2"`) |
| **Stage 4: Independent Verification** | V3 only | Raw `<UNTRUSTED_POLICY_TEXT>` + Stage 3 Candidate JSON | Independently checks every factual claim, every `supportingExcerpt`, and every `missingInformation` explanation against the source policy; removes unsupported claims; outputs **verified report** (`verificationStatus: "verified_by_stage4"`, `verified: true`). | Verified Unified JSON (`promptVersion: "v3"`) |

---

## 5. End-to-End Walkthrough Example: Processing Policy Clauses Across Stages

Below is a strictly grounded trace showing how Sections 4 and 5 from our synthetic test policy ([`../evaluation/test-cases/synthetic-policy.json`](../evaluation/test-cases/synthetic-policy.json)) flow through Stages 1, 2, 3 (**Prompt V2 Unverified Candidate**), and Stage 4 (**Prompt V3 Independently Verified Output**).

### Raw Input Policy Excerpt (from `SYNTH-001`, Sections 4 & 5)
> *"4. USER RIGHTS AND CHOICES*  
> *You may request a copy of your account profile data or ask us to delete your account by emailing privacy-requests@novanote.example. However, copies of notes that have already been incorporated into our aggregated machine-learning training sets cannot be retroactively removed after deletion.*  
>  
> *5. POLICY UPDATES AND DISPUTES*  
> *We reserve the right to modify this Privacy Policy at any time at our sole discretion without prior individual notice; continued use of NovaNote constitutes acceptance of any updated terms."*

*(Note: This excerpt states how users can request a copy of their account profile data or ask to delete their account, states an exception for copies of notes already incorporated into aggregated machine-learning training sets, and states that the policy can be modified at the company's sole discretion without prior individual notice. It does **not** specify how long account profile data is retained before a user requests deletion.)*

---

### Step 1 — Stage 1 Output (`Stage1_ExtractedClauses`)
Stage 1 extracts exact, word-for-word sentences from the input text, assigns `clauseId` values and category tags, and identifies that `DATA_RETENTION` is not mentioned in the provided text:

```json
{
  "extractedClauses": [
    {
      "clauseId": "CL-04",
      "sectionHeading": "4. USER RIGHTS AND CHOICES",
      "categories": ["USER_RIGHTS"],
      "verbatimExcerpt": "You may request a copy of your account profile data or ask us to delete your account by emailing privacy-requests@novanote.example."
    },
    {
      "clauseId": "CL-05",
      "sectionHeading": "4. USER RIGHTS AND CHOICES",
      "categories": ["USER_RIGHTS", "DATA_USAGE", "CONCERNING_OR_BROAD"],
      "verbatimExcerpt": "However, copies of notes that have already been incorporated into our aggregated machine-learning training sets cannot be retroactively removed after deletion."
    },
    {
      "clauseId": "CL-06",
      "sectionHeading": "5. POLICY UPDATES AND DISPUTES",
      "categories": ["CONCERNING_OR_BROAD"],
      "verbatimExcerpt": "We reserve the right to modify this Privacy Policy at any time at our sole discretion without prior individual notice; continued use of NovaNote constitutes acceptance of any updated terms."
    }
  ],
  "unmentionedCategories": [
    "DATA_RETENTION"
  ]
}
```

---

### Step 2 — Stage 2 Output (`Stage2_StructuredAnalysis`)
Stage 2 consumes **only** the Stage 1 JSON. It structures the user rights and limitations, distinguishes between the `Explicitly Stated Term` (`CL-05`) and the `Potentially Concerning / Broad Wording` (`CL-06`), and records the omitted data retention period strictly in terms of the data mentioned in the clauses (`account profile data`):

```json
{
  "userRightsAndRetention": {
    "userRightsStatus": "Specified",
    "dataRetentionStatus": "Not specified",
    "retentionDetails": "Not specified",
    "rights": [
      {
        "clauseId": "CL-04",
        "right": "Request a copy of account profile data or request account deletion",
        "howToExercise": "Email privacy-requests@novanote.example",
        "limitations": "Copies of notes that have already been incorporated into aggregated machine-learning training sets cannot be retroactively removed after deletion (see CL-05).",
        "supportingExcerpt": "You may request a copy of your account profile data or ask us to delete your account by emailing privacy-requests@novanote.example."
      }
    ]
  },
  "notableOrConcerningClauses": [
    {
      "clauseId": "CL-05",
      "topic": "Exception to Deletion for Notes in Aggregated ML Training Sets",
      "classification": "Explicitly Stated Term",
      "statedPolicyFact": "The policy explicitly states that copies of notes already incorporated into aggregated machine-learning training sets cannot be retroactively removed after account deletion.",
      "implicationOrAttentionReason": "Users requesting account deletion should be aware that this stated exception prevents the removal of note copies already incorporated into those aggregated training sets.",
      "supportingExcerpt": "However, copies of notes that have already been incorporated into our aggregated machine-learning training sets cannot be retroactively removed after deletion."
    },
    {
      "clauseId": "CL-06",
      "topic": "Broad Discretion to Modify Policy Without Prior Individual Notice",
      "classification": "Potentially Concerning / Broad Wording",
      "statedPolicyFact": "The company reserves the right to modify the Privacy Policy at any time at its sole discretion without prior individual notice, and continued use constitutes acceptance.",
      "implicationOrAttentionReason": "This broad wording gives the company latitude to change policy terms at any time; because prior individual notice is not required, users might not realize when terms have changed if they continue using the service.",
      "supportingExcerpt": "We reserve the right to modify this Privacy Policy at any time at our sole discretion without prior individual notice; continued use of NovaNote constitutes acceptance of any updated terms."
    }
  ],
  "missingTopics": [
    {
      "topic": "Data Retention Period",
      "groundedExplanation": "While the policy specifies that copies of notes already incorporated into aggregated machine-learning training sets cannot be removed after deletion, it does not specify how long standard account profile data is retained before deletion."
    }
  ]
}
```

---

### Step 3 — Stage 3 Output (Prompt V2 Final Unverified Candidate Output)
Stage 3 translates the Stage 2 analysis into everyday language and formats it into the Unified Schema (`promptVersion: "v2"`). Because Stage 3 is an **unverified candidate** (`verificationStatus: "unverified_candidate"`, `verified: false`), suppose that during simplification the model introduces two subtle grounding errors:
1. In `CL-05`, it presents a speculative interpretation as a confirmed fact (*"and those notes will be visible to other users"*).
2. In `missingInformation`, it carelessly adds an unmentioned data category (*"or billing history"*), which does not appear anywhere in the input excerpt.

```json
{
  "promptVersion": "v2",
  "userRightsAndRetention": {
    "userRightsStatus": "Specified",
    "dataRetentionStatus": "Not specified",
    "retentionSummary": "Not specified",
    "rights": [
      {
        "clauseId": "CL-04",
        "right": "Request a copy of your account profile data or delete your account",
        "howToExercise": "Email privacy-requests@novanote.example",
        "limitations": "Copies of notes already incorporated into aggregated machine-learning training sets cannot be removed after deletion.",
        "plainExplanation": "You can email NovaNote to get a copy of your account profile data or ask them to delete your account, though copies of notes already added to their aggregated machine-learning training sets cannot be removed after deletion.",
        "supportingExcerpt": "You may request a copy of your account profile data or ask us to delete your account by emailing privacy-requests@novanote.example."
      }
    ]
  },
  "concerningOrUnclearClauses": [
    {
      "clauseId": "CL-05",
      "topic": "Notes in Aggregated ML Training Sets Cannot Be Removed After Deletion",
      "classification": "Explicitly Stated Term",
      "plainExplanation": "Even if you delete your account, copies of notes that were already added to NovaNote's aggregated machine-learning training sets cannot be removed afterward, and those notes will be visible to other users.",
      "whyItMatters": "This is an explicitly stated exception to account deletion: copies of notes already incorporated into the aggregated training sets remain there even after you close your account.",
      "supportingExcerpt": "However, copies of notes that have already been incorporated into our aggregated machine-learning training sets cannot be retroactively removed after deletion."
    },
    {
      "clauseId": "CL-06",
      "topic": "Policy Changes at Any Time Without Individual Notice",
      "classification": "Potentially Concerning / Broad Wording",
      "plainExplanation": "The policy states that NovaNote can change its Privacy Policy at any time at its sole discretion without notifying users individually, and continuing to use the service counts as accepting the new terms.",
      "whyItMatters": "This broad wording gives the company wide discretion to update terms in the future. It does not confirm that harmful changes have been made, but it means users could be bound by updated terms without receiving a direct notice.",
      "supportingExcerpt": "We reserve the right to modify this Privacy Policy at any time at our sole discretion without prior individual notice; continued use of NovaNote constitutes acceptance of any updated terms."
    }
  ],
  "missingInformation": [
    {
      "topic": "Data Retention Period",
      "status": "Not specified",
      "explanation": "The policy does not specify how long account profile data or billing history is retained prior to an account deletion request."
    }
  ],
  "verificationAudit": {
    "verificationStatus": "unverified_candidate",
    "verified": false,
    "unsupportedClaimsRemoved": 0,
    "auditNotes": [
      "Unverified candidate output generated by Prompt V2 (Stages 1-3). Independent verification against the original source policy has not been performed."
    ]
  }
}
```

---

### Step 4 — Stage 4 Output (Prompt V3 Independently Verified Output)
In **Prompt V3**, Stage 4 independently compares every factual claim, every `supportingExcerpt`, and every `missingInformation` explanation in the Stage 3 candidate against the original `<UNTRUSTED_POLICY_TEXT>`:
1. It catches and removes the unsupported claim in `CL-05` (*", and those notes will be visible to other users"*), which was an ungrounded interpretation presented as fact.
2. It catches and removes the unmentioned data category in `missingInformation` (*"or billing history"*), ensuring the missing-information explanation is strictly grounded in the source text (`account profile data`).
3. It verifies that every `supportingExcerpt` matches the source text word-for-word and marks the final output as `verificationStatus: "verified_by_stage4"`, `verified: true`, with `unsupportedClaimsRemoved: 2`.

```json
{
  "promptVersion": "v3",
  "userRightsAndRetention": {
    "userRightsStatus": "Specified",
    "dataRetentionStatus": "Not specified",
    "retentionSummary": "Not specified",
    "rights": [
      {
        "clauseId": "CL-04",
        "right": "Request a copy of your account profile data or delete your account",
        "howToExercise": "Email privacy-requests@novanote.example",
        "limitations": "Copies of notes already incorporated into aggregated machine-learning training sets cannot be retroactively removed after deletion.",
        "plainExplanation": "You can email NovaNote to get a copy of your account profile data or ask them to delete your account, though copies of notes already added to their aggregated machine-learning training sets cannot be removed after deletion.",
        "supportingExcerpt": "You may request a copy of your account profile data or ask us to delete your account by emailing privacy-requests@novanote.example."
      }
    ]
  },
  "concerningOrUnclearClauses": [
    {
      "clauseId": "CL-05",
      "topic": "Notes in Aggregated ML Training Sets Cannot Be Removed After Deletion",
      "classification": "Explicitly Stated Term",
      "plainExplanation": "Even if you delete your account, copies of notes that have already been incorporated into NovaNote's aggregated machine-learning training sets cannot be removed afterward.",
      "whyItMatters": "This is an explicitly stated exception to account deletion: copies of notes already incorporated into the aggregated training sets remain there even after you close your account.",
      "supportingExcerpt": "However, copies of notes that have already been incorporated into our aggregated machine-learning training sets cannot be retroactively removed after deletion."
    },
    {
      "clauseId": "CL-06",
      "topic": "Policy Changes at Any Time Without Individual Notice",
      "classification": "Potentially Concerning / Broad Wording",
      "plainExplanation": "The policy states that NovaNote can change its Privacy Policy at any time at its sole discretion without notifying users individually, and continuing to use the service counts as accepting the new terms.",
      "whyItMatters": "This broad wording gives the company wide discretion to update terms in the future. It does not confirm that harmful changes have been made, but it means users could be bound by updated terms without receiving a direct notice.",
      "supportingExcerpt": "We reserve the right to modify this Privacy Policy at any time at our sole discretion without prior individual notice; continued use of NovaNote constitutes acceptance of any updated terms."
    }
  ],
  "missingInformation": [
    {
      "topic": "Data Retention Period",
      "status": "Not specified",
      "explanation": "While the policy states that copies of notes already incorporated into aggregated machine-learning training sets cannot be removed after deletion, it does not specify how long account profile data is retained prior to an account deletion request."
    }
  ],
  "verificationAudit": {
    "verificationStatus": "verified_by_stage4",
    "verified": true,
    "unsupportedClaimsRemoved": 2,
    "auditNotes": [
      "Removed unsupported claim in CL-05 ('and those notes will be visible to other users') which presented an ungrounded interpretation as a confirmed fact.",
      "Removed reference to unmentioned data category ('or billing history') in missingInformation explanation so it references only 'account profile data' present in the source text.",
      "Independently verified that all supportingExcerpt values match <UNTRUSTED_POLICY_TEXT> verbatim.",
      "Confirmed four-way distinction between Explicitly Stated Term (CL-05), Potentially Concerning / Broad Wording (CL-06), Not specified retention duration, and conditional implications."
    ]
  }
}
```
