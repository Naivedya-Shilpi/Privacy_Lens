# PrivacyLens — Scorer Training Guide & Disagreement Resolution Protocol

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug (4 Members)  
**Course:** Prompt Engineering (SCSE4041), Bennett University

---

## 1. Core Golden Rules for Human Scorers

Every member of Team ladybug must apply these five rules consistently when grading model outputs:

### Rule 1: Isolated-Clause `N/A` Rule for M4, M5, and M8 (Never Penalize for Unavailable Context)
When scoring an **isolated clause** (such as the 10 calibration clauses in `Telegram` and `Cisco` or the 498 held-out English consensus clauses):
- The model only sees a 1–3 sentence excerpt from a policy, **not** the entire privacy policy.
- **M8 (Missing-Information Handling)** MUST always be recorded as **`N/A`** on isolated single-clause runs, because a single clause is insufficient to establish what disclosures are omitted across the complete policy.
- **M4 (Third-Party Sharing)** and **M5 (User Rights)** MUST be recorded as **`N/A`** whenever the supplied excerpt is insufficient to establish the platform's third-party sharing practices (**M4**) or user rights (**M5**).
- **Only in Full-Policy Evaluation Mode** (e.g., `SYNTH-001` or full PDF policies from `Tagger 2/`) are **M4**, **M5**, and **M8** scored `0–2` across the entire document.
- *Exception for Fabrications:* If a model **invents** unmentioned third-party recipients, invented user rights, or unmentioned data categories (e.g., claiming the policy omits retention rules for *"biometric voiceprints"* when voiceprints are never mentioned in the input text), leave M4/M5/M8 as `N/A` on the isolated clause and penalize the invented claim under **M10 (Hallucination Rate)**!

---

### Rule 2: Strict Separation Between M7 (Evidence Grounding) and M10 (Hallucination Rate)
Do **not** double-count or conflate quotation formatting (**M7**) with factual hallucination (**M10**):

| Dimension | M7: Evidence Grounding | M10: Hallucination Rate |
| :--- | :--- | :--- |
| **What It Measures** | **Correctness and verbatim fidelity of supporting evidence and quotations** (`supportingExcerpt`). | **Proportion of unsupported factual claims in the generated response** ($\text{HR} = C_{\text{unsupported}} / C_{\text{total}}$). |
| **Key Question** | *Do the quotes cited by the model actually appear verbatim in `<UNTRUSTED_POLICY_TEXT>` and match the topic of the finding?* | *Did the model's generated explanation assert any fact, data type, practice, or confirmed harm not supported by `<UNTRUSTED_POLICY_TEXT>`?* |
| **Example of `M7 = 2` but `M10 = 1`** | The model pastes an exact verbatim quote from the clause (`M7 = 2`), **but** its `plainExplanation` adds an unsupported inference (*"which means the company sells your data"* $\rightarrow C_{\text{unsupported}} = 1$). | Scored in **M10**, not M7. |
| **Example of `M7 = 1` but `M10 = 2`** | Prompt V1 paraphrases the clause accurately in bullet points without using verbatim quotation marks (`M7 = 1`), and makes **zero** unsupported factual claims ($C_{\text{unsupported}} = 0 \implies \text{M10} = 2$). | Scored `1` in **M7** (and excluded in Substantive Composite Score B), `2` in **M10**. |

---

### Rule 3: How to Count Atomic Factual Claims ($C_{\text{total}}$ and $C_{\text{unsupported}}$) for M10
To ensure all 4 scorers compute the exact same **Hallucination Rate ($\text{HR}$)**:
1. **What Counts as 1 Factual Claim ($C_{\text{total}}$):**
   - Each distinct factual statement in `summary.overview` / `keyTakeaways`, each item's `dataTypes` + `purpose` in `dataCollection`, each `plainExplanation` in `dataUsage` / `thirdPartySharing` / `userRightsAndRetention`, each `plainExplanation` + `whyItMatters` in `concerningOrUnclearClauses`, and each `explanation` in `missingInformation`.
   - Do **not** count verbatim `supportingExcerpt` strings or structural status flags (`"Specified"` / `"Not specified"`) as generated factual claims.
2. **What Counts as an Unsupported Claim ($C_{\text{unsupported}}$):**
   - Any stated data type, usage purpose, recipient, right, or restriction not present in `<UNTRUSTED_POLICY_TEXT>`.
   - Any unmentioned data category introduced inside a `missingInformation` explanation.
   - Any speculative interpretation or worst-case possibility presented as a **confirmed fact** (e.g., *"they sell your private messages"* when the text only says *"we may use aggregated data to build useful features"*).
3. **Mutually Exclusive M10 Score Lookup Table:**
   - If $C_{\text{unsupported}} = 0 \implies$ **M10 = `2`** ($\text{HR} = 0.00$)
   - If $C_{\text{unsupported}} = 1$ **AND** $\text{HR} \le 0.20$ (i.e., $C_{\text{total}} \ge 5$) $\implies$ **M10 = `1`**
   - If $C_{\text{unsupported}} \ge 2$ **OR** ($C_{\text{unsupported}} = 1$ **AND** $\text{HR} > 0.20$, i.e., $C_{\text{total}} \le 4$) $\implies$ **M10 = `0`**

---

### Rule 4: Multi-Label Clause Scoring (`GenData`, `GenUse`, `NoDist`)
Four of our 10 calibration clauses (`PL-TC-0061`, `PL-TC-0064`, `PL-TC-0607`, `PL-TC-0609`) are **multi-label clauses**:
- `PL-TC-0061` / `PL-TC-0064` (`Telegram`): *"We may use some aggregated data about how you use Telegram to build useful features."* $\rightarrow$ Tagged as both **`GenData`** (*"some aggregated data about how you use Telegram"*) and **`GenUse`** (*"to build useful features"*).
- `PL-TC-0607` / `PL-TC-0609` (`Cisco`): *"...ur personal information for the purposes of operating and helping to ensurethe security of our business, and delivering, improving, and customizing our Websites and Solutions..."* $\rightarrow$ Tagged as both **`GenUse`** and **`NoDist`**.
- **Scoring Rule:** To score **`2` on M1 and M6** on a multi-label clause, the model output must capture **all** ground-truth dimensions in `ground_truth_category_set` (e.g., explaining both the vague usage catalog and the failure to specify which personal information is used for which purpose). If it captures only one of the two dimensions, score **`1` on M1**.

---

### Rule 5: Handling Source PDF Truncation / Typos in Benchmark Clauses
Some clauses in `annotated-test-cases.csv` preserve minor PDF copy-paste artifacts from the original research spreadsheets (for example, `PL-TC-0605` in `Cisco` ends with `'Online behavior and product usage informati'` and `PL-TC-0607` starts with `'ur personal information...'` and `'ensurethe'`).
- **Scoring Rule for M7:** If a model quotes `'Online behavior and product usage informati'` verbatim OR restores the obvious clipped letter (`'information'`, `'Your'`, `'ensure the'`) while keeping the rest of the quote verbatim, score **`2` on M7**. Do **not** penalize a model for fixing a 1–2 character PDF line-break typo from the input string.

---

## 2. Formal Protocol for Resolving Human Scorer Disagreements

Whenever two or more human scorers assign different scores (`0`, `1`, `2`, or `N/A`) to the same `(run_id, test_case_id, metric)` cell in [`human-scoring-agreement-sheet.csv`](./human-scoring-agreement-sheet.csv) or during the 20% double-scored reliability audit:

### Step 1: Automated Discrepancy Flagging
- Record all individual scorer grades (`Scorer_1` .. `Scorer_4`) in the agreement sheet **before** any discussion. Never alter initial independent scores (`pre_discussion_scores`), as those are required to calculate unbiased inter-rater reliability (Cohen's $\kappa$ / Krippendorff's $\alpha$).
- Compute `max_scorer_spread = max(scores) - min(scores)`:
  - `max_scorer_spread == 0`: **Exact Agreement** — Consensus score is locked automatically.
  - `max_scorer_spread == 1`: **Minor Adjacent Disagreement** (`0` vs `1`, or `1` vs `2`) — Proceed to Step 2.
  - `max_scorer_spread == 2` (or `N/A` vs numeric score): **Major Disagreement** (`0` vs `2`, or applicability mismatch) — Mandatory Step 2 & Step 3 full-team review.

### Step 2: Evidence-Anchored Pairwise Reconciliation (Blinded)
- Whilst the output remains **blinded** (`Run-Alpha` / `Run-Beta` / `Run-Gamma`), the disagreeing scorers inspect:
  1. The exact `<UNTRUSTED_POLICY_TEXT>` input clause.
  2. The specific rubric threshold in [`../scoring-rubric.md`](../scoring-rubric.md).
  3. For **M10** disagreements: Each scorer lists the exact numbered claims ($C_{\text{total}}$) and points to the specific phrase they counted as $C_{\text{unsupported}}$.
- If the discrepancy was caused by an objective oversight (e.g., a scorer missed a phrase present in the source clause or misapplied the `N/A` rule), both scorers agree on the rubric-compliant score and log `resolution_method = "Evidence_Reconciliation"`.

### Step 3: Third-Scorer Tie-Break & Adjudication Log
- If two scorers still disagree on a subjective boundary (such as **M9 Plain-Language Clarity** `1` vs `2` or **M6 Risk Framing** `1` vs `2`) after Step 2:
  - `Scorer_4` (Adjudication Lead, or `Scorer_3` if `Scorer_4` was one of the initial pair) casts an independent blinded tie-breaking vote.
  - During the 4-member Calibration Phase, a majority vote ($\ge 3$ of 4 scorers after reviewing the rubric criteria) sets the `adjudicated_consensus_score`; if split $2\text{–}2$, the **more conservative (lower) score** is assigned to prevent score inflation, and `resolution_method = "Conservative_Tie_Break"` is logged with a written justification in `adjudication_notes`.
