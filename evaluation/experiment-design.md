# PrivacyLens — Phase 4 Experimental Design Specification

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Status:** Experimental Design Pre-Registration (No Fabricated Empirical Results)

---

## 1. Research Questions & Hypotheses

The core academic objective of **PrivacyLens** is to measure how progressive prompt engineering architectures—moving from a single-pass baseline (**V1**) to a 3-stage sequential chain (**V2**) and a 4-stage independently verified pipeline (**V3**)—impact analytical accuracy, evidence grounding, missing-information handling, and hallucination rates across foundation models.

### Primary Research Hypotheses

- **$\text{H}_1$ (Decomposition Effect — V2 vs. V1):**
  Decomposing policy analysis into sequential extraction, domain analysis, and plain-language synthesis (**Prompt V2**) will significantly increase **Clause Identification Accuracy (M1)**, **Risk & Vague Wording Identification (M6)**, and **Evidence Grounding (M7)** compared to the single-pass zero-shot prompt (**Prompt V1**), both on the Full 10-Metric Composite Score and the 9-Metric Substantive Score.
- **$\text{H}_2$ (Independent Verification Effect — V3 vs. V2):**
  Adding an independent Stage 4 accuracy and grounding auditor that cross-checks V2's unverified candidate JSON against `<UNTRUSTED_POLICY_TEXT>` (**Prompt V3**) will significantly reduce the **Hallucination Rate (M10)** and improve **Missing-Information Handling (M8)** and epistemic calibration (**M6**) compared to **Prompt V2**.
- **$\text{H}_3$ (Cross-Provider Generalization):**
  The architectural gains of **V3 > V2 > V1** will hold consistently across all three evaluated LLM families (**OpenAI ChatGPT**, **Google Gemini**, and **Anthropic Claude**), reducing inter-model variance.
- **$\text{H}_4$ (Cross-Lingual Robustness — 498 English Subset vs. 580 Full Consensus Set):**
  Prompt V2 and Prompt V3 will maintain structural schema validity and verbatim excerpt grounding on both the **498 Held-Out English Consensus Subset** (75 English platforms) and the **72 Polish Consensus Clauses** (10 Polish platforms) within the **580 Full Consensus Benchmark**.

---

## 2. Experimental Variables

### 2.1 Independent Variables (Manipulated Factors)
1. **Prompt Architecture ($P \in \{\text{V1}, \text{V2}, \text{V3}\}$):**
   - `V1`: Single-pass zero-shot baseline (`prompts/versions/baseline-v1.md`).
   - `V2`: 3-stage chained pipeline producing an unverified candidate JSON (`prompts/versions/chained-v2.md`).
   - `V3`: 4-stage chained pipeline with Stage 4 independent verification (`prompts/versions/verified-v3.md`).
2. **LLM Provider ($M \in \{\text{OpenAI}, \text{Gemini}, \text{Claude}\}$):**
   - Evaluated via the provider-independent backend interface (`BaseAIProvider`).
3. **Evaluation Benchmark Tier ($B$):**
   - **Tier 1 (Primary English Subset):** **498 held-out English consensus clauses** across **75 English platforms** (excluding the 2 calibration platforms `Telegram` and `Cisco` totaling 10 clauses).
   - **Tier 2 (Full Multilingual Consensus Benchmark):** **580 total consensus clauses** (**570 held-out** across 85 platforms + **10 dev calibration** across 2 platforms), spanning `GenUse` (228), `GenData` (211), and `NoDist` (141).
   - **Tier 3 (Full-Policy Holistic Benchmark):** Complete privacy policy texts (`SYNTH-001` + a stratified sample of **15 held-out full policy PDFs** across sectors from `Tagger 2/`) to test end-to-end extraction of `Third-Party Sharing` (**M4**), `User Rights` (**M5**), and `Missing-Information Handling` (**M8**).

### 2.2 Controlled Variables (Constants Across Runs)
- **Exact Input Text (`{{POLICY_TEXT}}`):** Byte-for-byte identical for V1, V2, and V3 on every test item.
- **Decoding Temperature:** Fixed at `temperature = 0.0` (deterministic greedy decoding where supported).
- **Context Isolation:** Stateless API call per stage; no memory persists across test cases.
- **Zero Dev/Eval Leakage:** The 2 calibration platforms (`Telegram` and `Cisco`, 10 clauses) and `SYNTH-001` are strictly separated from the 85 held-out evaluation platforms (`498` English consensus clauses + `72` Polish consensus clauses).

### 2.3 Dependent Variables (Measured Outcomes)
1. **10 Rubric Metrics (M1 – M10):** Scored `0–2` (or `N/A` when unavailable in an isolated excerpt) per test item using [`scoring-rubric.md`](./scoring-rubric.md):
   - In **isolated-clause runs**, **M4 (Third-Party Sharing)**, **M5 (User Rights)**, and **M8 (Missing Information)** are marked **`N/A`** whenever the supplied excerpt is insufficient to establish those disclosures across the complete policy, and are excluded from the denominator $\sum_{m \in \mathcal{A}_i} w_m$.
   - **M7 (Evidence Grounding)** specifically measures the **correctness and verbatim fidelity of supporting quotations** (`supportingExcerpt`).
   - **M10 (Hallucination Rate)** specifically measures the **proportion of unsupported factual claims in the generated response** ($\text{HR} = C_{\text{unsupported}} / C_{\text{total}}$) using mutually exclusive thresholds: Score `2` ($C_{\text{unsupported}} = 0$), Score `1` ($C_{\text{unsupported}} = 1 \text{ and } \text{HR} \le 0.20$), Score `0` ($C_{\text{unsupported}} \ge 2 \text{ or } [C_{\text{unsupported}} = 1 \text{ and } \text{HR} > 0.20]$).
2. **Composite Score A (Full Applicable Composite Score, `0–100`):** Weighted average across all applicable metrics $m \in \mathcal{A}_i$.
3. **Composite Score B (Substantive Score, `0–100`):** Weighted average across applicable metrics excluding **M7 (Evidence Grounding)** to compare V1's native prose fairly against V2 and V3.
4. **Empirical Hallucination Rate ($\text{HR} \in [0.00, 1.00]$):** Ratio of unsupported factual assertions $C_{\text{unsupported}} / C_{\text{total}}$.
5. **Stage 4 Verification Yield (V3 Only):** Number and percentage of unsupported claims or ungrounded missing-info explanations caught and removed by V3 Stage 4 (`verificationAudit.unsupportedClaimsRemoved`).
6. **Operational Cost & Latency:** Wall-clock execution time (ms), number of LLM calls (`1` for V1, `3` for V2, `4` for V3), and total input/output tokens per test case.

---

## 3. Multi-Stage Execution Workflow (When Phase 5+ Backend Orchestration Is Enabled)

```
+-------------------------------------------------------------------------+
| 1. Input Loader (`evaluation/dataset/annotated-test-cases.csv`)         |
|    - Filter: `requires_human_review == False` (580 consensus clauses)   |
|    - Exclude Dev Platforms (`Telegram`, `Cisco`) -> 570 Held-Out        |
|    - Filter English-Only -> 498 Primary Held-Out English Clauses        |
|    - Aggregate Multi-Label Ground Truth per normalized clause text      |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| 2. Prompt Execution Engine (Identical `{{POLICY_TEXT}}`, temp = 0.0)    |
|    - Run V1 (`baseline-v1.md`) -> 1 LLM call -> Post-Hoc Normalizer     |
|    - Run V2 (`chained-v2.md`)  -> 3 LLM calls -> Unverified JSON        |
|    - Run V3 (`verified-v3.md`) -> 4 LLM calls -> Stage 4 Verified JSON  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| 3. Automated + Blinded Human Scoring (`score-sheet-template.csv`)       |
|    - Automated checks: JSON schema validity, verbatim substring match   |
|      for `supportingExcerpt` (M7), `"Not specified"` field presence     |
|    - Blinded human rubric scoring: M1 - M10 ordinal scores (0, 1, 2)    |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| 4. Statistical Aggregation & Paired Comparison Report                   |
|    - Compute mean/SD for M1-M10, Composite Score A, Substantive Score B |
|    - Paired Wilcoxon signed-rank test across matched clauses (V1/V2/V3) |
+-------------------------------------------------------------------------+
```

---

## 4. Blinded Human Evaluation & Inter-Rater Reliability Protocol

To eliminate evaluator bias toward V2 or V3 during human scoring of **M1–M10**:
1. **Blinded Version Masking:** Before human team members (Team ladybug, 4 members) score model outputs in `score-sheet-template.csv`, outputs are stripped of `promptVersion` and `verificationAudit` metadata and presented in a standardized display format with randomized anonymization codes (`Run-Alpha`, `Run-Beta`, `Run-Gamma`).
2. **Dual Independent Scoring on Calibration & Stratified Audit Set:**
   - All 4 team members score the **10 Development / Calibration clauses** (`Telegram` and `Cisco`) first to align on the [`scoring-rubric.md`](./scoring-rubric.md) rules.
   - During the held-out evaluation run, at least **20% of the 498 English consensus clauses (100 clauses)** and **all 15 full-policy runs** are double-scored independently by two team members to compute **Cohen's Kappa ($\kappa$) / Krippendorff's Alpha ($\alpha$)** for inter-rater reliability.

---

## 5. Pre-Registered Experimental Results Templates (Unpopulated)

*In compliance with academic integrity rules, the tables below contain no fabricated numbers and will be populated exclusively after executing live model runs.*

### Table 5.1: Primary Benchmark — 498 Held-Out English Consensus Clauses (75 Platforms)

| Prompt Version | AI Provider | M1 Clause Acc | M2 Data Coll | M3 Data Use | M4 3rd Party | M5 User Rights | M6 Risk/Vague | M7 Evidence | M8 Missing Info | M9 Clarity | M10 Halluc. Rate ($\text{HR}$) | Composite A (Full 0–100) | Composite B (Excl. M7) | Avg Latency (ms) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **V1 (`baseline-v1`)** | OpenAI | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **V2 (`chained-v2`)** | OpenAI | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **V3 (`verified-v3`)** | OpenAI | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **V1 (`baseline-v1`)** | Gemini | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **V2 (`chained-v2`)** | Gemini | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **V3 (`verified-v3`)** | Gemini | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **V1 (`baseline-v1`)** | Claude | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **V2 (`chained-v2`)** | Claude | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **V3 (`verified-v3`)** | Claude | — | — | — | — | — | — | — | — | — | — | — | — | — |

### Table 5.2: Category-Specific Recall on Consensus Clauses (`GenData`, `GenUse`, `NoDist`, and Multi-Label)

| Prompt Version | AI Provider | `GenData` Accuracy ($n=187$ Eng / $208$ Held-Out / $211$ All) | `GenUse` Accuracy ($n=194$ Eng / $223$ Held-Out / $228$ All) | `NoDist` Accuracy ($n=117$ Eng / $139$ Held-Out / $141$ All) | Multi-Label Clause Match ($n=90$ Eng / $109$ Held-Out) | Polish Clause Subset ($n=72$ Clauses) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **V1 (`baseline-v1`)** | All / Per-Model | — | — | — | — | — |
| **V2 (`chained-v2`)** | All / Per-Model | — | — | — | — | — |
| **V3 (`verified-v3`)** | All / Per-Model | — | — | — | — | — |
