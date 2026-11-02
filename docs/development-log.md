# PrivacyLens — Development Log

**Project:** PrivacyLens (Problem Statement C18 — Terms and Conditions in Plain Language)  
**Team:** ladybug  
**Course:** Prompt Engineering (SCSE4041), Bennett University

---

## Phase 1: Project Initialization & Foundation Setup

**Date:** 2026-11-01  
**Status:** Completed & Verified

### Completed Tasks
1. **Environment Inspection:**
   - Verified Node.js (`v22.19.0`), npm (`10.9.3`), and Git (`2.45.2.windows.1`) on Windows PowerShell.
   - Inspected workspace directory (`<repo-root>`) and initialized Git repository.
2. **Repository & Directory Structure:**
   - Established clean separation across `extension/`, `server/`, `prompts/`, `evaluation/`, `datasets/`, and `docs/`.
   - Configured root `.gitignore` to protect `.env` files, `node_modules/`, logs, and build artifacts.
3. **Browser Extension Foundation (Manifest V3):**
   - Created `extension/manifest.json` with minimal permissions (`activeTab`, `scripting`) and zero remote code execution.
   - Built popup UI (`popup.html`, `popup.css`, `popup.js`) featuring a navy/white/blue design, backend connection status indicator, **Test Server Connection** button, and **Analyze This Page** placeholder button.
   - Added `background/service-worker.js` and `content/extractor.js` placeholder.
4. **Backend Foundation (Node.js + Express):**
   - Configured `server/package.json` with `express`, `cors`, `helmet`, `dotenv`, `zod`, official AI SDKs (`openai`, `@google/genai`, `@anthropic-ai/sdk`), and `nodemon`.
   - Implemented `GET /api/health` endpoint, `zod` environment validation, centralized error handling, and provider-independent AI adapter classes without making live API calls.
5. **Prompt Engineering & Evaluation Workspaces:**
   - Preserved the exact Milestone 1 baseline prompt in `prompts/versions/baseline-v1.md`.
   - Documented V1, V2, and V3 prompt comparison methodology in `prompts/README.md`.
   - Created the 7-criteria evaluation rubric (`evaluation/evaluation-rubric.md`) and a fictional test policy (`evaluation/test-cases/synthetic-policy.json`).
   - Documented optional Kaggle dataset integration guidelines in `datasets/README.md`.

### Next Planned Phase (Phase 2)
- Implement robust webpage policy text extraction and cleaning in `extension/content/extractor.js`.
- Design and implement Prompt V2 (chained clause extraction + plain-language explanation) and Prompt V3 (independent verification stage).
- Connect `/api/analyze` backend endpoint with the provider-independent AI service layer.
- Render structured policy analysis sections and supporting excerpts in the extension popup.

---

## Phase 2: Prompt Engineering Core Architecture (V1, V2, V3 & Unified Schema)

**Date:** 2026-11-01  
**Status:** Completed & Verified

### Completed Tasks
1. **Preserved Baseline Prompt V1 (`prompts/versions/baseline-v1.md`):**
   - Verified and left the original Milestone 1 baseline prompt completely unmodified.
2. **Designed Prompt V2 — Chained Analysis (`prompts/versions/chained-v2.md`):**
   - Created a 3-stage sequential prompt workflow with strict input/output JSON contracts:
     - **Stage 1 (Verbatim Clause Extraction & Taxonomy Tagging):** Extracts word-for-word policy clauses, assigns `clauseId` and category tags, and identifies `unmentionedCategories`.
     - **Stage 2 (Structured Privacy & Risk Analysis):** Consumes Stage 1 output to map collected data to purposes, identify third-party sharing, explain user rights, and flag vague, broad, or concerning clauses.
     - **Stage 3 (Plain-Language Synthesis):** Consumes Stage 2 output to generate an accessible plain-language summary and assemble the unified JSON response.
3. **Designed Prompt V3 — Verified Analysis (`prompts/versions/verified-v3.md`):**
   - Extended the V2 pipeline with **Stage 4 (Independent Accuracy & Grounding Verification Auditor)**:
     - Audits Stage 3 candidate outputs against the original `<UNTRUSTED_POLICY_TEXT>`.
     - Detects and removes unsupported/hallucinated claims (`unsupportedClaimsRemoved`).
     - Verifies that all explanations and `supportingExcerpt` quotes are grounded verbatim in the source policy.
     - Enforces explicit `"Not specified"` markers for omitted privacy dimensions.
     - Calibrates risk classifications to distinguish **Potentially Concerning Wording** / **Broad/Vague Language** from **Explicit High-Impact Terms** (confirmed policy terms).
4. **Defined Unified JSON Output Schema & Workflow Documentation (`prompts/prompt-workflow.md`):**
   - Specified a single canonical JSON Schema (`PrivacyLensUnifiedAnalysis`) compatible with V1, V2, and V3.
   - Documented stage-by-stage data contracts and an end-to-end clause walkthrough using `SYNTH-001`.
   - Updated `prompts/README.md` to reference all prompt versions and workflow specifications.
5. **Prompt Engineering Core Review & Grounding Refinements:**
   - Removed all unsupported details (such as references to `"telemetry logs"` and `"temporary voice recordings"`) from the walkthrough example in `prompts/prompt-workflow.md` and aligned `evaluation/test-cases/synthetic-policy.json` strictly with the exact terms in the source policy text.
   - Enforced strict source-policy grounding for all `missingInformation` explanations across Stages 2, 3, and 4 so unmentioned data categories are never introduced when describing omitted disclosures.
   - Formalized the four-way epistemic distinction across `chained-v2.md`, `verified-v3.md`, and `prompt-workflow.md`: (1) `Explicitly Stated Term`, (2) `Potentially Concerning / Broad Wording`, (3) `"Not specified"` information, and (4) conditional interpretations/implications that must never be presented as confirmed facts.
   - Strengthened V3 Stage 4 to independently check every factual claim, every `supportingExcerpt`, and every `missingInformation` explanation against `<UNTRUSTED_POLICY_TEXT>`.
   - Added `verificationStatus` (`"unverified_baseline" | "unverified_candidate" | "verified_by_stage4"`) to the Unified JSON Schema so V2 explicitly marks its output as an unverified candidate (`verified: false`) and never claims independent verification has occurred.

---

## Phase 3: Evaluation Dataset Preparation ("Annotated Privacy Policies of 100 Online Platforms")

**Date:** 2026-11-01  
**Status:** Completed & Verified

### Completed Tasks
1. **Inspected Primary Research Corpus (`datasets/Annotated Privacy Policies of 100 Online Platforms/`):**
   - Examined `Instruction.docx`, `PP_table Tagger1.xlsx` (100 rows × 20 columns, 700 non-empty clause cells), `PP_table Tagger2.xlsx` (100 rows × 20 columns, 705 non-empty clause cells), `Tagger 1/` (97 PDFs), and `Tagger 2/` (98 PDFs, 94 containing embedded `/Highlight` and `/Popup` annotations).
   - Preserved all original dataset files without modification.
2. **Performed Two-Level Annotator Comparison & PDF Grounding Audit:**
   - **Category-Level Binary Labels (`300` platform-category pairs):** Verified 98 annotated platforms (`284` `1/1` agreements, `10` `0/0` agreements, `0` binary disagreements) and 2 unannotated platforms (`iCloud` and `YouTube`, `6` missing pairs).
   - **Clause-Slot Level (`900` platform-slot pairs):** Identified `571` exact clause agreements, `9` formatting/typo variations (`580` consensus clauses), `15` partial clause overlaps, `89` clause-selection disagreements, `13` Tagger 1-only clauses, `21` Tagger 2-only clauses, `3` excluded Tagger 1 row-shift slots, and `179` empty slots (`131` unused secondary/tertiary slots, `30` negative `0/0` category slots, `18` unannotated platform slots).
   - **Discovered Critical Spreadsheet Row-Shift Error:** Identified via cross-row and PDF text verification that in `PP_table Tagger1.xlsx`, Excel Row 5 (`Oktawave`) contains `OVH.pdf` clauses and Excel Row 6 (`OVH`) contains `Discord.pdf` clauses due to a 1-row upward shift after the blank `iCloud` row.
3. **Created Reproducible Preparation Script & Structured Evaluation Dataset Files:**
   - [`scripts/prepare-evaluation-dataset.py`](../scripts/prepare-evaluation-dataset.py) — Deterministic Python (`pandas` + `openpyxl`) script.
   - [`evaluation/dataset/annotation-comparison.csv`](../evaluation/dataset/annotation-comparison.csv) — Full 900-row comparison matrix across all 100 platforms and 9 clause slots.
   - [`evaluation/dataset/annotated-test-cases.csv`](../evaluation/dataset/annotated-test-cases.csv) — 718 usable clause-level test cases preserving both annotators' labels and clauses without silently resolving disagreements.
   - [`evaluation/dataset/data-quality-report.md`](../evaluation/dataset/data-quality-report.md) & [`evaluation/dataset/README.md`](../evaluation/dataset/README.md) — Complete data quality audit, PDF correspondence analysis, and human-review guidelines.

---

## Phase 4: Prompt Evaluation Framework Design (Metrics, Rubric, Protocol & Experiment Design)

**Date:** 2026-11-01  
**Status:** Completed & Verified

### Completed Tasks
1. **Defined 10 Standardized Evaluation Metrics (`evaluation/scoring-rubric.md`):**
   - Specified `0–2` ordinal scales, weights, and formulas for: **M1** Clause Identification Accuracy (12%), **M2** Data Collection Identification (10%), **M3** Data Usage Identification (10%), **M4** Third-Party Sharing Identification (8%), **M5** User Rights Identification (8%), **M6** Risk & Vague Wording Identification (12%), **M7** Evidence Grounding (12%), **M8** Missing-Information Handling (8%), **M9** Plain-Language Clarity (8%), and **M10** Hallucination Rate (12%).
2. **Designed Reproducible Evaluation Protocol (`evaluation/protocol.md`):**
   - Established platform-disjoint partitioning: **2 calibration platforms** (`Telegram` and `Cisco`, 10 consensus clauses) + `SYNTH-001` for development/normalizer calibration, leaving **75 held-out English platforms (498 English consensus clauses)** as the primary English-only evaluation subset and **580 total consensus clauses** (across 87 platforms) as the overall consensus benchmark, with zero dev/eval platform overlap.
   - Defined multi-label evaluation rules for the 121 multi-category consensus clauses (`100` in the 498 held-out English subset).
   - Defined open-world evaluation rules so partial spreadsheet annotations (`GenData`, `GenUse`, `NoDist`) are never treated as complete ground truth for unannotated dimensions (`Third-Party Sharing`, `User Rights`, `Data Retention`).
   - Designed a non-invasive post-hoc normalization pipeline and dual composite scoring (**Composite Score A: Full 10-Metric Score** and **Composite Score B: 9-Metric Substantive Score excluding M7 verbatim quote formatting**) to evaluate Prompt V1's native prose fairly against V2 and V3 without modifying `baseline-v1.md`.
   - Included a complete walkthrough scoring `PL-TC-0004` (`Baidu AI Cloud`) across V1, V2, and V3 using clearly labeled **HYPOTHETICAL** outputs and scores.
3. **Created Experimental Design & Score Sheet Template:**
   - [`evaluation/experiment-design.md`](../evaluation/experiment-design.md) — Pre-registered hypotheses ($\text{H}_1$–$\text{H}_4$), controlled/dependent variables, blinded human scoring protocol, and unpopulated benchmark tables.
   - [`evaluation/score-sheet-template.csv`](../evaluation/score-sheet-template.csv) — Standardized CSV score-sheet template.
4. **Methodological Refinements & Calibration Phase Preparation:**
   - Enforced the **Isolated-Clause `N/A` Rule** across `scoring-rubric.md`, `protocol.md`, `experiment-design.md`, and `score-sheet-template.csv`: in isolated-clause runs, **M4 (Third-Party Sharing)**, **M5 (User Rights)**, and **M8 (Missing Information)** are marked `N/A` whenever the supplied excerpt is insufficient to establish those disclosures across the complete policy, so models are never penalized for unavailable context.
   - Clarified the orthogonal distinction between **M7 (Evidence Grounding)**—correctness and verbatim fidelity of supporting quotations—and **M10 (Hallucination Rate)**—proportion of unsupported factual claims in the generated response ($\text{HR} = C_{\text{unsupported}} / C_{\text{total}}$).
   - Made **M10** ordinal scoring thresholds mutually exclusive and exhaustive: Score `2` ($C_{\text{unsupported}} = 0$), Score `1` ($C_{\text{unsupported}} = 1 \text{ and } \text{HR} \le 0.20$), Score `0` ($C_{\text{unsupported}} \ge 2 \text{ or } [C_{\text{unsupported}} = 1 \text{ and } \text{HR} > 0.20]$).
   - Created [`scripts/verify-evaluation-partitions.py`](../scripts/verify-evaluation-partitions.py) and verified that the **10 development clauses** (`Telegram` and `Cisco`) load independently with zero overlap with the **498 held-out English consensus clauses** (75 platforms) and **570 held-out multilingual consensus clauses** (85 platforms).
   - Created calibration materials in `evaluation/calibration/`: [`calibration-checklist.md`](../evaluation/calibration/calibration-checklist.md), [`scorer-training-guide.md`](../evaluation/calibration/scorer-training-guide.md), [`human-scoring-agreement-sheet.csv`](../evaluation/calibration/human-scoring-agreement-sheet.csv), and [`experiment-execution-checklist.md`](../evaluation/calibration/experiment-execution-checklist.md).

---

## Phase 5: Final Project Audit, Setup Automation & Safe GitHub Deployment

**Date:** 2026-11-02  
**Status:** Completed & Verified

### Completed Tasks
1. **Complete Project & Security Audit:**
   - Audited all directories (`extension/`, `server/`, `prompts/`, `evaluation/`, `datasets/`, `scripts/`, `docs/`), `server/package.json` dependencies, and environment templates.
   - Removed all machine-specific absolute paths from project documentation.
   - Verified zero API keys, passwords, or `.env` files are tracked by Git.
2. **Repository Hygiene & Dataset Copyright Protection (`.gitignore`):**
   - Updated [`.gitignore`](../.gitignore) to track [`server/package-lock.json`](../server/package-lock.json) and [`server/.env.example`](../server/.env.example) for reproducible team builds while excluding `node_modules/`, `.env*`, `.venv/`, `__pycache__/`, the restricted raw research corpus (`datasets/Annotated Privacy Policies of 100 Online Platforms/`), and the bulk-extracted clause CSVs (`evaluation/dataset/annotated-test-cases.csv`, `evaluation/dataset/annotation-comparison.csv`).
   - Preserved all local dataset files and generated CSVs untouched on local disk.
   - Updated [`datasets/README.md`](../datasets/README.md) and [`evaluation/dataset/README.md`](../evaluation/dataset/README.md) with dataset attribution (CC BY 4.0) and step-by-step instructions for teammates to place the dataset locally and regenerate the CSVs.
3. **One-Command Team Setup & Root Documentation:**
   - Created [`requirements.txt`](../requirements.txt) (`pandas>=2.0.0`, `openpyxl>=3.1.0`) and added `engines` (`node >=18.0.0`, `npm >=9.0.0`) to [`server/package.json`](../server/package.json).
   - Created [`scripts/setup.ps1`](../scripts/setup.ps1) for automated Windows PowerShell onboarding (verifying Node.js/npm/Python, running `npm ci`, installing Python dependencies, creating `server/.env` from `server/.env.example` without overwriting existing configs, and regenerating/verifying dataset partitions when the local dataset is present).
   - Authored the comprehensive root [`README.md`](../README.md) with a "Getting Started in 5 Minutes" teammate guide, architecture diagrams, prompt evolution overview, evaluation methodology, and team workflow guidelines.
4. **GitHub Publication:**
   - Configured `origin` remote (`https://github.com/Naivedya-Shilpi/Privacy_Lens.git`), performed pre-push security checks, committed all collaboration-ready files, and pushed `main` to GitHub.

