# PrivacyLens — Phase 4 Evaluation Protocol

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Status:** Protocol Specification (No Live Experimental Results Fabricated)

---

## 1. Core Protocol Principles

This protocol governs how **Prompt V1 (`baseline-v1`)**, **Prompt V2 (`chained-v2`)**, and **Prompt V3 (`verified-v3`)** are evaluated across our prepared benchmarks without modifying the prompt templates in `prompts/versions/` or the dataset files in `evaluation/dataset/`.

Every evaluation run must satisfy five methodological guarantees:
1. **Identical Input Policy Text & Decoding Conditions** across V1, V2, and V3.
2. **Strict Disjoint Platform Partitioning** (zero overlap between development/calibration platforms and held-out evaluation platforms).
3. **Multi-Label Clause Evaluation** that credits models for identifying all applicable categories on overlapping clauses.
4. **Open-World / Partial-Annotation Grounding** so human annotations for `GenData`, `GenUse`, and `NoDist` are never misinterpreted as complete ground truth for unannotated dimensions (`Third-Party Sharing`, `User Rights`, `Data Retention`).
5. **Non-Invasive Output Normalization** that evaluates V1's native bulleted prose fairly alongside V2's unverified candidate JSON and V3's verified JSON without altering `baseline-v1.md`.

---

## 2. Benchmark Tiers & Disjoint Platform Partitioning (No Dev/Eval Overlap)

To prevent data leakage or prompt overfitting, the dataset is partitioned **at the platform level** (never splitting clauses from the same company across development and evaluation sets).

| Partition Name | Purpose | Platforms Included | Consensus Clauses (`requires_human_review = False`) | Allowed Usage |
| :--- | :--- | :---: | :---: | :--- |
| **1. Synthetic Unit Partition (`SYNTH-001`)** | Deterministic pipeline sanity checks & full-policy ground-truth calibration | 1 Fictional Platform (`NovaNote Labs Inc.`) | Full synthetic policy (`evaluation/test-cases/synthetic-policy.json`) | Prompt syntax checks, normalizer unit testing, scorer calibration |
| **2. Real-Policy Development / Calibration Partition** | Calibrating the V1 post-hoc output normalizer and training human scorers prior to benchmark lock | **2 English Platforms** (`Telegram`: 5 clauses, `Cisco`: 5 clauses) | **10 English consensus clauses** (`PL-TC-0061`..`0065`, `PL-TC-0605`..`0609`; `GenUse`: 5, `GenData`: 3, `NoDist`: 2; includes 4 multi-label records) | Normalizer validation & inter-rater scorer calibration ONLY (excluded from final reported evaluation metrics) |
| **3. Primary English-Only Evaluation Subset** | **Primary English-only empirical evaluation** of V1, V2, and V3 | **75 Held-Out English Platforms** (zero overlap with Dev platforms) | **498 English consensus clauses** (`GenUse`: 194, `GenData`: 187, `NoDist`: 117; includes 90 consensus multi-label records) | Held-out evaluation ONLY. Never used to tune prompts or normalizers |
| **4. Full Multilingual Consensus Benchmark** | **Primary overall benchmark** (English + 12 Polish platforms) | **87 Consensus Platforms** (`85 Held-Out` + `2 Dev`, or `570 Held-Out` / `580 Total`) | **580 total consensus clauses** (`GenUse`: 228, `GenData`: 211, `NoDist`: 141; includes 72 Polish consensus clauses) | Cross-lingual robustness evaluation & full consensus reporting |
| **5. Secondary Adjudication Tier** | Supplementary stress-testing on divergent/single-annotator slots | 29 Platforms with slot differences | **138 flagged clauses** (`requires_human_review = True`) | Optional secondary analysis after human review adjudication |

> **Zero-Overlap Rule:** Neither `Telegram` nor `Cisco` (nor any clause from the 85 held-out evaluation platforms) may be embedded inside any prompt template. When reporting the **498 English consensus subset**, the 2 development platforms (`Telegram` and `Cisco`, 10 clauses total) are strictly excluded (`508 total English consensus clauses - 10 dev clauses = 498 held-out English evaluation clauses`).

---

## 3. Input Standardization Protocol

To ensure differences in scores reflect only the prompt architecture (V1 vs. V2 vs. V3):

1. **Identical Input Strings:**
   - In **Clause/Passage Evaluation Mode**, the exact `original_policy_clause` string from `annotated-test-cases.csv` is passed as `{{POLICY_TEXT}}` to V1, Stage 1 of V2, and Stages 1 & 4 of V3.
   - In **Full-Policy Evaluation Mode** (run on `SYNTH-001` and a stratified sample of full policy texts extracted from `Tagger 2/` PDFs), the exact same extracted document text string is passed to V1, V2, and V3.
2. **Matched Model & Decoding Parameters:**
   - When comparing V1, V2, and V3 on a given AI provider (OpenAI, Gemini, or Claude), all stages use the exact same model version, `temperature = 0.0` (greedy/deterministic decoding where supported), and `top_p = 1.0`.
3. **Stateless Execution:**
   - Every test case is executed in a fresh, isolated context window with zero conversation history carryover between test cases or between stages.

---

## 4. Handling Multi-Label Clauses & Partial Reference Annotations

### 4.1 Multi-Label Clause Evaluation Rule
In privacy policies, a single sentence frequently exhibits multiple analytical properties simultaneously. In our 580 consensus dataset, **121 records** (`102` in the 508 English consensus records / `100` in the 498 held-out English subset) are multi-category clauses where the exact same sentence was tagged under two or more categories (most commonly `GenUse` + `NoDist`, or `GenData` + `GenUse`).

**Protocol Rule:**
1. **Group by Normalized Clause Text per Platform:** Before scoring a platform's clauses, the evaluation harness aggregates all consensus category tags associated with the same normalized clause text into a **Ground-Truth Category Set** $Y_{\text{true}} \subseteq \{\text{GenData}, \text{GenUse}, \text{NoDist}\}$.
2. **Non-Punitive Multi-Category Mapping:**
   - If $Y_{\text{true}} = \{\text{GenUse}, \text{NoDist}\}$, a prompt output achieves full credit (**M1 = 2, M3 = 2, M6 = 2**) when it identifies both the broad usage purpose (`dataUsage` / `concerningOrUnclearClauses`) and the lack of specific data-to-purpose linkage (`concerningOrUnclearClauses`).
   - If a single-label benchmark row (`annotation_category = GenUse`) contains a clause that also legitimately mentions data collection (`We collect and use...`) or third-party partners (`...provided by Baidu and Baidu's related parties and partners`), the prompt is **never penalized** for additionally populating `dataCollection` or `thirdPartySharing`, provided those extractions are 100% grounded in the source clause text.

### 4.2 Open-World Rule for Categories Not Covered by the Spreadsheet Annotations
The *"Annotated Privacy Policies of 100 Online Platforms"* dataset was constructed specifically to test three vagueness hypotheses (`GenData`, `GenUse`, `NoDist`) with *up to 3 example clauses per category*. It **does not** annotate:
- Specific third-party sharing disclosures (**M4**), unless incidentally present inside a `GenData`/`GenUse`/`NoDist` example;
- User rights and deletion/access mechanics (**M5**);
- Data retention durations or omitted topics (**M8**); or
- Every single `GenData`/`GenUse`/`NoDist` sentence in a 15-page PDF policy.

**Protocol Rule:**
1. **Source Text is the Ultimate Arbiter of Grounding:** Human spreadsheet annotations in `annotated-test-cases.csv` define **required positive recall targets** for **M1, M2 (`GenData`), M3 (`GenUse`/`NoDist`), and M6**. They are **never** treated as a negative assertion that the clause (or full policy) lacks third-party sharing or user rights.
2. **Isolated-Clause `N/A` Rule for M4 (Third-Party Sharing), M5 (User Rights), and M8 (Missing Information):**
   - In **isolated-clause experiments**, the supplied input is a single clause or short excerpt rather than a complete privacy policy. Models must **never be penalized** for information unavailable in the supplied excerpt:
     - **M4 (Third-Party Sharing Identification):** Marked **`N/A`** whenever the supplied excerpt is insufficient to establish the platform's third-party data-sharing disclosures across the policy. (Only scored `0–2` on isolated clauses that explicitly state a third-party data transfer disclosure, such as `Baidu AI Cloud` `GenUse3`: *"We share personal data with suppliers or partners..."*.)
     - **M5 (User Rights Identification):** Marked **`N/A`** whenever the supplied excerpt is insufficient to establish the platform's user rights across the policy.
     - **M8 (Missing-Information Handling):** Always marked **`N/A`** on isolated single-clause runs because an isolated clause cannot establish what disclosures are omitted across the complete privacy policy.
   - Any metric marked `N/A` is excluded from the weighted composite score denominator $\sum_{m \in \mathcal{A}_i} w_m$.
   - If a model *fabricates* unmentioned third-party transfers, user rights, or unmentioned data categories on an isolated clause where M4, M5, or M8 is `N/A`, that fabrication is penalized under **M10 (Hallucination Rate)**.
3. **Orthogonal Separation of M7 (Evidence Grounding) and M10 (Hallucination Rate):**
   - **M7 (Evidence Grounding)** evaluates the **correctness and verbatim fidelity of supporting evidence and quotations** (`supportingExcerpt`)—whether the quotations supplied by the model exist in the source text and substantiate the paired point.
   - **M10 (Hallucination Rate)** evaluates the **proportion of unsupported factual claims in the generated response** ($\text{HR} = C_{\text{unsupported}} / C_{\text{total}}$)—whether the model's generated explanations assert facts, data types, or practices not supported by the source text.
4. **Full-Policy Evaluation Complement:** To evaluate **M4, M5, and M8** on complete policies where third-party sharing, user rights, and policy-wide omissions are established, the clause benchmark is paired with full-document runs on `SYNTH-001` and a stratified 15-platform full-policy subset from `Tagger 2/`.

---

## 5. Fair Output Normalization Across V1, V2, and V3

A core methodological challenge is comparing **Prompt V1** (which outputs unstructured plain-language bullet points) against **Prompt V2** and **Prompt V3** (which natively output the `PrivacyLensUnifiedAnalysis` JSON schema) **without altering the original prompt text in `prompts/versions/baseline-v1.md`**.

### Two-Stage Non-Invasive Normalization Pipeline

```
+-------------------------------------------------------------------------+
| Prompt V1 (`baseline-v1.md`)                                            |
| Executed with EXACT original Milestone 1 prompt text -> Native Bullets  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| Deterministic Post-Hoc Evaluation Mapper (Evaluation-Time Only)         |
| - Segments V1 bullets by topic keywords into canonical evaluation slots |
| - Does NOT rewrite, improve, fact-check, or add quotes to V1's text     |
| - Marks `promptVersion: "v1"`, `verificationStatus: "unverified_baseline"`|
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| Canonical Evaluation Record (Shared by Normalized V1, V2, and V3)       |
| Scored identically against M1 - M10 in `score-sheet-template.csv`       |
+-------------------------------------------------------------------------+
```

### Rules Ensuring Fairness to Prompt V1
1. **No Prompt Modification:** `prompts/versions/baseline-v1.md` is passed to the model verbatim.
2. **Non-Enhancing Structural Mapping:** The evaluation parser maps V1's native bullet points into the corresponding evaluation buckets (`summary`, `data_collection`, `data_usage`, `third_party_sharing`, `user_rights`, `risky_or_unclear_clauses`, `missing_info`) strictly by copying V1's generated bullets into the matching bucket. It never adds missing facts, never removes hallucinations, and never supplies quotes from the source text.
3. **Dual Composite Reporting (With and Without M7 Verbatim Excerpt Requirement):**
   - Because `baseline-v1.md` asks the model to *"Summarize... Use bullet points and avoid complicated legal terms"* and does not explicitly instruct the model to paste verbatim quotes, V1 will naturally score `1/2` (paraphrased grounding) rather than `2/2` (verbatim excerpt) on **M7 (Evidence Grounding)**.
   - To ensure complete academic fairness, all evaluation tables report **both**:
     - **Composite Score A (Full 10-Metric PrivacyLens Score, M1–M10):** Evaluates adherence to all PrivacyLens product requirements, including verbatim evidence citation (**M7**).
     - **Composite Score B (9-Metric Substantive Accuracy & Clarity Score, excluding M7):** Evaluates pure analytical identification, plain-language clarity, missing-info handling, and hallucination control on an equal footing between prose (V1) and JSON (V2/V3).

---

## 6. Worked Example: Scoring One Clause Across V1, V2, and V3 (HYPOTHETICAL OUTPUTS & SCORES)

> **IMPORTANT DISCLAIMER — HYPOTHETICAL WALKTHROUGH EXAMPLE ONLY:**  
> All model outputs and metric scores in Section 6 below are **HYPOTHETICAL ILLUSTRATIONS** created solely to demonstrate how the Phase 4 evaluation protocol and 10-metric scoring rubric operate in practice. They are **not** real experimental results from any LLM run.

### Input Benchmark Test Case (`PL-TC-0004` — Real Consensus Clause from `Baidu AI Cloud`)
- **Test Case ID:** `PL-TC-0004` (`comparison_id`: `CMP-0004`)
- **Platform:** `Baidu AI Cloud` (Sector: `Cloud storage`)
- **Primary Slot Category:** `GenUse` (`GenUse1`)
- **Multi-Label Ground Truth (`notes_on_ambiguity`):** Also assigned to `NoDist` (`NoDist2`) by Tagger 1; additionally contains an explicit reference to third-party/partner service provision (*"Baidu's related parties and partners"*).
- **Exact Input Clause Text (`{{POLICY_TEXT}}`):**
  > *"We use the collected information to provide and improve the products and services provided by Baidu and Baidu's related parties and partners, and carry out necessary business operations, such as product operation and service provision, evaluating, maintaining and improving the performance of products and services, developing new products and services, and providing customer support."*

---

### 6.1 Hypothetical Output — Prompt V1 (`baseline-v1`) [HYPOTHETICAL]
```text
- Data Collected: The policy mentions "collected information", including your account details and browsing logs.
- How Data Is Used: Baidu uses your information to run, maintain, and improve its products and services, develop new products, carry out business operations, and provide customer support.
- Risky or Unclear Clauses: The policy says it uses "collected information" for "necessary business operations, such as..." which is broad and does not explain which specific data is used for which purpose.
```
*Evaluator Analysis of Hypothetical V1 Output:*
- **Applicable Metrics on Isolated Excerpt (`PL-TC-0004`):** Because this isolated sentence only states that collected information is used to provide/improve products of Baidu and its related parties/partners and does not establish third-party data transfer disclosures (**M4**), user rights (**M5**), or policy-wide omissions (**M8**), **M4 = `N/A`, M5 = `N/A`, and M8 = `N/A`**. (Active weight denominator $\sum_{m \in \mathcal{A}_i} w_m = 1.00 - 0.24 = 0.76$ for Composite Score A, and $0.76 - 0.12 = 0.64$ for Substantive Score B.)
- **M1 (`2`), M3 (`2`), M6 (`1`), M9 (`2`):** Captures the main usage purposes and multi-label `GenUse`/`NoDist` nature in clear language, though risk framing in M6 does not separate stated facts from conditional implications.
- **M2 (`0`):** Invents *"including your account details and browsing logs"*, which are not mentioned in `PL-TC-0004`.
- **M7 Evidence Grounding (`1`):** Quotes only short 2–3 word fragments (*"collected information"*, *"necessary business operations, such as..."*) rather than full verbatim clause excerpts.
- **M10 Hallucination Rate (`0` — High-Ratio Single Hallucination):** Contains $C_{\text{total}} = 4$ distinct factual assertions, of which $C_{\text{unsupported}} = 1$ (*"including your account details and browsing logs"*) is unsupported ($\text{HR} = 1 / 4 = 0.25 > 0.20$). Under the mutually exclusive M10 threshold ($C_{\text{unsupported}} = 1 \text{ and } \text{HR} > 0.20$), this receives **M10 = `0`**.

---

### 6.2 Hypothetical Output — Prompt V2 (`chained-v2`, Unverified Candidate) [HYPOTHETICAL]
```json
{
  "promptVersion": "v2",
  "summary": {
    "overview": "This clause states that Baidu uses collected information to provide, maintain, and improve products and services for itself and its partners, develop new products, and provide customer support.",
    "keyTakeaways": [
      "Collected information is used broadly across Baidu's and its partners' services.",
      "The clause uses open-ended phrasing ('such as') and does not link specific data types to specific uses."
    ]
  },
  "dataCollection": {
    "status": "Specified",
    "items": [
      {
        "clauseId": "CL-01",
        "category": "General Collected Information (Unspecified Types)",
        "dataTypes": ["Collected information (specific data types not listed in this clause)"],
        "purpose": "Providing, maintaining, and improving products/services, developing new products, and customer support.",
        "supportingExcerpt": "We use the collected information to provide and improve the products and services provided by Baidu and Baidu's related parties and partners, and carry out necessary business operations, such as product operation and service provision, evaluating, maintaining and improving the performance of products and services, developing new products and services, and providing customer support."
      }
    ]
  },
  "dataUsage": {
    "status": "Specified",
    "purposes": [
      {
        "clauseId": "CL-01",
        "purpose": "Service delivery, improvement, new product development, and customer support",
        "plainExplanation": "Baidu uses collected information to operate, evaluate, maintain, and improve its own and its partners' products and services, develop new products, and provide customer support.",
        "supportingExcerpt": "We use the collected information to provide and improve the products and services provided by Baidu and Baidu's related parties and partners, and carry out necessary business operations, such as product operation and service provision, evaluating, maintaining and improving the performance of products and services, developing new products and services, and providing customer support."
      }
    ]
  },
  "thirdPartySharing": {
    "status": "Specified",
    "disclosures": [
      {
        "clauseId": "CL-01",
        "recipientCategory": "Baidu's related parties and partners",
        "sharedData": "Collected information",
        "purpose": "Providing and improving products and services provided by Baidu's related parties and partners",
        "plainExplanation": "The clause states that collected information is used to provide and improve products and services offered by Baidu's related parties and partners, which means Baidu sells your data to partner companies.",
        "supportingExcerpt": "We use the collected information to provide and improve the products and services provided by Baidu and Baidu's related parties and partners..."
      }
    ]
  },
  "userRightsAndRetention": {
    "userRightsStatus": "Not specified",
    "dataRetentionStatus": "Not specified",
    "retentionSummary": "Not specified",
    "rights": []
  },
  "concerningOrUnclearClauses": [
    {
      "clauseId": "CL-01",
      "topic": "Open-Ended Business Operations Catalogue and Unlinked Data Usage",
      "classification": "Potentially Concerning / Broad Wording",
      "plainExplanation": "The clause states that Baidu uses 'the collected information' for 'necessary business operations, such as...' followed by a list of broad activities.",
      "whyItMatters": "First, 'such as' makes the list of business operations open-ended (GenUse). Second, referring collectively to 'the collected information' does not explain which specific pieces of data are used for which purpose (NoDist).",
      "supportingExcerpt": "We use the collected information to provide and improve the products and services provided by Baidu and Baidu's related parties and partners, and carry out necessary business operations, such as product operation and service provision, evaluating, maintaining and improving the performance of products and services, developing new products and services, and providing customer support."
    }
  ],
  "missingInformation": [
    {
      "topic": "Specific Categories of Collected Data, User Rights, and Data Retention Period",
      "status": "Not specified",
      "explanation": "This excerpt refers only to 'the collected information' without specifying what data types are collected, and does not specify user rights or how long the collected information is retained."
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
*Evaluator Analysis of Hypothetical V2 Output:*
- **M4 (`N/A`), M5 (`N/A`), M8 (`N/A`):** Marked `N/A` because the single-clause input is insufficient to establish policy-wide third-party sharing, user rights, or complete-policy omissions.
- **M1 (`2`), M2 (`2`), M3 (`2`), M6 (`2`), M9 (`2`):** Accurately identifies the multi-label `GenUse` + `NoDist` properties, recognizes that specific collected data items are not enumerated in the clause, and calibrates `concerningOrUnclearClauses`.
- **M7 Evidence Grounding (`2`):** Every finding is paired with an exact, verbatim quotation from `PL-TC-0004`.
- **M10 Hallucination Rate (`1` — Isolated Minor Drift with Low Ratio):** Across $C_{\text{total}} = 8$ factual assertions in the JSON response, $C_{\text{unsupported}} = 1$ assertion (*"which means Baidu sells your data to partner companies"*) is unsupported by the source text ($\text{HR} = 1 / 8 = 0.125 \le 0.20$). Notice the orthogonal distinction between **M7 (`2`)** (the cited quotation is 100% verbatim) and **M10 (`1`)** (the generated explanation added 1 unsupported factual claim with $\text{HR} = 0.125 \le 0.20$).

---

### 6.3 Hypothetical Output — Prompt V3 (`verified-v3`, Independently Verified) [HYPOTHETICAL]
In Prompt V3, Stage 4 (Independent Accuracy & Grounding Auditor) inspects V2's unverified candidate JSON against `<UNTRUSTED_POLICY_TEXT>`, catches the unsupported claim (*"which means Baidu sells your data to partner companies"*), removes it ($C_{\text{unsupported}} = 0, \text{HR} = 0.00 \implies \text{M10} = 2$), and sets `verificationStatus: "verified_by_stage4"`, `verified: true`, `unsupportedClaimsRemoved: 1`.

---

### 6.4 Side-by-Side Hypothetical Score Comparison for `PL-TC-0004` [HYPOTHETICAL SCORES]

| Metric ID | Metric Name | Weight | V1 Hypothetical Score | V2 Hypothetical Score | V3 Hypothetical Score | Scoring Rationale (Hypothetical) |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **M1** | Clause Identification Accuracy | 12% | `2` | `2` | `2` | All three identify the core usage provision and multi-label scope (`GenUse` + `NoDist`). |
| **M2** | Data Collection Identification | 10% | `0` | `2` | `2` | V1 invents *"account details and browsing logs"*; V2 & V3 accurately note the text only references *"the collected information"*. |
| **M3** | Data Usage Identification | 10% | `2` | `2` | `2` | All three capture service provision, improvement, new product development, and customer support. |
| **M4** | Third-Party Sharing Identification | 8% | `N/A` | `N/A` | `N/A` | Marked `N/A`: isolated excerpt is insufficient to establish third-party data transfer disclosures across the policy. |
| **M5** | User Rights Identification | 8% | `N/A` | `N/A` | `N/A` | Marked `N/A`: isolated excerpt does not address user rights. |
| **M6** | Risk & Vague Wording Identification | 12% | `1` | `2` | `2` | V1 notes *"such as"* in prose; V2 & V3 explicitly classify `Potentially Concerning / Broad Wording` (`GenUse` + `NoDist`). |
| **M7** | Evidence Grounding (Quotations) | 12% | `1` | `2` | `2` | V1 quotes 2-word fragments; V2 & V3 provide full verbatim `supportingExcerpt` quotations. |
| **M8** | Missing-Information Handling | 8% | `N/A` | `N/A` | `N/A` | Marked `N/A`: isolated single-clause input cannot establish policy-wide omissions. |
| **M9** | Plain-Language Clarity | 8% | `2` | `2` | `2` | All three explain the clause in accessible everyday language. |
| **M10** | Hallucination Control (`0-2`, HR) | 12% | `0` ($1/4, \text{HR}=0.25$) | `1` ($1/8, \text{HR}=0.125$) | `2` ($0/7, \text{HR}=0.00$) | V1 has $C_{\text{unsupported}}=1$ with $\text{HR}=0.25 > 0.20$ (`0`); V2 has $C_{\text{unsupported}}=1$ with $\text{HR}=0.125 \le 0.20$ (`1`); V3 Stage 4 removes the unsupported claim (`2`). |
| **Total A** | **Full Applicable Composite (0–100)** | **76% active** | **57.9 / 100** | **92.1 / 100** | **100.0 / 100** | **HYPOTHETICAL ILLUSTRATION ONLY** ($\sum_{m \in \mathcal{A}} w_m = 0.76$) |
| **Total B** | **Substantive Score (Excl. M7)** | **64% active** | **59.4 / 100** | **90.6 / 100** | **100.0 / 100** | **HYPOTHETICAL ILLUSTRATION ONLY** ($\sum_{m \in \mathcal{A} \setminus \{\text{M7}\}} w_m = 0.64$) |
